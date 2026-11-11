import {test} from 'node:test';import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('seven-day cleanup preserves website pairs, follow-ups, recent interactions and upload receipts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table ga_calls(id uuid primary key,started_at timestamptz,external_id text);
 create table ga_clicks(id uuid primary key,clicked_at timestamptz);
 create table ga_matches(id uuid primary key,call_id uuid references ga_calls(id),click_id uuid references ga_clicks(id));
 create table ga_manual_click_links(match_id uuid references ga_matches(id),interaction_id uuid references ga_calls(id));
 create table ga_conversion_observations(call_id uuid references ga_calls(id));
 create table ga_customer_links(call_id uuid references ga_calls(id));
 create table ga_whatsapp_entries(call_id uuid references ga_calls(id));
 create table ga_click_channels(click_id uuid references ga_clicks(id));
 create table ga_stock_monitor_runs(created_at timestamptz);create table ga_ads_search_runs(created_at timestamptz);
 create table ga_ads_observations(created_at timestamptz);create table ga_keyword_reports(created_at timestamptz);
 create table ga_audit(actor uuid,action text,entity text,record_id text,details jsonb);
 create table ga_ads_uploads(payment_id text);insert into ga_ads_uploads values('already-uploaded');
 insert into ga_calls values
 ('00000000-0000-0000-0000-000000000001',now()-interval '10 days','matched'),
 ('00000000-0000-0000-0000-000000000002',now()-interval '10 days','manual-follow-up'),
 ('00000000-0000-0000-0000-000000000003',now()-interval '10 days','old-unmatched'),
 ('00000000-0000-0000-0000-000000000004',now()-interval '1 day','recent'),
 ('00000000-0000-0000-0000-000000000005',now()-interval '7 days','boundary');
 insert into ga_clicks values('00000000-0000-0000-0000-000000000011',now()-interval '10 days'),('00000000-0000-0000-0000-000000000012',now()-interval '10 days');
 insert into ga_matches values('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011');
 insert into ga_manual_click_links values('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002');
 insert into ga_whatsapp_entries values('00000000-0000-0000-0000-000000000003');
 insert into ga_conversion_observations values('00000000-0000-0000-0000-000000000003');
 insert into ga_customer_links values('00000000-0000-0000-0000-000000000003');
 insert into ga_click_channels values('00000000-0000-0000-0000-000000000012');
 insert into ga_stock_monitor_runs values(now()-interval '8 days'),(now());`);
 const source=await readFile(new URL('../supabase/ATTRIBUTION-RETENTION.sql',import.meta.url),'utf8');
 await db.exec(source.split('-- Production scheduling')[0]);
 const result=await db.query<any>('select ga_maintenance.cleanup_attribution() as result');
 assert.equal(result.rows[0].result.deleted.unpaired_calls,2); // boundary aged slightly before this transaction
 assert.equal(result.rows[0].result.deleted.unpaired_clicks,1);
 assert.equal(result.rows[0].result.deleted.whatsapp,1);
 assert.equal((await db.query('select * from ga_calls')).rows.length,3);
 assert.equal((await db.query('select * from ga_matches')).rows.length,1);
 assert.equal((await db.query('select * from ga_manual_click_links')).rows.length,1);
 assert.equal((await db.query('select * from ga_ads_uploads')).rows.length,1);
 assert.equal((await db.query('select * from ga_stock_monitor_runs')).rows.length,1);
 await db.exec("insert into ga_calls values('00000000-0000-0000-0000-000000000099',now()-interval '8 days','android-backfill')");
 assert.equal((await db.query("select * from ga_calls where external_id='android-backfill'")).rows.length,0);
 await assert.rejects(db.exec("insert into ga_calls values('00000000-0000-0000-0000-000000000098',now()-interval '8 days','whatsapp-manual:old')"),/seven-day retention/);
 const second=await db.query<any>('select ga_maintenance.cleanup_attribution() as result');assert.equal(second.rows[0].result.deleted.unpaired_calls,0);
 await db.exec('set role authenticated');await assert.rejects(db.query('select ga_maintenance.cleanup_attribution()'),/permission denied/);
 }finally{await db.close();}
});
