import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('stock history is append-only, idempotent and inaccessible to browser roles',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
  const sql=await readFile('supabase/STOCK-MONITOR-PROPOSED.sql','utf8');await db.exec(sql);await db.exec(sql);await db.exec('set role service_role');
  const insert=`insert into ga_stock_monitor_runs(account_id,source_project,slot,status,snapshot) values('2050434247','dmjunqbncyrinykbbmfk','2026-10-16T12:00:00Z','complete','{"sourceProject":"dmjunqbncyrinykbbmfk","complete":true,"parts":[],"drafts":[]}') on conflict(account_id,source_project,slot,status) do nothing`;
  await db.exec(insert);await db.exec(insert);assert.equal((await db.query<{n:number}>('select count(*)::int n from ga_stock_monitor_runs')).rows[0].n,1);
  await assert.rejects(db.exec('update ga_stock_monitor_runs set snapshot=null'),/permission denied/);await assert.rejects(db.exec('delete from ga_stock_monitor_runs'),/permission denied/);
  for(const snapshot of ['{}','{"sourceProject":"dmjunqbncyrinykbbmfk","complete":true}','{"sourceProject":"wrong","complete":true,"parts":[],"drafts":[]}'])await assert.rejects(db.query("insert into ga_stock_monitor_runs(account_id,source_project,slot,status,snapshot) values('2050434247','dmjunqbncyrinykbbmfk',now(),'complete',$1)",[snapshot]),/check constraint/);
  await db.exec("insert into ga_stock_monitor_runs(account_id,source_project,slot,status,error_code) values('2050434247','dmjunqbncyrinykbbmfk','2026-10-16T12:00:00Z','failed','inventory_read_failed')");
  for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select * from ga_stock_monitor_runs'),/permission denied/);await assert.rejects(db.exec(insert),/permission denied/);}
 }finally{await db.close();}
});
