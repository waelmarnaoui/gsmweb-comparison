import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdPolicyReader} from '../lib/ads-policy-reader';
const accountId='2050434247';
const row={campaign:{id:'1'},adGroup:{id:'2'},adGroupAd:{resourceName:`customers/${accountId}/adGroupAds/2~3`,status:'PAUSED',ad:{id:'3',responsiveSearchAd:{headlines:[{text:'Recorded headline'}],descriptions:[{text:'Recorded description'}]}},policySummary:{approvalStatus:'DISAPPROVED',reviewStatus:'REVIEWED',policyTopicEntries:[{topic:'THIRD_PARTY_TECHNICAL_SUPPORT',type:'PROHIBITED'}]}}};
const options={accountId,token:async()=>'private-token'};
test('policy reader uses only search, follows pages and preserves actual review feedback',async()=>{
 let calls=0;const reader=createAdPolicyReader({...options,fetcher:async(url,init)=>{
  assert.match(String(url),/googleAds:search$/);const body=JSON.parse(String(init?.body));assert.equal(body.operations,undefined);assert.match(body.query,/policy_summary.approval_status/);calls++;
  return Response.json(calls===1?{results:[row],nextPageToken:'next'}:{results:[]});
 }});
 const report=await reader.collect();assert.equal(calls,2);assert.equal(report.ads[0].approvalStatus,'DISAPPROVED');assert.equal(report.ads[0].topics[0].topic,'THIRD_PARTY_TECHNICAL_SUPPORT');assert.equal(report.ads[0].status,'PAUSED');
});
test('missing summary stays unknown and does not fabricate approval',async()=>{
 const value={...row,adGroupAd:{...row.adGroupAd,policySummary:undefined}};
 const report=await createAdPolicyReader({...options,fetcher:async()=>Response.json({results:[value]})}).collect();assert.equal(report.ads[0].approvalStatus,'UNKNOWN');assert.equal(report.ads[0].reviewStatus,'UNKNOWN');
});
test('duplicate, wrong-account, partial and repeated-page responses abort the report',async()=>{
 const wrong={...row,adGroupAd:{...row.adGroupAd,resourceName:'customers/9999999999/adGroupAds/2~3'}};
 for(const body of [{results:[row,row]},{results:[wrong]},{results:[row],partialFailureError:{}},{results:[],nextPageToken:'same'}])await assert.rejects(createAdPolicyReader({...options,fetcher:async()=>Response.json(body)}).collect());
});
test('provider errors never expose response bodies or credentials',async()=>{
 await assert.rejects(createAdPolicyReader({...options,fetcher:async()=>new Response('private provider details',{status:403})}).collect(),error=>error instanceof Error&&!error.message.includes('private'));
});
