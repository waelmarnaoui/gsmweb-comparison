import 'server-only';
import {service} from '../server';
import {agentAccount} from '../agent-context';
import {connectionToken} from '../connections';
import {controlStore} from '../ads-control/store';
import {ControlProviderError,isGoogleQuotaError} from '../ads-control/google';
import {lowRequestAdsRead} from '../ads-read-server';
import {adsReadWait} from '../ads-web-mode';
import {digest} from '../ai-ads/inventory';
import {createSearchReader} from '../ai-ads/search-reader';
import type {SearchReport} from '../ai-ads/search-growth';
import {IntegrationError} from '../integration-error';
import {bulkSelectionSchema,prepareBulkDraft,type BulkSelection} from './drafts';
import {bulkGoogle} from './google';
import {submitBulkGroup,type BulkRow} from './engine';
const storage=()=>new IntegrationError('Bulk draft storage is not installed. Review BULK-ADS-PROPOSED.sql in the attribution database. No Google request was sent.',503);
export async function bulkKeywordReport():Promise<SearchReport|null>{
 const r=await service().from('ga_audit').select('details').eq('entity','bulk_keyword_report').eq('record_id',agentAccount()).eq('action','observed').order('id',{ascending:false}).limit(1).maybeSingle();
 if(r.error)throw new IntegrationError('Saved keyword report unavailable.',503);return r.data?.details as SearchReport??null;
}
export async function collectBulkKeywords(actor:string){
 const saved=await bulkKeywordReport(),stamp=Date.parse(saved?.fetchedAt??'');
 if(saved&&Date.now()-stamp>=0&&Date.now()-stamp<6*3600000)return saved;
 return lowRequestAdsRead(agentAccount(),'search',async()=>{
  const report=await createSearchReader({accountId:agentAccount(),lookbackDays:30,researchOnly:true,token:async()=>(await connectionToken('google_ads_management')).token,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN}).collect();
  if(Buffer.byteLength(JSON.stringify(report))>2000000)throw new IntegrationError('Keyword report is too large. No incomplete report was saved.',503);
  const r=await service().from('ga_audit').insert({actor,action:'observed',entity:'bulk_keyword_report',record_id:agentAccount(),details:report});if(r.error)throw new IntegrationError('Keyword report could not be saved.',503);return report;
 });
}
export async function readBulkGroups(actor:string){
 const r=await service().from('ga_bulk_ad_groups').select('*').eq('account_id',agentAccount()).eq('actor',actor).order('created_at',{ascending:false}).limit(50);
 if(r.error)throw storage();return r.data as BulkRow[];
}
export async function saveBulkGroup(actor:string,input:BulkSelection,campaignId:string,cpcMicros:string|null){
 if(!/^\d{1,20}$/.test(campaignId)||cpcMicros!==null&&(!/^\d{1,9}$/.test(cpcMicros)||Number(cpcMicros)<10000||Number(cpcMicros)>100000000))throw new IntegrationError('Check the campaign ID and maximum CPC.',400);
 const selection=bulkSelectionSchema.parse(input),draft=prepareBulkDraft(selection,await bulkKeywordReport()),account=agentAccount(),db=service();
 const hash=digest({account,campaignId,cpcMicros,draft});
 const previous=await db.from('ga_bulk_ad_groups').select('*').eq('account_id',account).eq('campaign_id',campaignId).eq('family',selection.family).eq('service',selection.service).maybeSingle();if(previous.error)throw storage();
 if(previous.data){
  if(previous.data.actor!==actor||!['draft','rejected'].includes(previous.data.state))throw new IntegrationError('This group is already reserved or submitted. It will not be duplicated.',409);
  const r=await db.from('ga_bulk_ad_groups').update({draft,content_hash:hash,cpc_micros:cpcMicros,state:'draft',version:previous.data.version+1,error_code:null,result:null,updated_at:new Date().toISOString()}).eq('id',previous.data.id).eq('actor',actor).eq('version',previous.data.version).in('state',['draft','rejected']).select('*').single();if(r.error||!r.data)throw storage();return r.data as BulkRow;
 }
 const r=await db.from('ga_bulk_ad_groups').insert({account_id:account,actor,campaign_id:campaignId,family:selection.family,service:selection.service,draft,content_hash:hash,cpc_micros:cpcMicros}).select('*').single();if(r.error||!r.data)throw storage();return r.data as BulkRow;
}
export async function publishBulkGroup(actor:string,id:string,hash:string,confirmed:boolean){
 const db=service(),account=agentAccount(),locks=controlStore(db),google=bulkGoogle({account,token:async()=>(await connectionToken('google_ads_management')).token,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN});
 const guard=async()=>{
  const config=await locks.settings(account);if(config.global_paused)throw new IntegrationError('Account controls are globally paused. Review Account controls before submitting.',409);
  const r=await db.from('ga_audit').select('id,action,created_at').eq('entity','google_ads_read_gate').eq('record_id',account).in('action',['quota','owner_reset']).gte('created_at',new Date(Date.now()-48*3600000).toISOString()).order('id',{ascending:false}).limit(100);if(r.error)throw storage();
  if(adsReadWait('resources',r.data??[]))throw new IntegrationError('Google quota cooldown is active. No submission was sent.',429);
 };
 try{return await submitBulkGroup({actor,hash,confirmed,guard,google,uncertain:e=>e instanceof ControlProviderError&&e.uncertain,errorCode:e=>e instanceof ControlProviderError?[e.code,...e.diagnostics].join(':').slice(0,250):'bulk_validation_failed',quota:async e=>{if(isGoogleQuotaError(e)){const r=await db.from('ga_audit').insert({actor,action:'quota',entity:'google_ads_read_gate',record_id:account,details:{source:'manual_bulk_submission'}});if(r.error)throw storage();}},store:{
  lock:()=>locks.lock(account),unlock:t=>locks.unlock(account,t),fence:t=>locks.fence(account,t),
  load:async()=>{const r=await db.from('ga_bulk_ad_groups').select('*').eq('id',id).eq('actor',actor).eq('account_id',account).single();if(r.error||!r.data)throw storage();return r.data as BulkRow;},
  transition:async(row,state,patch={})=>{const r=await db.from('ga_bulk_ad_groups').update({state,...patch,version:row.version+1,updated_at:new Date().toISOString()}).eq('id',row.id).eq('actor',actor).eq('account_id',account).eq('version',row.version).eq('state',row.state).select('*').single();if(r.error||!r.data)throw new IntegrationError('Submission receipt is unavailable. Do not resend; inspect the saved group status.',503);return r.data as BulkRow;}
 }});}catch(e){if(e instanceof IntegrationError)throw e;throw new IntegrationError(e instanceof ControlProviderError?'Google rejected or could not confirm this submission: '+[e.code,...e.diagnostics].join(' · ')+'. Check the saved group before retrying.':e instanceof Error?e.message:'Submission could not be confirmed.',409);}
}
