import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('consent is append-only, admin-only, attributed to staff and audited',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;insert into auth.users values('${admin}');select set_config('app.user_id','${admin}',false);grant usage on schema auth to authenticated,service_role;`);
  await db.exec(await readFile(new URL('../supabase/PROPOSED.sql',import.meta.url),'utf8'));
  await db.exec(`insert into ga_admins values('${admin}')`);
  const migration=await readFile(new URL('../supabase/CLIENT-CONSENT-PROPOSED.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);await db.exec('set role authenticated');
  const record=(status:string)=>`select ga_record_client_consent('dmjunqbncyrinykbbmfk','client','+40712345678','${status}','not_asked',now()-interval '1 minute','store-google-v1')`;
  await db.exec(record('granted'));await db.exec(record('withdrawn'));
  const rows=(await db.query<{ad_user_data:string;recorded_by:string}>('select * from ga_client_consents order by id desc')).rows;
  assert.equal(rows.length,2);assert.equal(rows[0].ad_user_data,'withdrawn');assert.equal(rows[1].ad_user_data,'granted');assert.equal(rows[0].recorded_by,admin);
  await assert.rejects(db.exec('delete from ga_client_consents'),/permission denied/);
  await assert.rejects(db.exec("update ga_client_consents set ad_user_data='granted'"),/permission denied/);
  await assert.rejects(db.exec(record('invalid')),/check constraint/);
  await assert.rejects(db.exec(record('granted').replace("now()-interval '1 minute'","now()+interval '1 day'")),/Invalid consent record/);
  await db.exec("reset role;select set_config('app.user_id','00000000-0000-0000-0000-000000000002',false);set role authenticated");
  assert.equal((await db.query('select * from ga_client_consents')).rows.length,0);
  await assert.rejects(db.exec(record('granted')),/Forbidden/);
  await db.exec('reset role;set role anon');await assert.rejects(db.exec(record('granted')),/permission denied/);
  await db.exec('reset role;set role service_role');await assert.rejects(db.exec(record('granted')),/permission denied/);
  await db.exec('reset role');assert.equal((await db.query("select * from ga_audit where entity='ga_client_consents'")).rows.length,2);
 }finally{await db.close();}
});
