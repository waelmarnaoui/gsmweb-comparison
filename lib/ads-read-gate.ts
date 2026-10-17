import type {AdsReadKind,AdsReadReceipt} from './ads-web-mode';
import {adsReadWait} from './ads-web-mode';
export type AdsReadGateStore={lock:()=>Promise<string|null>;unlock:(token:string)=>Promise<void>;receipts:()=>Promise<AdsReadReceipt[]>;record:(action:string)=>Promise<void>};
export async function gatedAdsRead<T>(kind:AdsReadKind,store:AdsReadGateStore,collect:()=>Promise<T>,isQuota:(e:unknown)=>boolean,now=Date.now()){
 const token=await store.lock();if(!token)throw new Error('ads_read_busy');
 try{
  const wait=adsReadWait(kind,await store.receipts(),now);if(wait)throw new Error('ads_read_wait:'+Math.ceil(wait/1000));
  // Persist before calling Google: crashes and failed requests still consume a slot.
  await store.record(kind);
  try{return await collect();}catch(error){if(isQuota(error))await store.record('quota');throw error;}
 }finally{await store.unlock(token);}
}
