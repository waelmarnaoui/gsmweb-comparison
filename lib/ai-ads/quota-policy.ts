export const QUOTA_COOLDOWN_MS=15*60000;
export function quotaWait(error:string|null,checkedAt:string|null,now=Date.now()){
 if(error!=='google_ads_quota_cooldown')return 0;
 const checked=Date.parse(checkedAt??'');
 if(!Number.isFinite(checked)||checked>now+10000)return 0;
 return Math.max(0,Math.ceil((checked+QUOTA_COOLDOWN_MS-now)/1000));
}
