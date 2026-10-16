import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadControlResources,resourceReadError} from '../lib/ads-control/resource-loader';
import {createControlGoogle,ControlProviderError,safeGoogleCodes} from '../lib/ads-control/google';
test('campaign failure cannot hide successfully loaded live ads',async()=>{
 const r=await loadControlResources(async()=>({ads:[{id:'actual-ad'}],fetchedAt:'2026-10-16T12:00:00Z'}),async()=>{throw new ControlProviderError('google_request_rejected',false,['PERMISSION_DENIED'],403);});
 assert.equal(r.ads.length,1);assert.equal(r.adsComplete,true);assert.equal(r.campaignsComplete,false);assert.match(r.errors[0].message,/PERMISSION_DENIED/);
});
test('failed ad read stays unavailable while verified campaigns remain usable',async()=>{
 const r=await loadControlResources(async()=>{throw new Error('PRIVATE_PROVIDER_DATA');},async()=>[{id:'actual-campaign'}]);assert.equal(r.adsComplete,false);assert.equal(r.campaigns.length,1);assert.equal(JSON.stringify(r).includes('PRIVATE_PROVIDER_DATA'),false);
});
test('a synchronous configuration error is isolated without fabricating an empty successful report',async()=>{
 const r=await loadControlResources(async()=>({ads:[],fetchedAt:'actual'}),()=>{throw new ControlProviderError('google_control_configuration_missing');});assert.equal(r.adsComplete,true);assert.equal(r.campaignsComplete,false);assert.equal(r.errors.length,1);
});
test('zero or missing daily budgets do not discard verified campaign identities and cannot be edited',async()=>{
 const rows=['0',undefined,'1000000'].map((amountMicros,i)=>({campaign:{resourceName:`customers/2050434247/campaigns/${i+1}`,name:'Recorded campaign',status:'PAUSED',campaignBudget:`customers/2050434247/campaignBudgets/${i+1}`},campaignBudget:{amountMicros,referenceCount:'1'}}));
 const api=createControlGoogle({accountId:'2050434247',developerToken:'test',token:async()=>'test',fetcher:async()=>Response.json({results:rows})});
 const c=await api.campaigns();assert.equal(c.length,3);assert.equal(c[0].budgetMicros,'0');assert.equal(c[1].budgetMicros,null);assert.deepEqual(c.map(x=>x.budgetEditable),[false,false,true]);
});
test('Google diagnostics retain only enum codes, never messages, triggers or arbitrary fields',()=>{
 const body={error:{status:'INVALID_ARGUMENT',message:'SECRET_VALUE',details:[{errors:[{errorCode:{queryError:'UNRECOGNIZED_FIELD'},message:'SECRET_VALUE',trigger:{stringValue:'SECRET_VALUE'}},{errorCode:{authorizationError:'CUSTOMER_NOT_ENABLED',unknown:'SECRET_VALUE'}}]}]}};
 assert.deepEqual(safeGoogleCodes(body),['INVALID_ARGUMENT','UNRECOGNIZED_FIELD','CUSTOMER_NOT_ENABLED']);assert.equal(resourceReadError(new Error('SECRET_VALUE')).includes('SECRET_VALUE'),false);
});
