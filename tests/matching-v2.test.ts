import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const admin='00000000-0000-0000-0000-000000000001',cutoff='2026-09-23T21:00:00Z';
async function setup(){
 const db=new PGlite();
 await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$; insert into auth.users values('${admin}'); select set_config('app.user_id','${admin}',false); grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const file of ['PROPOSED.sql','INTERNATIONAL-PHONES-PROPOSED.sql','MATCHING-V2-PROPOSED.sql','MATCHING-V2-PROPOSED.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.query('insert into ga_admins values ($1)',[admin]);
 await db.exec(`create table public.ga_connections(id text primary key,metadata jsonb); insert into public.ga_connections values ('google','{"sheet_id":"sheet"}'); select ga_record_click_sync('sheet',0,0,true);`);
 const device=(await db.query<{id:string}>("insert into ga_devices(name,token_hash) values ('test','test') returning id")).rows[0].id;
 let seq=0;
 const call=async(phone:string,time:string,direction='incoming')=>(await db.query<{id:string}>("insert into ga_calls(device_id,external_id,phone,started_at,duration_seconds,direction,created_at) values ($1,$2,$3,$4,0,$5,now()-interval '10 minutes') returning id",[device,String(seq++),phone,time,direction])).rows[0].id;
 const click=async(time:string,gclid:string|null=null)=>(await db.query<{id:string}>("insert into ga_clicks(source_key,clicked_at,gclid,created_at) values ($1,$2,$3,now()-interval '10 minutes') returning id",['sheet:'+String(seq++),time,gclid])).rows[0].id;
 const run=async(since=cutoff)=>(await db.query<{n:number}>('select ga_auto_confirm_matches($1) as n',[since])).rows[0].n;
 return {db,call,click,run};
}

test('reported missed-call timeline matches the 66-second click, never the 129-second click or callback',async()=>{
 const {db,call,click,run}=await setup();try{
  const old=await click('2026-10-10T09:40:07+03:00','same-ad'),valid=await click('2026-10-10T09:41:10+03:00','same-ad');
  const first=await call('+40722123456','2026-10-10T09:42:16+03:00','missed');
  await call('+40722123456','2026-10-10T11:04:28+03:00','outgoing');
  await call('+40722123456','2026-10-10T12:00:00+03:00');
  const options=(await db.query<{call_id:string;click_id:string;delay_seconds:number}>('select * from ga_match_options')).rows;
  assert.equal(options.length,1);assert.equal(options[0].call_id,first);assert.equal(options[0].click_id,valid);assert.equal(options[0].delay_seconds,66);assert.notEqual(options[0].click_id,old);
  assert.equal(await run(),1);assert.equal(await run(),0);
  assert.equal((await db.query<{reason:string}>('select reason from ga_match_reviews')).rows[0].reason,'');
  assert.equal((await db.query<{n:number}>('select count(*)::int n from ga_calls')).rows[0].n,3);
  assert.equal((await db.query<{n:number}>("select count(*)::int n from ga_audit where entity='ga_matches'")).rows[0].n,1);
 }finally{await db.close();}
});

test('repeated clicks with the same exact GCLID are one source; different and empty GCLIDs remain distinct',async()=>{
 const {db,call,click,run}=await setup();try{
  await click('2026-09-25T09:40:50+03:00','repeat');const latest=await click('2026-09-25T09:41:10+03:00','repeat');
  const repeated=await call('+447700900123','2026-09-25T09:42:16+03:00','missed');
  await click('2026-09-25T10:00:00+03:00','A');await click('2026-09-25T10:00:01+03:00','a');
  const different=await call('+4915123456789','2026-09-25T10:00:30+03:00');
  await click('2026-09-25T11:00:00+03:00');await click('2026-09-25T11:00:01+03:00');
  const unknown=await call('+12025550123','2026-09-25T11:00:30+03:00');
  const rows=(await db.query<{call_id:string;click_id:string;candidate_count:number;related_clicks:number}>('select * from ga_match_options')).rows;
  const group=rows.filter(r=>r.call_id===repeated);assert.equal(group.length,1);assert.equal(group[0].click_id,latest);assert.equal(Number(group[0].related_clicks),2);
  assert.ok(rows.filter(r=>r.call_id===different||r.call_id===unknown).every(r=>Number(r.candidate_count)===2));
  assert.equal(await run(),1);
 }finally{await db.close();}
});

test('global competition cannot disappear under a date filter or after one caller matches another source',async()=>{
 const {db,call,click,run}=await setup();try{
  const shared=await click('2026-09-25T09:00:00+03:00','shared');
  const a=await call('+40722123456','2026-09-25T09:00:20+03:00');
  const b=await call('+40722123457','2026-09-25T09:00:40+03:00');
  assert.equal(await run('2026-09-25T06:00:30Z'),0);
  await assert.rejects(db.query('select ga_confirm_match($1,$2)',[b,shared]),/Ambiguous attribution/);
  const other=await click('2026-09-25T09:00:10+03:00','other');
  // Simulate a preserved legacy/manual record, not a permitted application write.
  await db.query('insert into ga_matches(call_id,click_id,confirmed_by) values ($1,$2,$3)',[a,other,admin]);
  assert.equal(await run(),0);
  assert.equal((await db.query<{n:number}>('select competing_calls::int n from ga_match_options where call_id=$1 and click_id=$2',[b,shared])).rows[0].n,2);
 }finally{await db.close();}
});

test('one GCLID cannot be reused through another click row, including old preserved matches',async()=>{
 const {db,call,click,run}=await setup();try{
  const original=await click('2026-09-25T09:00:00+03:00','used');const a=await call('+40722123456','2026-09-25T09:00:20+03:00');
  assert.equal(await run(),1);
  const repeated=await click('2026-09-26T09:00:00+03:00','used');const b=await call('+40722123457','2026-09-26T09:00:20+03:00');
  assert.equal(await run(),0);await assert.rejects(db.query('select ga_confirm_match($1,$2)',[b,repeated]),/already attributed/);
  assert.notEqual(original,repeated);
  assert.equal((await db.query<{reason:string}>('select reason from ga_match_reviews where call_id=$1',[a])).rows[0].reason,'Website source fits more than one caller');
 }finally{await db.close();}
});

test('late clicks or earlier calls flag existing matches without deleting or reassigning them',async()=>{
 const {db,call,click,run}=await setup();try{
  await click('2026-09-25T09:00:00+03:00','first');const first=await call('+40722123456','2026-09-25T09:00:20+03:00');assert.equal(await run(),1);
  await click('2026-09-25T09:00:10+03:00','late');
  assert.equal((await db.query<{reason:string}>('select reason from ga_match_reviews')).rows[0].reason,'More than one website source fits this call');
  const earlier=await call('+40722123456','2026-09-24T09:00:20+03:00','missed');
  assert.equal((await db.query<{reason:string}>('select reason from ga_match_reviews')).rows[0].reason,'Not the first incoming or missed call');
  assert.equal((await db.query<{call_id:string}>('select call_id from ga_matches')).rows[0].call_id,first);assert.notEqual(first,earlier);assert.equal(await run(),0);
 }finally{await db.close();}
});

test('window edges are precise, future/old clicks do not match and newly ingested records settle before confirmation',async()=>{
 const {db,call,click,run}=await setup();try{
  await click('2026-09-25T09:00:00+03:00','edge');await call('+40722123456','2026-09-25T09:02:00+03:00');
  await click('2026-09-25T10:00:00+03:00','outside');await call('+40722123457','2026-09-25T10:02:00.001+03:00');
  await click('2026-09-25T11:00:01+03:00','future');await call('+40722123458','2026-09-25T11:00:00+03:00');
  const fresh=await click('2026-09-25T12:00:00+03:00','fresh');const freshCall=await call('+40722123459','2026-09-25T12:00:20+03:00');
  await db.query('update ga_clicks set created_at=now() where id=$1',[fresh]);
  assert.equal(await run(),1);await assert.rejects(db.query('select ga_confirm_match($1,$2)',[freshCall,fresh]),/Waiting/);
  await db.query("update ga_clicks set created_at=now()-interval '10 minutes' where id=$1",[fresh]);assert.equal(await run(),1);
  await db.exec('update ga_settings set window_seconds=119 where id=1');
  assert.ok((await db.query<{reason:string}>('select reason from ga_match_reviews')).rows.some(r=>r.reason.includes('outside')));
 }finally{await db.close();}
});

test('callbacks are never candidates; authenticated non-admins and anonymous users cannot read or write attribution',async()=>{
 const {db,call,click,run}=await setup();try{
  await click('2026-09-25T09:00:00+03:00','one');const outbound=await call('+40722123456','2026-09-25T09:00:10+03:00','outgoing');
  assert.equal(await run(),0);assert.equal((await db.query('select * from ga_match_options where call_id=$1',[outbound])).rows.length,0);
  await call('+40722123457','2026-09-25T09:00:20+03:00');
  await db.exec("select set_config('app.user_id','',false); set role authenticated;");
  await assert.rejects(db.query('select * from ga_match_options'),/Forbidden/);
  await assert.rejects(run(),/Forbidden/);await assert.rejects(db.query('select ga_matching_health()'),/Forbidden/);
  await db.exec('reset role; set role anon;');await assert.rejects(db.query('select * from ga_match_options'),/permission denied/);
  await assert.rejects(db.query('select ga_auto_confirm_matches($1)',[cutoff]),/permission denied/);
 }finally{await db.close();}
});

test('phone canonicalization and v2 health agree with the application contract',async()=>{
 const {db}=await setup();try{
  for(const [phone,expected] of [['0722 123 456','+40722123456'],['0044 (7700) 900-123','+447700900123'],['40722123456','+40722123456'],['private',null]])
   assert.equal((await db.query<{n:string|null}>('select ga_normalized_phone($1) n',[phone])).rows[0].n,expected);
  assert.equal((await db.query<{h:{version:number}}>('select ga_matching_health() h')).rows[0].h.version,2);
 }finally{await db.close();}
});

test('failed or stale imports pause attribution, and changing spreadsheets excludes old-source clicks',async()=>{
 const {db,call,click,run}=await setup();try{
  await click('2026-09-25T09:00:00+03:00','one');await call('+40722123456','2026-09-25T09:00:20+03:00');
  await db.exec("select ga_record_click_sync('sheet',0,0,false)");await assert.rejects(run(),/Fresh complete website import/);
  await db.exec("select ga_record_click_sync('sheet',0,0,true); update ga_audit set created_at=now()-interval '31 minutes' where entity='ga_sheet_import'");
  await assert.rejects(run(),/Fresh complete website import/);
  await db.exec("select ga_record_click_sync('sheet',0,0,true)");
  await db.exec(`update ga_connections set metadata='{"sheet_id":"another"}'; select ga_record_click_sync('another',0,0,true);`);
  assert.equal((await db.query('select * from ga_match_options')).rows.length,0);assert.equal(await run(),0);
  await db.exec(`update ga_connections set metadata='{"sheet_id":"sheet"}';`);assert.equal(await run(),1);
 }finally{await db.close();}
});
