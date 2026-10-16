import 'server-only';
import {randomBytes,randomUUID,createPublicKey} from 'node:crypto';
import {service} from '../server';
import {getConnection} from '../connections';
import {IntegrationError} from '../integration-error';
import {agentAccount} from '../agent-context';
import {setupControl,controlGoogle} from './server';
import {pairingHash,sealWorkerConfig} from './pairing-crypto';
export async function createLaptopPairing(actor:string,canary:string){
 const {db,account}=await setupControl();
 if(!/^\d{1,20}$/.test(canary))throw new Error('Choose a live campaign for the recovery validation check.');
 const resource=`customers/${account}/campaigns/${canary}`,google=controlGoogle();
 const live=await google.read('campaign_pause',resource);await google.mutate('campaign_pause',resource,live.value,true);
 const token=randomBytes(32).toString('base64url'),id=randomUUID(),deployment='laptop-'+id;
 const r=await db.from('ga_ads_worker_pairings').insert({id,account_id:account,token_hash:pairingHash(token),deployment_id:deployment,canary_campaign_id:canary,created_by:actor});
 if(r.error)throw new IntegrationError('Laptop setup storage is unavailable. Install the reviewed account-control schema.',503);
 // This code authorizes a one-time transfer of server credentials to the laptop.
 // It is returned only to the signed-in administrator, never logged or persisted in plaintext.
 return {setupCode:token,expiresInMinutes:10,deploymentId:deployment};
}
export async function redeemLaptopPairing(token:string,publicKey:string){
 const hash=pairingHash(token),key=createPublicKey(publicKey);
 if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength??0)<3072)throw new Error('Invalid laptop key.');
 const db=service(),account=agentAccount();
 const r=await db.from('ga_ads_worker_pairings').update({claimed_at:new Date().toISOString()}).eq('token_hash',hash).eq('account_id',account).is('claimed_at',null).gt('expires_at',new Date().toISOString()).select('id,deployment_id,canary_campaign_id').maybeSingle();
 if(r.error||!r.data)throw new IntegrationError('Setup code expired or was already used. Generate a new code in Account control.',409);
 const saved=await getConnection('google_ads_management');
 if(!saved?.credentials.refresh_token)throw new IntegrationError('Reconnect Google Ads management before pairing.',503);
 const env=(name:string)=>{const value=process.env[name];if(!value)throw new Error('Worker setup is incomplete.');return value;};
 const workerToken=randomBytes(32).toString('base64url');
 const config:Record<string,string>={
  APP_URL:env('APP_URL'),ADS_CONTROL_CRON_SECRET:workerToken,
  NEXT_PUBLIC_SUPABASE_URL:env('NEXT_PUBLIC_SUPABASE_URL'),SUPABASE_SERVICE_ROLE_KEY:env('SUPABASE_SERVICE_ROLE_KEY'),
  GOOGLE_ADS_CUSTOMER_ID:account,...(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?{GOOGLE_ADS_DEVELOPER_TOKEN:process.env.GOOGLE_ADS_DEVELOPER_TOKEN}:{}),
  GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_ID:env('GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_ID'),GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_SECRET:env('GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_SECRET'),
  ADS_CONTROL_WORKER_REFRESH_TOKEN:saved.credentials.refresh_token,ADS_CONTROL_RECOVERY_DEPLOYMENT_ID:r.data.deployment_id,ADS_CONTROL_RECOVERY_CANARY_CAMPAIGN_ID:r.data.canary_campaign_id,
  ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?{GOOGLE_ADS_LOGIN_CUSTOMER_ID:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID}:{})
 };
 const encrypted=sealWorkerConfig(config,publicKey,'gsmweb-laptop:'+r.data.id);
 // Once claimed, replace the setup hash with a distinct runtime capability hash.
 // The setup code cannot be replayed; this capability only authorizes stock ticks.
 const bound=await db.from('ga_ads_worker_pairings').update({token_hash:pairingHash(workerToken)}).eq('id',r.data.id);if(bound.error)throw new Error('Worker setup could not complete.');
 const changed=await db.from('ga_ads_control').update({recovery_deployment_id:r.data.deployment_id}).eq('account_id',account);if(changed.error)throw new Error('Worker setup could not complete.');
 return encrypted;
}
export async function authorizeLaptopTick(authorization:string|null):Promise<string|null>{
 const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const db=service(),account=agentAccount();
 const r=await db.from('ga_ads_worker_pairings').select('deployment_id').eq('account_id',account).eq('token_hash',pairingHash(token)).not('claimed_at','is',null).maybeSingle();
 if(r.error||!r.data)return null;
 const current=await db.from('ga_ads_control').select('recovery_deployment_id').eq('account_id',account).single();
 return !current.error&&current.data.recovery_deployment_id===r.data.deployment_id?r.data.deployment_id:null;
}
