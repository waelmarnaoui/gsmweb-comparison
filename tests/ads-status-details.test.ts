import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerUploadStatus} from '../lib/ads-status';
const destination={operatingAccount:{accountId:'2050434247'},productDestinationId:'7835048106'};
test('partial batch preserves Google totals and separate error/warning counts',()=>{
 const result=providerUploadStatus({requestStatusPerDestination:[{destination,requestStatus:'PARTIAL_SUCCESS',eventsIngestionStatus:{recordCount:'11'},errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_CLICK_NOT_FOUND',recordCount:'10'}]},warningInfo:{warningCounts:[{reason:'PROCESSING_WARNING_REASON_INTERNAL_ERROR',recordCount:'1'}]}}]});
 assert.equal(result.state,'partial');assert.equal(result.recordCount,11);assert.equal(result.errors[0].count,10);assert.equal(result.warnings[0].count,1);assert.equal(result.warning,true);
});
test('success can include warnings and absent counts remain unknown',()=>{
 const result=providerUploadStatus({requestStatusPerDestination:[{destination,requestStatus:'SUCCESS',warningInfo:{warningCounts:[{reason:'PROCESSING_WARNING_REASON_INTERNAL_ERROR'}]}}]});
 assert.equal(result.state,'success');assert.equal(result.recordCount,null);assert.equal(result.warnings[0].count,null);
});
