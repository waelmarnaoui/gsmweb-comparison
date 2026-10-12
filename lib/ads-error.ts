// Do not echo provider messages: they may contain uploaded customer values.
export function adsErrorSummary(httpStatus:number,body:unknown){
 const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
 const error=object(object(body).error),codes=new Set<string>(),fields=new Set<string>();
 const code=(value:unknown)=>{if(typeof value==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(value))codes.add(value);};
 code(error.status);
 const allowed=new Set(['events','destinations','operatingAccount','loginAccount','accountType','accountId','productDestinationId','eventTimestamp','transactionId','conversionValue','currency','eventSource','userData','userIdentifiers','phoneNumber','consent','adUserData','adPersonalization','adIdentifiers','gclid','gbraid','wbraid','encoding','validateOnly','destinationReferences']);
 const field=(value:unknown)=>{if(typeof value!=='string')return;const parts=value.replace(/\[(\d+)\]/g,'.$1').split('.');if(parts.length>15||!parts.every(part=>allowed.has(part)||/^\d{1,4}$/.test(part)))return;fields.add(value.slice(0,200));};
 const details=Array.isArray(error.details)?error.details.slice(0,20):[];
 for(const value of details){const detail=object(value);code(detail.reason);if(Array.isArray(detail.fieldViolations))for(const violation of detail.fieldViolations.slice(0,20)){const item=object(violation);field(item.field);code(item.reason);}}
 const status=codes.size?' '+[...codes].slice(0,8).join(', '):'';
 return 'Google request rejected (HTTP '+httpStatus+status+').'+(fields.size?' Check fields: '+[...fields].slice(0,8).join(', ')+'.':' Check conversion settings and API access.')+' No automatic retry was attempted.';
}
