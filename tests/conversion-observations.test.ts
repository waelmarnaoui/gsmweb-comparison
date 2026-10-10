import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('first paid-customer match is immutable across retries and protected by RLS',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;insert into auth.users values('${admin}');select set_config('app.user_id','${admin}',false);grant usage on schema auth to authenticated,service_role;`);
  await db.exec(await readFile(new URL('../supabase/PROPOSED.sql',import.meta.url),'utf8'));
  await db.exec(`insert into ga_admins values('${admin}');insert into ga_devices(id,name,token_hash) values('00000000-0000-0000-0000-000000000002','Test','test');insert into ga_calls(id,device_id,external_id,phone,started_at,duration_seconds,direction) values('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','call','+40712345678','2026-10-10T06:00:00Z',0,'incoming');`);
  const sql=await readFile(new URL('../supabase/CONVERSION-FIRST-MATCH-PROPOSED.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  await db.exec('set role service_role');
  const insert=`insert into ga_conversion_observations(payment_transaction_id,call_id,crm_paid_date) values('crm:payment','00000000-0000-0000-0000-000000000003','2026-10-10') on conflict(payment_transaction_id) do nothing`;
  await db.exec(insert);
  const first=(await db.query<{first_matched_at:Date}>('select first_matched_at from ga_conversion_observations')).rows[0].first_matched_at;
  await db.exec(insert);assert.equal((await db.query<{first_matched_at:Date}>('select first_matched_at from ga_conversion_observations')).rows[0].first_matched_at.toISOString(),first.toISOString());
  await assert.rejects(db.exec("insert into ga_conversion_observations(payment_transaction_id,call_id,crm_paid_date,first_matched_at) values('crm:forged','00000000-0000-0000-0000-000000000003','2026-10-10','2026-10-10T06:00:00Z')"),/permission denied/);
  await assert.rejects(db.exec("update ga_conversion_observations set first_matched_at=now()"),/permission denied/);
  await db.exec('reset role;set role authenticated');assert.equal((await db.query('select * from ga_conversion_observations')).rows.length,1);
  await assert.rejects(db.exec(insert),/permission denied/);
  await db.exec("reset role;select set_config('app.user_id','00000000-0000-0000-0000-000000000004',false);set role authenticated");assert.equal((await db.query('select * from ga_conversion_observations')).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from ga_conversion_observations'),/permission denied/);
  await db.exec('reset role');assert.equal((await db.query("select * from ga_audit where entity='ga_conversion_observations'")).rows.length,1);
 }finally{await db.close();}
});

