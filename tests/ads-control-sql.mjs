import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),actor='00000000-0000-0000-0000-000000000001',account='2050434247',ad=`customers/${account}/adGroupAds/1~2`;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${actor}');grant usage on schema public to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/ADS-CONTROL-PROPOSED.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');
 await db.query('insert into ga_ads_control(account_id) values($1)',[account]);
 assert.equal((await db.query('select global_paused from ga_ads_control')).rows[0].global_paused,true);
 const first=(await db.query('select ga_ads_control_lock($1) as token',[account])).rows[0].token;assert.ok(first);
 assert.equal((await db.query('select ga_ads_control_lock($1) as token',[account])).rows[0].token,null);
 assert.equal((await db.query('select ga_ads_control_renew($1,$2) as ok',[account,first])).rows[0].ok,true);
 await db.query('select ga_ads_control_unlock($1,$2)',[account,actor]);assert.equal((await db.query('select ga_ads_control_lock($1) as token',[account])).rows[0].token,null);
 await db.query('select ga_ads_control_unlock($1,$2)',[account,first]);assert.ok((await db.query('select ga_ads_control_lock($1) as token',[account])).rows[0].token);
 const insert=()=>db.query("insert into ga_ads_actions(account_id,kind,resource_name,before_value,after_value,source,created_by,reason,idempotency_key) values($1,'ad_status',$2,'ENABLED','PAUSED','owner',$3,'test',$4) returning id",[account,ad,actor,'a'.repeat(64)]);
 const action=(await insert()).rows[0].id;await assert.rejects(insert(),/unique/);
 await assert.rejects(db.query("update ga_ads_actions set state='approved' where id=$1",[action]),/check constraint/);
 await db.query("update ga_ads_actions set state='approved',approved_by=$2 where id=$1",[action,actor]);
 await assert.rejects(db.query("insert into ga_ads_actions(account_id,kind,resource_name,before_value,after_value,source,created_by,approved_by,reason,idempotency_key,state) values($1,'ad_status',$2,'ENABLED','PAUSED','owner',$3,$3,'duplicate live intent',$4,'approved')",[account,ad,actor,'b'.repeat(64)]),/unique/);
 assert.ok((await db.query('select count(*)::int as n from ga_ads_action_events')).rows[0].n>=3);
 await assert.rejects(db.query('delete from ga_ads_action_events'),/permission denied/);
 await assert.rejects(db.query("insert into ga_ads_actions(account_id,kind,resource_name,before_value,after_value,source,created_by,reason,idempotency_key) values($1,'budget_decrease',$2,'1000000','2000000','owner',$3,'bad increase',$4)",[account,`customers/${account}/campaignBudgets/3`,actor,'c'.repeat(64)]),/check constraint/);
 for(const role of ['anon','authenticated']){
  await db.exec('reset role;set role '+role);
  for(const table of ['ga_ads_control','ga_ads_actions','ga_ads_product_ads','ga_ads_control_workers','ga_ads_action_events','ga_ads_worker_pairings'])await assert.rejects(db.query('select * from '+table),/permission denied/);
  await assert.rejects(db.query('select ga_ads_control_lock($1)',[account]),/permission denied/);
  await assert.rejects(db.query("update ga_ads_actions set state='approved'"),/permission denied/);
 }
 await db.exec('reset role');
 const secured=await db.query("select count(*)::int as n from pg_class where relname in('ga_ads_control','ga_ads_actions','ga_ads_product_ads','ga_ads_control_workers','ga_ads_action_events','ga_ads_worker_pairings') and relrowsecurity");assert.equal(secured.rows[0].n,6);
 await db.exec('set role service_role');
 const pairing='00000000-0000-0000-0000-000000000010';
 await db.query("insert into ga_ads_worker_pairings(id,account_id,token_hash,deployment_id,canary_campaign_id,created_by) values($1,$2,$3,'laptop-test','1',$4)",[pairing,account,'d'.repeat(64),actor]);
 const claim=()=>db.query('update ga_ads_worker_pairings set claimed_at=now() where id=$1 and claimed_at is null and expires_at>now() returning id',[pairing]);assert.equal((await claim()).rows.length,1);assert.equal((await claim()).rows.length,0);
 await db.query('update ga_ads_worker_pairings set token_hash=$2 where id=$1',[pairing,'e'.repeat(64)]);
 assert.equal((await db.query('select id from ga_ads_worker_pairings where token_hash=$1',['d'.repeat(64)])).rows.length,0);
 const capability=()=>db.query('select p.id from ga_ads_worker_pairings p join ga_ads_control c on c.account_id=p.account_id and c.recovery_deployment_id=p.deployment_id where p.token_hash=$1 and p.claimed_at is not null',['e'.repeat(64)]);
 assert.equal((await capability()).rows.length,0);await db.query("update ga_ads_control set recovery_deployment_id='laptop-test' where account_id=$1",[account]);assert.equal((await capability()).rows.length,1);
 await db.exec('reset role');
 await db.exec(await readFile(new URL('../supabase/SEARCH-GROWTH-PROPOSED.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');
 const protectedRow=(await db.query('select protect_existing_ads,stock_enabled,global_paused from ga_ads_control')).rows[0];assert.deepEqual(protectedRow,{protect_existing_ads:true,stock_enabled:false,global_paused:true});
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);for(const table of ['ga_ads_search_runs','ga_ads_growth_notifications'])await assert.rejects(db.query('select * from '+table),/permission denied/);}
 await db.exec('reset role;set role service_role');
 await db.query("insert into ga_ads_growth_notifications(notification_key,account_id,opportunity_id,kind,details) values($1,$2,'opportunity','new_draft_prepared','{}')",['f'.repeat(64),account]);
 await assert.rejects(db.query('delete from ga_ads_growth_notifications'),/permission denied/);
 await assert.rejects(db.query("update ga_ads_growth_notifications set details='{}'"),/permission denied/);
 await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/AUTO-PUBLISH-PROPOSED.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');assert.equal((await db.query('select auto_publish_enabled from ga_ads_control')).rows[0].auto_publish_enabled,false);
 await assert.rejects(db.query('update ga_ads_control set auto_publish_enabled=true'),/check constraint/);
 const pubid='1'.repeat(64),plan={key:pubid,account,campaignId:'1',groupName:'GSMWEB-AI-test',model:'Recorded',partType:'battery',productId:'p',stock:{},draft:{},keywords:[],copyRulesVersion:'test'};
 await db.query('insert into ga_ads_publications(id,account_id,plan) values($1,$2,$3)',[pubid,account,JSON.stringify(plan)]);
 await assert.rejects(db.query('insert into ga_ads_publications(id,account_id,plan) values($1,$2,$3)',[pubid,account,JSON.stringify(plan)]),/unique/);
 await assert.rejects(db.query("update ga_ads_publications set plan=jsonb_set(plan,'{model}','\"Different\"') where id=$1",[pubid]),/immutable/);
 await db.query("update ga_ads_publications set state='creating',pending_operation='create',version=1 where id=$1 and version=0",[pubid]);assert.equal((await db.query('select count(*)::int as n from ga_ads_publication_events')).rows[0].n,2);
 await assert.rejects(db.query('delete from ga_ads_publication_events'),/permission denied/);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);for(const table of ['ga_ads_publications','ga_ads_publication_events'])await assert.rejects(db.query('select * from '+table),/permission denied/);await assert.rejects(db.query('update ga_ads_control set auto_publish_enabled=true'),/permission denied/);}
 await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/CONNECTIONS-PROPOSED.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/AI-ADVISOR-CONNECTION-PROPOSED.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');await db.query("insert into ga_connections(id,encrypted_credentials,metadata,connected_by) values('ai_advisor','TEST_CIPHERTEXT','{\"provider\":\"anthropic\"}',$1)",[actor]);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(db.query('select encrypted_credentials from ga_connections'),/permission denied/);}
 console.log('PASS: control SQL executed in local PostgreSQL; default pause, exclusive fenced leases, idempotency, exact approval constraints, duplicate live intent blocked, budget increases rejected, append-only audit, RLS and browser-role access denial. No production data changed.');
}finally{await db.close();}
