import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adsErrorSummary} from '../lib/ads-error';
test('Google snake-case field paths identify missing required fields safely',()=>{
 const result=adsErrorSummary(400,{error:{status:'INVALID_ARGUMENT',details:[{fieldViolations:[{field:'events.events[0].event_source',reason:'REQUIRED_FIELD_MISSING',description:'private customer values'}]}]}});
 assert.match(result,/events.events\[0\].event_source/);assert.match(result,/REQUIRED_FIELD_MISSING/);assert.doesNotMatch(result,/private/);
});
test('Google errors expose diagnostic codes and field paths, never submitted values',()=>{
 const message=adsErrorSummary(400,{error:{status:'INVALID_ARGUMENT',message:'secret +40722882726',details:[{reason:'INVALID_CONVERSION_VALUE',metadata:{phone:'+40722882726'},fieldViolations:[{field:'events[0].conversionValue',description:'secret -25'},{field:'events[1].userData.userIdentifiers[0].phoneNumber',description:'secret hash'}]}]}});
 assert.match(message,/INVALID_CONVERSION_VALUE/);assert.match(message,/events\[0\].conversionValue/);assert.doesNotMatch(message,/secret|40722882726|hash|-25/);
});
test('malformed and untrusted diagnostic fields are not echoed',()=>{
 assert.doesNotMatch(adsErrorSummary(400,{error:{status:'secret token',details:[{reason:'secret token',fieldViolations:[{field:'secret.client-name'}]}]}}),/secret|client-name/);
 assert.match(adsErrorSummary(502,null),/HTTP 502/);
});
