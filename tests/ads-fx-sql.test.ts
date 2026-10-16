import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('daily Google capture is unique, append-only and inaccessible to browser roles',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls');
  await db.exec(await readFile('supabase/ADS-DAILY-FX-PROPOSED.sql','utf8'));
  await db.exec(await readFile('supabase/ADS-DAILY-FX-PROPOSED.sql','utf8'));
  await db.exec('set role service_role');
  await db.exec("insert into ga_ads_daily_fx(account_id,rate_date,rate) values('2050434247','2026-10-16',4.5)");
  await db.exec("insert into ga_ads_daily_fx(account_id,rate_date,rate) values('2050434247','2026-10-16',4.6) on conflict(account_id,rate_date) do nothing");
  assert.equal(Number((await db.query<{rate:string}>('select rate from ga_ads_daily_fx')).rows[0].rate),4.5);
  await assert.rejects(db.query('update ga_ads_daily_fx set rate=5'),/permission denied/);
  await assert.rejects(db.query('delete from ga_ads_daily_fx'),/permission denied/);
  await assert.rejects(db.query("insert into ga_ads_daily_fx(account_id,rate_date,rate) values('2050434247','2026-10-17',0)"),/check constraint/);
  for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select * from ga_ads_daily_fx'),/permission denied/);}
 }finally{await db.close();}
});
