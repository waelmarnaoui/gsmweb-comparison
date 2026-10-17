import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('observation migration isolates browser roles and appends idempotently',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth; create table auth.users(id uuid primary key);
   insert into auth.users values ('00000000-0000-0000-0000-000000000001');`);
  await db.exec(await readFile('supabase/CONNECTIONS-PROPOSED.sql','utf8'));
  await db.exec(await readFile('supabase/CONNECTIONS-PROPOSED.sql','utf8'));
  assert.equal((await db.query<{n:number}>("select count(*)::int as n from pg_trigger where tgname='ga_connection_change' and tgrelid='public.ga_connections'::regclass")).rows[0]?.n,1);
  await db.exec(await readFile('supabase/ADS-OBSERVATION-PROPOSED.sql','utf8'));
  await db.exec(await readFile('supabase/ADS-OBSERVATION-PROPOSED.sql','utf8'));
  await db.exec(`set role service_role;
   insert into public.ga_connections(id,encrypted_credentials,connected_by)
   values ('google_ads_management','opaque','00000000-0000-0000-0000-000000000001');`);
  const insert=()=>db.query(`insert into public.ga_ads_observations(account_id,slot,observation)
   values ('2050434247','2026-10-16T12:00:00Z','{"accountId":"2050434247"}') on conflict(account_id,slot) do nothing`);
  await insert();await insert();
  assert.equal((await db.query<{n:number}>('select count(*)::int as n from ga_ads_observations')).rows[0]?.n,1);
  await assert.rejects(db.query('update ga_ads_observations set observation=observation'),/permission denied/);
  await assert.rejects(db.query('delete from ga_ads_observations'),/permission denied/);
  await assert.rejects(db.query(`insert into ga_ads_observations(account_id,slot,observation) values('2050434247',now(),'{}')`),/check constraint/);
  await assert.rejects(db.query(`insert into ga_ads_observations(account_id,slot,observation) values('2050434247',now(),'{"accountId":null}')`),/check constraint/);
  for(const role of ['anon','authenticated']){
   await db.exec(`reset role;set role ${role}`);
   await assert.rejects(db.query('select * from ga_ads_observations'),/permission denied/);
   await assert.rejects(insert(),/permission denied/);
  }
 }finally{await db.close();}
});
