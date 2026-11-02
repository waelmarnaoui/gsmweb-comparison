import {test} from 'node:test';import assert from 'node:assert/strict';
import {pmaxGoogleDiagnostics} from '../lib/pmax/google-errors';
test('PMax surfaces REST unknown-field identifiers without leaking the payload or message',()=>{
 const codes=pmaxGoogleDiagnostics({error:{status:'INVALID_ARGUMENT',message:'Invalid JSON payload received. Unknown name "urlExpansionOptOut" at mutate_operations[2].campaign_operation.create. private-token customer@example.test'}});
 assert.deepEqual(codes,['INVALID_ARGUMENT','UNKNOWN_FIELD:urlExpansionOptOut']);
 assert.doesNotMatch(codes.join(' '),/private-token|customer@example/);
});
test('PMax exposes mutation error locations and previously unlisted enum codes safely',()=>{
 const codes=pmaxGoogleDiagnostics({error:{status:'INVALID_ARGUMENT',details:[{errors:[{errorCode:{assetAutomationSettingError:'ASSET_AUTOMATION_TYPE_NOT_SUPPORTED'},message:'secret',location:{fieldPathElements:[{fieldName:'mutateOperations',index:2},{fieldName:'campaignOperation'},{fieldName:'create'},{fieldName:'assetAutomationSettings',index:0}]}}]},{fieldViolations:[{field:'mutate_operations[2].campaign_operation.create',description:'secret'}]}]}});
 assert.ok(codes.includes('ASSET_AUTOMATION_TYPE_NOT_SUPPORTED'));
 assert.ok(codes.includes('FIELD:mutateOperations[2].campaignOperation.create.assetAutomationSettings[0]'));
 assert.doesNotMatch(codes.join(' '),/secret/);
 assert.deepEqual(pmaxGoogleDiagnostics(null),[]);
});
