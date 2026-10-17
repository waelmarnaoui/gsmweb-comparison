/** Run on a separate always-on host, never inside the dashboard or Vercel request loop. */
import {createClient} from '@supabase/supabase-js';
import {decryptConnection} from '../lib/connection-crypto';
import {CONTROL_VERSION,validAccount} from '../lib/ads-control/rules';
import {controlStore} from '../lib/ads-control/store';
import {createControlEngine} from '../lib/ads-control/engine';
import {createControlGoogle,isGoogleQuotaError} from '../lib/ads-control/google';
const required=(name:string)=>{const value=process.env[name];if(!value)throw new Error('Recovery configuration is incomplete.');return value;};
const account=validAccount(required('GOOGLE_ADS_CUSTOMER_ID')),deployment=required('ADS_CONTROL_RECOVERY_DEPLOYMENT_ID');
if(deployment.length>100)throw new Error('Recovery configuration is invalid.');
const db=createClient(required('NEXT_PUBLIC_SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(10000)})}});
let cached:{sealed:string;token:string;expires:number}|null=null;
async function token(){
 const r=await db.from('ga_connections').select('encrypted_credentials').eq('id','google_ads_management').single();if(r.error)throw new Error('Recovery authorization unavailable.');
 if(cached?.sealed===r.data.encrypted_credentials&&cached!.expires>Date.now()+60000)return cached!.token;
 const credentials=process.env.ADS_CONTROL_WORKER_REFRESH_TOKEN?{access_token:'',refresh_token:process.env.ADS_CONTROL_WORKER_REFRESH_TOKEN,expires_at:0}:decryptConnection<{access_token:string;refresh_token:string;expires_at:number}>(r.data.encrypted_credentials,required('CONNECTION_ENCRYPTION_KEY'),'google_ads_management');
 if(credentials.expires_at>Date.now()+60000)return credentials.access_token;
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:credentials.refresh_token,client_id:required('GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_ID'),client_secret:required('GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_SECRET')}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Recovery OAuth failed.');const data=await response.json();
 if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=60)throw new Error('Recovery OAuth failed.');
 cached={sealed:r.data.encrypted_credentials,token:data.access_token,expires:Date.now()+data.expires_in*1000};return data.access_token;
}
const google=createControlGoogle({accountId:account,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token});
const engine=createControlEngine({store:controlStore(db),google,preflight:async()=>{throw new Error('Recovery workers cannot execute new actions.');},recoveryHealthy:async()=>false});
const canary=required('ADS_CONTROL_RECOVERY_CANARY_CAMPAIGN_ID');if(!/^\d{1,20}$/.test(canary))throw new Error('Recovery canary is invalid.');
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
let canaryRetryAt=0;
async function heartbeat(ok:boolean){const r=await db.from('ga_ads_control_workers').upsert({account_id:account,role:'recovery',deployment_id:deployment,version:CONTROL_VERSION,checked_at:new Date().toISOString(),ok});if(r.error)throw new Error('Recovery health storage failed.');}
async function tick(){
 try{
  const due=await db.from('ga_ads_actions').select('id').eq('account_id',account).eq('kind','campaign_pause').in('state',['executing','confirmed','uncertain']).lte('recovery_due_at',new Date().toISOString()).order('recovery_due_at').limit(20);
  if(due.error)throw new Error('Recovery queue unavailable.');
  let ok=true;
  for(const row of due.data??[]){try{const result=await engine.recover(row.id);if(result.state!=='recovered')ok=false;}catch{ok=false;}}
  // Do not let canary checks or routine reconciliation postpone a failed recovery.
  if(!ok){await heartbeat(false);console.error('Campaign recovery needs immediate attention.');return;}
  // Due safety restorations above are never postponed by routine canary backoff.
  if(Date.now()<canaryRetryAt){await heartbeat(false);return;}
  const canaryResource=`customers/${account}/campaigns/${canary}`,state=await google.read('campaign_pause',canaryResource);
  // A write-permission dry run only: no campaign state changes in this health check.
  await google.mutate('campaign_pause',canaryResource,state.value,true);
  const pending=await db.from('ga_ads_actions').select('id').eq('account_id',account).neq('kind','campaign_pause').in('state',['executing','uncertain']).order('created_at').limit(3);
  if(pending.error)throw new Error('Reconciliation queue unavailable.');
  for(const row of pending.data??[]){try{await engine.reconcile(row.id);}catch{ok=false;}}
  await heartbeat(ok);
  // Operational output contains no credentials, provider errors, or customer data.
  console.info(ok?'Recovery check completed.':'Recovery needs attention.');
 }catch(error){if(isGoogleQuotaError(error))canaryRetryAt=Date.now()+15*60000;try{await heartbeat(false);}catch{/* Keep previous timestamp stale. */}console.error('Recovery check failed; inspect the account-control dashboard.');}
}
async function main(){do{await tick();if(process.argv.includes('--once'))break;if(!stopping)await new Promise(resolve=>setTimeout(resolve,30000));}while(!stopping);}
void main().catch(()=>{console.error('Recovery worker stopped.');process.exitCode=1;});
