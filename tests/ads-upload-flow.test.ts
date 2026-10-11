import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedManifest,parseManifest,type AdsRow} from '../lib/ads-review';
import {uploadReviewed,type UploadPorts} from '../lib/ads-upload-flow';
import {providerUploadStatus} from '../lib/ads-status';
import {CONSENT_SCRIPT_VERSION} from '../lib/client-consent';
const row:AdsRow={ready:true,paymentId:'dmjunqbncyrinykbbmfk:payment',conversionTime:'2026-09-25T09:00:00Z',amount:123.45,phone:'+40712345678',gclid:'click',timeBasis:'website_click',consent:{id:'1',crm_project_ref:'dmjunqbncyrinykbbmfk',client_id:'client',phone:'+40712345678',ad_user_data:'granted',ad_personalization:'not_asked',obtained_at:'2026-09-25T10:00:00Z',recorded_at:'2026-09-25T10:00:00Z',recorded_by:'admin',script_version:CONSENT_SCRIPT_VERSION}};
function setup(){
 const calls:string[]=[],ports:UploadPorts={read:async()=>{calls.push('read');return [row];},validate:async payload=>{assert.equal(payload.validateOnly,true);calls.push('validate');},claim:async()=>{calls.push('claim');return 'batch';},submit:async payload=>{assert.equal(payload.validateOnly,false);calls.push('submit');return {requestId:'receipt',warnings:false};},record:async(_batch,state)=>{calls.push(state);}};
 return {ports,calls};
}
test('manual send validates, rereads, reserves once, submits and records receipt',async()=>{
 const {ports,calls}=setup(),result=await uploadReviewed(reviewedManifest([row]),ports);
 assert.deepEqual(calls,['read','validate','read','claim','submit','submitted']);assert.equal(result.state,'submitted');
});
test('rejected validation does not reserve or upload',async()=>{
 const {ports,calls}=setup();ports.validate=async()=>{throw new Error('rejected');};
 await assert.rejects(uploadReviewed(reviewedManifest([row]),ports),/rejected/);assert.deepEqual(calls,['read']);
});
test('changed profit or withdrawn consent during validation blocks upload',async()=>{
 for(const change of [{...row,amount:99},{...row,ready:false}]){const {ports,calls}=setup();let n=0;ports.read=async()=>++n===1?[row]:[change];await assert.rejects(uploadReviewed(reviewedManifest([row]),ports),/changed/);assert.deepEqual(calls,['validate']);}
});
test('duplicate reservation cannot reach Google and new unreviewed rows are excluded',async()=>{
 const {ports,calls}=setup();ports.claim=async()=>{throw new Error('duplicate');};await assert.rejects(uploadReviewed(reviewedManifest([row]),ports),/duplicate/);assert.equal(calls.includes('submit'),false);
 const second=setup();second.ports.read=async()=>[row,{...row,paymentId:'new'}];second.ports.submit=async payload=>{assert.equal(payload.events.length,1);assert.equal(payload.events[0].transactionId,row.paymentId);return {requestId:'receipt',warnings:false};};await uploadReviewed(reviewedManifest([row]),second.ports);
});
test('timeout and failed receipt write never retry a Google submission',async()=>{
 const {ports,calls}=setup();ports.submit=async()=>{calls.push('submit');throw new Error('timeout');};const result=await uploadReviewed(reviewedManifest([row]),ports);assert.equal(result.state,'unknown');assert.deepEqual(calls,['read','validate','read','claim','submit','unknown']);
 const second=setup();second.ports.record=async()=>{throw new Error('database');};assert.equal((await uploadReviewed(reviewedManifest([row]),second.ports)).state,'unknown');assert.equal(second.calls.filter(call=>call==='submit').length,1);
});
test('manifest requires confirmation and rejects duplicate or malformed entries',()=>{
 const entries=reviewedManifest([row]);assert.deepEqual(parseManifest({confirmed:true,items:entries}),entries);
 for(const body of [{confirmed:false,items:entries},{confirmed:true,items:[]},{confirmed:true,items:[...entries,...entries]},{confirmed:true,items:[{paymentId:'x',fingerprint:'bad'}]}])assert.throws(()=>parseManifest(body));
});
test('provider results distinguish partial, failed and successful ingestion',()=>{
 const status=(requestStatus:string)=>({requestStatusPerDestination:[{destination:{operatingAccount:{accountId:'2050434247'},productDestinationId:'7835048106'},requestStatus,errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_CLICK_NOT_FOUND'}]}}]});
 assert.equal(providerUploadStatus(status('SUCCESS')).state,'success');assert.equal(providerUploadStatus(status('PARTIAL_SUCCESS')).state,'partial');assert.equal(providerUploadStatus(status('FAILED')).state,'failed');assert.equal(providerUploadStatus(status('PROCESSING')).state,'submitted');assert.throws(()=>providerUploadStatus({}));assert.throws(()=>providerUploadStatus({requestStatusPerDestination:[]}));
});
