type RefreshResult={refreshError:string|null};
export function needsAdsRefresh(fetchedAt:string|null,now=Date.now()){
 const fetched=Date.parse(fetchedAt??'');return !Number.isFinite(fetched)||fetched>now+60000||now-fetched>=5*60000;
}
export function createAdsRefreshGate(){
 const pending=new Map<string,Promise<RefreshResult>>(),retryAfter=new Map<string,number>();
 const failure={refreshError:'Automatic report collection failed. Check Google Ads reporting authorization and retry Collect report. Saved data has not been marked fresh.'};
 return async function refresh(account:string,readLatest:()=>Promise<string|null>,collect:()=>Promise<unknown>,now=Date.now()):Promise<RefreshResult>{
  const active=pending.get(account);if(active)return active;
  if((retryAfter.get(account)??0)>now)return failure;
  const task=(async()=>{
   if(!needsAdsRefresh(await readLatest(),now))return {refreshError:null};
   try{await collect();retryAfter.delete(account);return {refreshError:null};}
   catch{retryAfter.set(account,now+60000);return failure;}
  })();
  pending.set(account,task);
  try{return await task;}finally{pending.delete(account);}
 };
}
