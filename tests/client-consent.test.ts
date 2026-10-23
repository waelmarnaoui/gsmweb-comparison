import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConsentInput,consentAllowsUserData,CONSENT_SCRIPT_VERSION,type ClientConsent} from '../lib/client-consent';
import {conversionCsv} from '../lib/conversion-csv';
import {parse} from 'csv-parse/sync';
const now=Date.parse('2026-10-11T12:00:00Z');
const input={callId:'00000000-0000-0000-0000-000000000001',adUserData:'granted',adPersonalization:'not_asked',obtainedAt:'2026-10-11T11:59:00Z',scriptVersion:CONSENT_SCRIPT_VERSION,confirmed:true};
const consent:ClientConsent={id:'1',client_id:'client',crm_project_ref:'dmjunqbncyrinykbbmfk',phone:'+40712345678',ad_user_data:'granted',ad_personalization:'not_asked',obtained_at:input.obtainedAt,recorded_at:input.obtainedAt,recorded_by:'staff',script_version:CONSENT_SCRIPT_VERSION};
test('draft granted is not valid without staff attestation and current explanation',()=>{
 assert.equal(validateConsentInput(input,now).adPersonalization,'not_asked');
 for(const changes of [{confirmed:false},{scriptVersion:'old'},{adUserData:'yes'},{obtainedAt:'2026-10-12T00:00:00Z'},{obtainedAt:'2026-10-11 11:59:00'}])assert.throws(()=>validateConsentInput({...input,...changes},now));
});
test('unknown, refused, withdrawn, changed phone and future consent fail closed',()=>{
 assert.equal(consentAllowsUserData(consent,'0712345678',now),true);
 assert.equal(consentAllowsUserData(undefined,consent.phone,now),false);
 for(const status of ['not_asked','refused','withdrawn'] as const)assert.equal(consentAllowsUserData({...consent,ad_user_data:status},consent.phone,now),false);
 assert.equal(consentAllowsUserData(consent,'+40799999999',now),false);
 assert.equal(consentAllowsUserData({...consent,obtained_at:'2026-10-12T00:00:00Z'},consent.phone,now),false);
});
test('CSV never includes phone hashes without explicit allowed-user-data flag',()=>{
 const row={ready:true,gclid:'click',phone:consent.phone,conversionTime:input.obtainedAt,amount:100,paymentId:'crm:payment',timeBasis:'website_click'};
 assert.equal(parse(conversionCsv([row],'CRM'))[1][1],'');
 assert.throws(()=>conversionCsv([{...row,gclid:''}],'CRM'));
 assert.match(parse(conversionCsv([{...row,userDataAllowed:true}],'CRM'))[1][1],/^[a-f0-9]{64}$/);
});
