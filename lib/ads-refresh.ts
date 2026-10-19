import {AdsReportingError} from './ads-monitor';
type RefreshResult={refreshError:string|null;quotaLimited?:boolean};
export function needsAdsRefresh(fetchedAt:string|null,now=Date.now()){
 const fetched=Date.parse(fetchedAt??'');return !Number.isFinite(fetched)||fetched>now+60000||now-fetched>=5*60000;
}
export function createAdsRefreshGate(){
 const pending=new Map<string,Promise<RefreshResult>>();
 const failure={refreshError:'Automatic report collection failed. Check Google Ads reporting authorization and retry Collect report. Saved data has not been marked fresh.'};
 return async function refresh(account:string,readLatest:()=>Promise<string|null>,collect:()=>Promise<unknown>,now=Date.now()):Promise<RefreshResult>{
  const active=pending.get(account);if(active)return active;
  const task=(async()=>{
   if(!needsAdsRefresh(await readLatest(),now))return {refreshError:null};
   try{await collect();return {refreshError:null};}
   catch(error){const quota=error instanceof AdsReportingError&&error.httpStatus===429;return {...failure,...(quota?{quotaLimited:true}:{})};}
  })();
  pending.set(account,task);
  try{return await task;}finally{pending.delete(account);}
 };
}
