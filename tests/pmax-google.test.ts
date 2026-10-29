import {test} from 'node:test';import assert from 'node:assert/strict';
import {pmaxGoogle} from '../lib/pmax/google';import {pmaxHash,type PmaxDraft,type PmaxRow} from '../lib/pmax/model';
import {ControlProviderError} from '../lib/ads-control/google';
const account='2050434247',root=`customers/${account}`;
const draft:PmaxDraft={settings:{name:'GSMWeb',dailyUsd:52,location:'geoTargetConstants/123',locationLabel:'Drumul Taberei',landscape:root+'/assets/1',square:root+'/assets/2',logo:root+'/assets/2',services:['display'],models:'Samsung S22 S23 S24 iPhone Motorola Xiaomi Oppo OnePlus',finalUrl:'https://gsmweb.site/',businessName:'GSMWeb',conversionId:'7835048106'},copy:{groups:[{service:'display',name:'Display',headlines:['GSMWeb','Inlocuire Display','Schimbare Display'],longHeadlines:['Inlocuire display telefon la GSMWeb Drumul Taberei'],descriptions:['Confirma modelul si disponibilitatea.','Cere o oferta pentru telefonul tau.'],themes:['inlocuire display samsung s22']}]}};
const row={id:'id',account_id:account,actor:'owner',state:'submitting',version:2,input:draft.settings,draft,content_hash:pmaxHash(account,draft),result:null,error_code:null,created_at:''} satisfies PmaxRow;
function mock(failReadback=false){const calls:any[]=[];const api=pmaxGoogle({account,token:async()=> 'private-test-token',fetcher:async(url,init)=>{
 const body=JSON.parse(String(init?.body));calls.push({url,body});
 if(body.query){let results:any[]=[];
 if(body.query.includes('FROM customer '))results=[{customer:{id:account,currencyCode:'USD'}}];
 else if(body.query.includes('FROM asset '))results=[{asset:{resourceName:root+'/assets/1',imageAsset:{fullSize:{widthPixels:'1200',heightPixels:'628',url:'https://example.test/image.jpg'}}}},{asset:{resourceName:root+'/assets/2',imageAsset:{fullSize:{widthPixels:'1200',heightPixels:'1200',url:'https://example.test/square.jpg'}}}}];
 else if(body.query.includes('FROM geo_target_constant'))results=[{geoTargetConstant:{resourceName:'geoTargetConstants/123',canonicalName:'Drumul Taberei',targetType:'Neighborhood'}}];
 else if(body.query.includes('FROM conversion_action'))results=[{conversionAction:{id:'7835048106',status:'ENABLED',type:'UPLOAD_CLICKS'}}];
 else if(body.query.includes('FROM campaign')){if(failReadback)return Response.json({error:{status:'RESOURCE_EXHAUSTED'}},{status:429});results=[{campaign:{resourceName:root+'/campaigns/55',status:'ENABLED'}}];}
 return Response.json({results});
 }
 if(body.validateOnly)return Response.json({});return Response.json({mutateOperationResponses:body.mutateOperations.map((op:any)=>op.campaignOperation?{campaignResult:{resourceName:root+'/campaigns/55'}}:{})});
 }});return {api,calls};}
test('PMax transport verifies USD, location, all images, conversion action then validates and creates enabled atomically',async()=>{
 const {api,calls}=mock(),operations=await api.validate(draft,'id');assert.equal(calls.filter(c=>c.body.validateOnly===false).length,0);const result=await api.create(row,operations);assert.equal(result.status,'ENABLED');assert.equal(result.campaign,root+'/campaigns/55');
 const changes=calls.filter(c=>c.body.mutateOperations);assert.equal(changes.length,2);assert.equal(changes[0].body.validateOnly,true);assert.equal(changes[1].body.validateOnly,false);assert.equal(changes[1].body.partialFailure,false);assert.deepEqual(changes[0].body.mutateOperations,changes[1].body.mutateOperations);
 const bad=mock();await assert.rejects(bad.api.validate({...draft,settings:{...draft.settings,location:'geoTargetConstants/999'}},'id'),/location/);assert.equal(bad.calls.filter(c=>c.body.mutateOperations).length,0);
});
test('failed readback after acknowledged campaign creation remains uncertain, not a retryable rejection',async()=>{
 const {api,calls}=mock(true),operations=await api.validate(draft,'id');await assert.rejects(api.create(row,operations),(error:unknown)=>error instanceof ControlProviderError&&error.uncertain);assert.equal(calls.filter(c=>c.body.validateOnly===false).length,1);
});
