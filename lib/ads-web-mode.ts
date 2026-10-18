// Temporary owner-requested mode: no unattended Ads writes or laptop dependency.
export const ADS_WEB_ONLY=true;
export const ADS_READ_GAP_MS=6*60*60*1000;
export const ADS_QUOTA_WAIT_MS=24*60*60*1000;
export type AdsReadKind='report'|'policy'|'resources'|'search';
export type AdsReadReceipt={id?:number;action:string;created_at:string};
export function adsReadWait(kind:AdsReadKind,receipts:AdsReadReceipt[],now=Date.now()){
 const validId=(row:AdsReadReceipt)=>typeof row.id==='number'&&Number.isSafeInteger(row.id)&&row.id>=0;
 const after=(a:AdsReadReceipt,b:AdsReadReceipt)=>validId(a)&&validId(b)?a.id!>b.id!:Date.parse(a.created_at)>Date.parse(b.created_at);
 let reset:AdsReadReceipt|undefined;
 for(const row of receipts){
  const time=Date.parse(row.created_at);if(!Number.isFinite(time))continue;
  if(time>now+60000)return ADS_QUOTA_WAIT_MS;
  if(row.action==='owner_reset'&&(!reset||after(row,reset)))reset=row;
 }
 let until=0;
 for(const r of receipts){const time=Date.parse(r.created_at);if(!Number.isFinite(time))continue;
  if(time>now+60000)return ADS_QUOTA_WAIT_MS;
  if(r.action==='owner_reset')continue;
  // A reset is a durable watermark, not a permanent bypass or deletion of audit history.
  if(reset&&(validId(r)&&validId(reset)?r.id!<=reset.id!:time<Date.parse(reset.created_at)))continue;
  if(r.action==='quota')until=Math.max(until,time+ADS_QUOTA_WAIT_MS);
  if(r.action===kind)until=Math.max(until,time+ADS_READ_GAP_MS);
 }
 return Math.max(0,until-now);
}
