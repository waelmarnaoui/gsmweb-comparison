import {safePhone} from './crm-comparison';
import {parseTimestamp} from './timestamps';
export const CONSENT_SCRIPT_VERSION='store-google-v1';
export const CONSENT_SCRIPT='May GSMWeb share your phone number, securely hashed, and conversion details with Google to measure our advertising? This is optional and does not affect your repair or service. You can refuse or withdraw by contacting GSMWeb at the store. Google uses this information to match advertising interactions. Advertising personalization is a separate, optional choice.';
export const CONSENT_STATUSES=['not_asked','granted','refused','withdrawn'] as const;
export type ConsentStatus=typeof CONSENT_STATUSES[number];
export type ClientConsent={id:string;crm_project_ref:string;client_id:string;phone:string;ad_user_data:ConsentStatus;ad_personalization:ConsentStatus;obtained_at:string;recorded_at:string;recorded_by:string;script_version:string};
export function validateConsentInput(input:unknown,now=Date.now()){
 if(!input||typeof input!=='object')throw new Error('Choose a client and consent choices.');
 const v=input as Record<string,unknown>;
 if(typeof v.callId!=='string'||!/^[0-9a-f-]{36}$/i.test(v.callId))throw new Error('Choose a saved call.');
 if(!CONSENT_STATUSES.includes(v.adUserData as ConsentStatus)||!CONSENT_STATUSES.includes(v.adPersonalization as ConsentStatus))throw new Error('Choose valid consent statuses.');
 if(v.confirmed!==true)throw new Error('Confirm that these choices reflect the customer response.');
 if(v.scriptVersion!==CONSENT_SCRIPT_VERSION)throw new Error('Refresh the consent explanation before saving.');
 if(typeof v.obtainedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v.obtainedAt)||!Number.isFinite(Date.parse(v.obtainedAt))||Date.parse(v.obtainedAt)>now)throw new Error('Consent time must be a valid past or current time.');
 const obtainedAt=parseTimestamp(v.obtainedAt);
 return {callId:v.callId,adUserData:v.adUserData as ConsentStatus,adPersonalization:v.adPersonalization as ConsentStatus,obtainedAt};
}
export function consentAllowsUserData(consent:ClientConsent|undefined,phone:string,now=Date.now()){
 return Boolean(consent&&consent.ad_user_data==='granted'&&consent.script_version===CONSENT_SCRIPT_VERSION&&safePhone(consent.phone)===safePhone(phone)&&safePhone(phone)&&Number.isFinite(Date.parse(consent.obtained_at))&&Date.parse(consent.obtained_at)<=now);
}
