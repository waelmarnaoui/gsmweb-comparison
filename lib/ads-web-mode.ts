// Temporary owner-requested mode: no unattended Ads writes or laptop dependency.
export const ADS_WEB_ONLY=true;
export const ADS_READ_GAP_MS=6*60*60*1000;
export const ADS_QUOTA_WAIT_MS=24*60*60*1000;
export type AdsReadKind='report'|'policy'|'resources'|'search';
export type AdsReadReceipt={action:string;created_at:string};
export function adsReadWait(kind:AdsReadKind,receipts:AdsReadReceipt[],now=Date.now()){
 let until=0;
 for(const r of receipts){const time=Date.parse(r.created_at);if(!Number.isFinite(time))continue;
  if(time>now+60000)return ADS_QUOTA_WAIT_MS;
  if(r.action==='quota')until=Math.max(until,time+ADS_QUOTA_WAIT_MS);
  if(r.action===kind)until=Math.max(until,time+ADS_READ_GAP_MS);
 }
 return Math.max(0,until-now);
}
