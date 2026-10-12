import {createHash} from 'node:crypto';
import {safePhone} from './crm-comparison';
import {consentAllowsUserData,type ClientConsent} from './client-consent';

export const ADS_ACCOUNT_ID='2050434247';
export const ADS_CONVERSION_ID='7835048106';
type Row={ready:boolean;paymentId:string;conversionTime:string;amount:number;phone:string;gclid:string;gbraid?:string;wbraid?:string;consent:ClientConsent|null;timeBasis:string;interactionChannel?:'call'|'whatsapp'};
export function validationPayload(rows:Row[],now=Date.now()){
 const eligible=rows.filter(row=>row.ready);
 if(!eligible.length||eligible.length>2000)throw new Error('Select between 1 and 2000 consented conversions.');
 const seen=new Set<string>();
 const events=eligible.map(row=>{
  const phone=safePhone(row.phone),time=Date.parse(row.conversionTime);
  if(!phone||!consentAllowsUserData(row.consent||undefined,phone,now)||!row.paymentId||seen.has(row.paymentId)||!Number.isFinite(time)||time>now||!Number.isFinite(row.amount))throw new Error('Conversion validation failed. Refresh the review.');
  seen.add(row.paymentId);
  const adIdentifiers:Record<string,string>={};
  for(const key of ['gclid','gbraid','wbraid'] as const){const value=row[key];if(value){if(!/^[A-Za-z0-9_-]{1,512}$/.test(value))throw new Error('Invalid advertising identifier.');adIdentifiers[key]=value;}}
  return {transactionId:row.paymentId,eventTimestamp:new Date(time).toISOString(),conversionValue:row.amount,currency:'RON',...(row.interactionChannel==='whatsapp'&&row.timeBasis!=='website_click'?{}:{eventSource:row.timeBasis==='website_click'?'WEB':'PHONE'}),userData:{userIdentifiers:[{phoneNumber:createHash('sha256').update(phone).digest('hex')}]},consent:{adUserData:'CONSENT_GRANTED',adPersonalization:row.consent?.ad_personalization==='granted'?'CONSENT_GRANTED':'CONSENT_DENIED'},...(Object.keys(adIdentifiers).length?{adIdentifiers}:{})};
 });
 return {destinations:[{operatingAccount:{accountType:'GOOGLE_ADS',accountId:ADS_ACCOUNT_ID},productDestinationId:ADS_CONVERSION_ID}],events,encoding:'HEX',validateOnly:true as const};
}
