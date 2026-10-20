import 'server-only';
import {createHash} from 'node:crypto';
import {service} from '../server';
import {agentAccount} from '../agent-context';
import {connectionToken} from '../connections';
import {controlStore} from '../ads-control/store';
import {ControlProviderError} from '../ads-control/google';
import {IntegrationError} from '../integration-error';
import {canonicalChange,rangeSchema,targets,type Change,type Range,type Report} from './model';
import {keywordGoogle} from './google';
const storage=()=>new IntegrationError('Keyword storage is unavailable. Install the approved KEYWORD-WORKSPACE-PROPOSED.sql in the attribution database.',503);
const google=()=>keywordGoogle({account:agentAccount(),token:async()=>(await connectionToken('google_ads_management')).token,login:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN});
export async function keywordReport(actor:string,input:Range,refresh=false){
 const range=rangeSchema.parse(input),db=service(),account=agentAccount();
 const saved=await db.from('ga_keyword_reports').select('*').eq('account_id',account).eq('actor',actor).eq('range_start',range.from).eq('range_end',range.to).order('created_at',{ascending:false}).limit(1).maybeSingle();if(saved.error)throw storage();
 if(!refresh)return saved.data?.payload as Report??null;
 if(saved.data&&Date.now()-Date.parse(saved.data.created_at)<600000)return saved.data.payload as Report;
 const locks=controlStore(db),lease=await locks.lock(account);if(!lease)throw new IntegrationError('Another account request is running. Wait for it to finish.',409);
 try{const report=await google().collect(range);if(Buffer.byteLength(JSON.stringify(report))>5000000)throw new IntegrationError('Report too large. Narrow the dates.',422);await locks.fence(account,lease);const r=await db.from('ga_keyword_reports').insert({actor,account_id:account,range_start:range.from,range_end:range.to,payload:report});if(r.error)throw storage();return report;}finally{await locks.unlock(account,lease);}
}
export async function keywordHistory(actor:string){const r=await service().from('ga_keyword_actions').select('*').eq('account_id',agentAccount()).eq('actor',actor).order('created_at',{ascending:false}).limit(50);if(r.error)throw storage();return r.data;}
export async function prepareKeywords(actor:string,input:unknown){
 const change=canonicalChange(input),account=agentAccount();
 if(change.kind!=='create'&&change.resources.some(r=>!r.startsWith(`customers/${account}/adGroupCriteria/`)))throw new IntegrationError('Keyword belongs to another account.',403);
 const hash=createHash('sha256').update(JSON.stringify({account,change})).digest('hex'),db=service();
 const r=await db.from('ga_keyword_actions').upsert({actor,account_id:account,content_hash:hash,payload:change},{onConflict:'account_id,content_hash',ignoreDuplicates:true}).select('*');if(r.error)throw storage();
 const found=r.data?.[0]??(await db.from('ga_keyword_actions').select('*').eq('account_id',account).eq('content_hash',hash).eq('actor',actor).maybeSingle()).data;
 if(!found||found.actor!==actor)throw new IntegrationError('This request is already owned by another administrator.',409);return found;
}
export async function executeKeywords(actor:string,id:string,hash:string){
 const db=service(),account=agentAccount(),locks=controlStore(db),lease=await locks.lock(account);if(!lease)throw new IntegrationError('Another account action is running.',409);
 let reserved=false;
 async function receipt(state:string,patch:Record<string,unknown>={}){const r=await db.from('ga_keyword_actions').update({state,...patch,updated_at:new Date().toISOString()}).eq('id',id).eq('actor',actor).eq('state','submitting').select('id');if(r.error||r.data?.length!==1)throw new IntegrationError('Google result could not be recorded. Do not resend; check action history.',503);}
 try{
  const r=await db.from('ga_keyword_actions').select('*').eq('id',id).eq('account_id',account).eq('actor',actor).single();if(r.error||!r.data)throw storage();const row=r.data;
  if(row.state!=='draft'||row.content_hash!==hash||Date.now()-Date.parse(row.created_at)>86400000)throw new IntegrationError('Request changed, expired or was already submitted. Check action history.',409);
  const change=canonicalChange(row.payload),keys=new Set(targets(change));
  const pending=await db.from('ga_keyword_actions').select('id,payload').eq('account_id',account).in('state',['submitting','uncertain']).limit(1001);if(pending.error||pending.data.length>1000)throw storage();
  if(pending.data.some(p=>targets(canonicalChange(p.payload)).some(t=>keys.has(t))))throw new IntegrationError('An overlapping request is unconfirmed. It will not be resent.',409);
  const api=google(),operations=await api.plan(change);await api.mutate(operations,true);await locks.fence(account,lease);
  const claim=await db.from('ga_keyword_actions').update({state:'submitting',updated_at:new Date().toISOString()}).eq('id',id).eq('state','draft').eq('content_hash',hash).eq('actor',actor).select('id');if(claim.error||claim.data?.length!==1)throw new IntegrationError('Request was already claimed. Nothing was resent.',409);reserved=true;
  const result=await api.mutate(operations,false);await receipt('success',{result});return result;
 }catch(error){
  if(reserved)await receipt(error instanceof ControlProviderError&&!error.uncertain?'failed':'uncertain',{error_code:error instanceof ControlProviderError?[error.code,...error.diagnostics].join(':'):'unconfirmed'});
  if(error instanceof IntegrationError)throw error;
  if(error instanceof ControlProviderError)throw new IntegrationError('Google keyword request failed: '+[error.code,...error.diagnostics].join(' · ')+'. Check action history before retrying.',503);
  throw new IntegrationError(error instanceof Error?error.message:'Keyword request could not be completed.',409);
 }finally{await locks.unlock(account,lease);}
}
