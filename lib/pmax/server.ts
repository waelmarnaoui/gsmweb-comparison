import 'server-only';
import {service} from '../server';
import {agentAccount} from '../agent-context';
import {connectionToken} from '../connections';
import {advisorConfiguration} from '../advisor-settings-server';
import {readOllamaJob,OLLAMA_JOB_MS} from '../ollama-advisor';
import {controlStore} from '../ads-control/store';
import {IntegrationError} from '../integration-error';
import {ControlProviderError} from '../ads-control/google';
import {pmaxGoogle} from './google';
import {pmaxCopySchema,pmaxSettingsSchema,pmaxDraftSchema,pmaxHash,type PmaxRow} from './model';
import {publishPmax} from './engine';
import {pmaxTemplate} from './templates';
const storage=()=>new IntegrationError('Performance Max storage needs the approved PMAX-WORKSPACE-PROPOSED.sql setup in the attribution database.',503);
export const googlePmax=()=>pmaxGoogle({account:agentAccount(),token:async()=>(await connectionToken('google_ads_management')).token,login:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN});
async function transition(row:PmaxRow,state:string,patch:Record<string,unknown>={}){
 const r=await service().from('ga_pmax_drafts').update({...patch,state,version:row.version+1,updated_at:new Date().toISOString()}).eq('id',row.id).eq('actor',row.actor).eq('account_id',row.account_id).eq('state',row.state).eq('version',row.version).select('*').single();
 if(r.error||!r.data)throw new IntegrationError('Saved campaign changed or its receipt is unavailable. Refresh; never resend an uncertain submission.',409);return r.data as PmaxRow;
}
async function rowFor(actor:string,id:string){if(!/^[a-f0-9-]{36}$/i.test(id))throw new IntegrationError('Select a saved campaign.');const r=await service().from('ga_pmax_drafts').select('*').eq('actor',actor).eq('account_id',agentAccount()).eq('id',id).single();if(r.error||!r.data)throw storage();return r.data as PmaxRow;}
export async function pmaxRows(actor:string){const r=await service().from('ga_pmax_drafts').select('*').eq('actor',actor).eq('account_id',agentAccount()).order('created_at',{ascending:false}).limit(30);if(r.error)throw storage();return r.data as PmaxRow[];}
export async function generatePmax(actor:string,raw:unknown){
 const draft=pmaxTemplate(raw),account=agentAccount();
 const r=await service().from('ga_pmax_drafts').insert({account_id:account,actor,input:draft.settings}).select('*').single();
 if(r.error||!r.data)throw storage();
 return transition(r.data as PmaxRow,'draft',{draft,content_hash:pmaxHash(account,draft),error_code:null});
}
export async function pollPmax(actor:string,id:string){
 const row=await rowFor(actor,id);if(row.state!=='generating')return row;
 if(Date.now()-Date.parse(row.created_at)>OLLAMA_JOB_MS+120000)return transition(row,'failed',{error_code:'ai_generation_expired'});
 const config=await advisorConfiguration();if(config.provider!=='ollama'||!config.key)throw new IntegrationError('Ollama is not configured. The job was not resent.',503);
 const reply=await readOllamaJob({id:row.id,key:config.key,baseURL:config.baseURL});if(!reply)return row;
 try{if(reply.actions.length)throw new Error('Unexpected tool action.');const copy=pmaxCopySchema.parse(JSON.parse(reply.reply)),draft=pmaxDraftSchema.parse({settings:row.input,copy});return await transition(row,'draft',{draft,content_hash:pmaxHash(row.account_id,draft),error_code:null});}
 catch{return transition(row,'failed',{error_code:'ai_copy_needs_review_regenerate'});}
}
export async function savePmax(actor:string,id:string,raw:unknown,version:number){const row=await rowFor(actor,id);if(row.state!=='draft'||row.version!==version)throw new IntegrationError('Only the current unsubmitted draft can be edited.',409);const draft=pmaxDraftSchema.parse(raw);return transition(row,'draft',{draft,content_hash:pmaxHash(row.account_id,draft)});}
export async function submitPmax(actor:string,id:string,hash:string,confirmed:boolean){
 const db=service(),account=agentAccount(),locks=controlStore(db),google=googlePmax();
 try{return await publishPmax({actor,account,hash,confirmed,load:()=>rowFor(actor,id),transition,lock:()=>locks.lock(account),unlock:t=>locks.unlock(account,t),fence:t=>locks.fence(account,t),guard:async()=>{const settings=await locks.settings(account);if(settings.global_paused)throw new Error('Account controls are globally paused. Review Account controls before enabling spending.');},validate:row=>google.validate(row.draft!,row.id),create:(row,ops)=>google.create(row,ops)});}
 catch(error){throw new IntegrationError(error instanceof ControlProviderError?'Google Performance Max request rejected or unconfirmed: '+[error.code,...error.diagnostics].join(' · ')+'. Check saved status before retrying.':error instanceof Error?error.message:'Campaign request unconfirmed.',409);}
}
