// Temporary owner-requested mode: no unattended Ads writes or laptop dependency.
export const ADS_WEB_ONLY=true;
export const ADS_READ_GAP_MS=0;
export const ADS_QUOTA_WAIT_MS=0;
export type AdsReadKind='report'|'policy'|'resources'|'search';
export type AdsReadReceipt={action:string;created_at:string};
// Owner-disabled application cooldowns. Audit receipts never schedule a retry.
export function adsReadWait(_kind:AdsReadKind,_receipts:AdsReadReceipt[],_now=Date.now()){return 0;}
