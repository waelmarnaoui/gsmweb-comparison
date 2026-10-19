import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),actor='00000000-0000-4000-8000-000000000001',account='2050434247';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${actor}');create table ga_ads_control(account_id text primary key);insert into ga_ads_control values('${account}');create table ga_audit(id bigint generated always as identity,actor uuid,action text,entity text,record_id text,details jsonb);grant select,insert on ga_audit to service_role;grant usage,select on sequence ga_audit_id_seq to service_role;`);
 await db.exec(await readFile('supabase/BULK-ADS-PROPOSED.sql','utf8'));
 const insert=`insert into ga_bulk_ad_groups(account_id,actor,campaign_id,family,service,draft,content_hash) values('${account}','${actor}','1','iphone','battery','{"ads":[{},{},{}]}','${'a'.repeat(64)}') returning id`;
 await db.exec('set role service_role');const id=(await db.query(insert)).rows[0].id;assert.equal((await db.query('select count(*)::int n from ga_audit')).rows[0].n,1);
 await assert.rejects(db.query(insert),/duplicate key/);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);for(const sql of ['select * from ga_bulk_ad_groups',insert,`update ga_bulk_ad_groups set state='submitted'`,`delete from ga_bulk_ad_groups`])await assert.rejects(db.exec(sql),/permission denied/);}
 await db.exec('reset role;set role service_role');await assert.rejects(db.exec(`update ga_bulk_ad_groups set state='submitted',version=1 where id='${id}'`),/Invalid bulk state/);
 await db.exec(`update ga_bulk_ad_groups set state='validating',version=1 where id='${id}';update ga_bulk_ad_groups set state='submitting',version=2 where id='${id}';update ga_bulk_ad_groups set state='uncertain',version=3 where id='${id}';`);
 await assert.rejects(db.exec(`update ga_bulk_ad_groups set state='draft',version=4 where id='${id}'`),/Invalid bulk state/);
 await assert.rejects(db.exec(`update ga_bulk_ad_groups set draft='{"ads":[{},{}]}',version=4 where id='${id}'`),/Submitted copy is immutable/);
 await db.exec('reset role');assert.equal((await db.query("select relrowsecurity from pg_class where relname='ga_bulk_ad_groups'")).rows[0].relrowsecurity,true);
 console.log('Bulk SQL: private grants, RLS, audit, uniqueness, immutable intent and transitions passed.');
}finally{await db.close();}
