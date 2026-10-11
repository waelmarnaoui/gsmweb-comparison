import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('upload claims are atomic, unique, consent-bound, audited and server-only',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;insert into auth.users values('${admin}');select set_config('app.user_id','${admin}',false);grant usage on schema auth to authenticated,service_role;`);
  await db.exec(await readFile(new URL('../supabase/PROPOSED.sql',import.meta.url),'utf8'));
  await db.exec(`insert into ga_admins values('${admin}')`);
  await db.exec(await readFile(new URL('../supabase/CLIENT-CONSENT-PROPOSED.sql',import.meta.url),'utf8'));
  const migration=await readFile(new URL('../supabase/ADS-UPLOAD-PROPOSED.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
  await db.exec(`select ga_record_client_consent('dmjunqbncyrinykbbmfk','client','+40712345678','granted','not_asked',now()-interval '1 minute','store-google-v1')`);
  const items=(payments:string[],consent='1')=>payments.map(payment=>({payment_id:'dmjunqbncyrinykbbmfk:'+payment,payload_hash:'a'.repeat(64),consent_id:consent}));
  const claim=async(payments:string[],consent='1',actor=admin)=>db.query<{batch:string}>('select ga_claim_ads_upload($1,$2::jsonb) as batch',[actor,JSON.stringify(items(payments,consent))]);
  await db.exec('set role authenticated');await assert.rejects(claim(['a']),/permission denied/);await assert.rejects(db.exec("insert into ga_ads_uploads(account_id) values('2050434247')"),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(claim(['a']),/permission denied/);
  await db.exec('reset role;set role service_role');const batch=(await claim(['a','b'])).rows[0].batch;assert.equal(typeof batch,'string');
  await assert.rejects(claim(['c','a']),/duplicate key/);assert.equal((await db.query("select * from ga_ads_uploads where payment_id like '%:c'")).rows.length,0);
  await assert.rejects(claim(['a']),/duplicate key/);await assert.rejects(claim(['c'],'1','00000000-0000-0000-0000-000000000002'),/Forbidden/);
  await assert.rejects(db.query('select ga_claim_ads_upload($1,null)',[admin]),/Invalid batch/);
  await db.exec(`reset role;select ga_record_client_consent('dmjunqbncyrinykbbmfk','client','+40712345678','withdrawn','not_asked',now()-interval '1 minute','store-google-v1');set role service_role;`);
  await assert.rejects(claim(['c'],'1'),/Consent changed/);await assert.rejects(claim(['c'],'2'),/Consent changed/);
  await db.exec("update ga_ads_uploads set state='unknown'");await assert.rejects(claim(['a']),/Consent changed/);
  await db.exec('reset role;set role authenticated');assert.equal((await db.query('select * from ga_ads_uploads')).rows.length,2);await assert.rejects(db.exec('delete from ga_ads_uploads'),/permission denied/);
  await db.exec("reset role;select set_config('app.user_id','00000000-0000-0000-0000-000000000002',false);set role authenticated");assert.equal((await db.query('select * from ga_ads_uploads')).rows.length,0);
  await db.exec('reset role');assert.equal((await db.query("select * from ga_audit where entity='ga_ads_uploads'")).rows.length,4);
 }finally{await db.close();}
});
