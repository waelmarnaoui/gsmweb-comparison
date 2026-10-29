import {test} from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
import {PMAX_SERVICES,pmaxOperations,pmaxDraftSchema,pmaxHash,type PmaxDraft,type PmaxRow} from '../lib/pmax/model';
import {publishPmax} from '../lib/pmax/engine';import {ControlProviderError} from '../lib/ads-control/google';
const account='2050434247',actor='00000000-0000-0000-0000-000000000001';
const draft:PmaxDraft={settings:{name:'GSMWeb PMax',dailyUsd:52,location:'geoTargetConstants/123',locationLabel:'Drumul Taberei, Bucharest, Romania',landscape:`customers/${account}/assets/1`,square:`customers/${account}/assets/2`,logo:`customers/${account}/assets/3`,services:[...PMAX_SERVICES],models:'Samsung S22 S23 S24; iPhone; Motorola Xiaomi Oppo OnePlus',finalUrl:'https://gsmweb.site/',businessName:'GSMWeb',conversionId:'7835048106'},copy:{groups:PMAX_SERVICES.map(service=>({service,name:'GSMWeb '+service,headlines:['GSMWeb','Inlocuire Piese Telefon','Drumul Taberei 138'],longHeadlines:['Inlocuire componente pentru telefon la GSMWeb Drumul Taberei'],descriptions:['Confirma modelul si eligibilitatea cu echipa GSMWeb.','Cere oferta pentru telefonul tau.'],themes:['inlocuire display samsung s22','schimbare baterie iphone']}))}};
test('PMax covers seven repairs with enabled groups, presence, isolated USD budget and CRM goal',()=>{
 const ops=pmaxOperations(account,draft,'id') as any[];
 assert.equal(ops.filter(o=>o.assetGroupOperation).length,7);
 assert.ok(ops.filter(o=>o.assetGroupOperation).every(o=>o.assetGroupOperation.create.status==='ENABLED'));
 const campaign=ops.find(o=>o.campaignOperation).campaignOperation.create;assert.equal(campaign.status,'ENABLED');assert.equal(campaign.geoTargetTypeSetting.positiveGeoTargetType,'PRESENCE');assert.equal(campaign.urlExpansionOptOut,true);assert.equal(campaign.advertisingChannelType,'PERFORMANCE_MAX');
 assert.equal(ops[0].campaignBudgetOperation.create.amountMicros,'52000000');assert.equal(ops[0].campaignBudgetOperation.create.explicitlyShared,false);
 assert.ok(ops.some(o=>o.campaignAssetOperation?.create.fieldType==='LOGO'));assert.ok(ops.some(o=>o.campaignAssetOperation?.create.fieldType==='BUSINESS_NAME'));
 assert.equal(ops.filter(o=>o.assetGroupAssetOperation?.create.fieldType==='MARKETING_IMAGE').length,7);
 assert.equal(ops.find(o=>o.customConversionGoalOperation).customConversionGoalOperation.create.conversionActions[0],`customers/${account}/conversionActions/7835048106`);
 assert.ok(!ops.some(o=>o.campaignOperation?.update));
 assert.notEqual(pmaxHash(account,draft),pmaxHash(account,{...draft,settings:{...draft.settings,dailyUsd:53}}));
});
test('PMax rejects missing category, invalid copy, offsite URL and foreign-account assets',()=>{
 assert.equal(pmaxDraftSchema.safeParse({...draft,copy:{groups:draft.copy.groups.slice(1)}}).success,false);
 assert.throws(()=>pmaxOperations(account,{...draft,settings:{...draft.settings,logo:'customers/9999999999/assets/1'}},'id'));
 assert.equal(pmaxDraftSchema.safeParse({...draft,settings:{...draft.settings,finalUrl:'https://evil.test'}}).success,false);
 assert.equal(pmaxDraftSchema.safeParse({...draft,copy:{groups:[{...draft.copy.groups[0],headlines:['{KeyWord:test}','ok','GSMWeb']}]}}).success,false);
});
function fixture(){let row:PmaxRow={id:'id',actor,account_id:account,input:draft.settings,draft,content_hash:pmaxHash(account,draft),state:'draft',version:0,result:null,error_code:null,created_at:''},writes=0;const states:string[]=[];const input={actor,account,hash:row.content_hash!,confirmed:true,load:async()=>row,transition:async(before:PmaxRow,state:string,patch={})=>{assert.equal(before.version,row.version);row={...row,...patch,state,version:row.version+1};states.push(state);return row;},lock:async()=> 'lock',fence:async()=>{},unlock:async()=>{},guard:async()=>{},validate:async()=>pmaxOperations(account,draft,'id'),create:async()=>{writes++;assert.equal(row.state,'submitting');return {status:'ENABLED'};}};return {input,get:()=>row,writes:()=>writes,states};}
test('enabled publication requires saved hash and approval, reserves before write and never resends',async()=>{
 const f=fixture();await publishPmax(f.input);assert.deepEqual(f.states,['validating','submitting','submitted']);assert.equal(f.writes(),1);await publishPmax(f.input);assert.equal(f.writes(),1);
 for(const patch of [{confirmed:false},{hash:'stale'},{actor:'other'}])await assert.rejects(publishPmax({...fixture().input,...patch}));
 const rejected=fixture();await assert.rejects(publishPmax({...rejected.input,validate:async()=>{throw new ControlProviderError('policy_rejected');}}));assert.equal(rejected.writes(),0);assert.equal(rejected.get().state,'rejected');
 const uncertain=fixture();await assert.rejects(publishPmax({...uncertain.input,create:async()=>{throw new ControlProviderError('timeout',true);}}));assert.equal(uncertain.get().state,'uncertain');await publishPmax(uncertain.input);assert.equal(uncertain.writes(),0);
});
test('PMax storage denies browser access and enforces irreversible submission intent',async()=>{
 const db=new PGlite();try{await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${actor}');create table ga_audit(actor uuid,action text,entity text,record_id text,details jsonb);`);await db.exec(await readFile(new URL('../supabase/PMAX-WORKSPACE-PROPOSED.sql',import.meta.url),'utf8'));
 const result=await db.query<{id:string}>("insert into ga_pmax_drafts(account_id,actor,input) values($1,$2,'{}') returning id",[account,actor]),id=result.rows[0].id;
 await assert.rejects(db.query("update ga_pmax_drafts set state='submitting',version=version+1 where id=$1",[id]),/Invalid PMax/);
 for(const state of ['draft','validating','submitting','submitted'])await db.query('update ga_pmax_drafts set state=$1,version=version+1 where id=$2',[state,id]);
 await assert.rejects(db.query("update ga_pmax_drafts set state='draft',version=version+1 where id=$1",[id]),/Invalid PMax/);
 await db.exec('set role authenticated');await assert.rejects(db.exec('select * from ga_pmax_drafts'),/permission denied/);
 }finally{await db.close();}
});
