import 'server-only';
import {service} from './server';
import {IntegrationError} from './integration-error';
import {controlStore} from './ads-control/store';
import {isGoogleQuotaError} from './ads-control/google';
import {AdsReportingError} from './ads-monitor';
import {gatedAdsRead} from './ads-read-gate';
import type {AdsReadKind} from './ads-web-mode';
export async function lowRequestAdsRead<T>(account:string,kind:AdsReadKind,collect:()=>Promise<T>){
 const db=service(),locks=controlStore(db);
 try{return await gatedAdsRead(kind,{
  lock:()=>locks.lock(account),unlock:t=>locks.unlock(account,t),
  receipts:async()=>{const r=await db.from('ga_audit').select('action,created_at').eq('entity','google_ads_read_gate').eq('record_id',account).gte('created_at',new Date(Date.now()-48*3600000).toISOString()).order('created_at',{ascending:false}).limit(100);if(r.error)throw new Error('Read gate storage unavailable.');return r.data??[];},
  record:async action=>{const r=await db.from('ga_audit').insert({actor:null,action,entity:'google_ads_read_gate',record_id:account,details:{mode:'web_only'}});if(r.error)throw new Error('Read gate receipt unavailable.');}
 },collect,e=>isGoogleQuotaError(e)||e instanceof AdsReportingError&&e.httpStatus===429);}
 catch(error){
  const message=error instanceof Error?error.message:'';
  if(message==='ads_read_busy')throw new IntegrationError('Another account check is running. Use saved results and try later.',409);
  if(isGoogleQuotaError(error)||error instanceof AdsReportingError&&error.httpStatus===429)throw new IntegrationError('Google rejected this request because of its API quota. No site cooldown or automatic retry was started. You may retry manually.',429);
  throw error;
 }
}
