import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('missed calls can match but callbacks, ambiguous clicks and duplicate attribution cannot',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$; insert into auth.users values('${admin}'); select set_config('app.user_id','${admin}',false);`);
  for(const file of ['PROPOSED.sql','AUTO-MATCH-PROPOSED.sql','MISSED-CALL-MATCHING-PROPOSED.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.query('insert into ga_admins values ($1)',[admin]);
  const device=(await db.query<{id:string}>("insert into ga_devices(name,token_hash) values ('test','test') returning id")).rows[0].id;
  const call=async(name:string,time:string,direction:string)=>(await db.query<{id:string}>("insert into ga_calls(device_id,external_id,phone,started_at,duration_seconds,direction) values ($1,$2,'+40722123456',$3,0,$4) returning id",[device,name,time,direction])).rows[0].id;
  const click=async(name:string,time:string)=>(await db.query<{id:string}>('insert into ga_clicks(source_key,clicked_at) values ($1,$2) returning id',[name,time])).rows[0].id;
  await click('missed','2026-10-10T09:42:00+03:00'); const missed=await call('missed','2026-10-10T09:42:16+03:00','missed');
  const callback=await call('callback','2026-10-10T09:42:30+03:00','outgoing');
  await click('ambiguous1','2026-10-10T10:00:00+03:00'); await click('ambiguous2','2026-10-10T10:00:10+03:00'); await call('ambiguous','2026-10-10T10:00:20+03:00','missed');
  await click('old','2026-09-24T12:00:00+03:00'); await call('old','2026-09-24T12:00:16+03:00','missed');
  const run=()=>db.query<{n:number}>("select ga_auto_confirm_matches('2026-09-23T21:00:00Z') as n");
  assert.equal((await run()).rows[0].n,2); assert.equal((await run()).rows[0].n,0);
  assert.equal((await db.query('select id from ga_matches where call_id=$1',[missed])).rows.length,1);
  assert.equal((await db.query('select call_id from ga_candidates where call_id=$1',[callback])).rows.length,0);
  const manualClick=await click('manual','2026-10-10T11:00:00+03:00'),manualCall=await call('manual','2026-10-10T11:00:16+03:00','missed');
  await db.query('select ga_confirm_match($1,$2)',[manualCall,manualClick]);
  await assert.rejects(db.query('select ga_confirm_match($1,$2)',[callback,manualClick]),/Outside matching window/);
  await db.exec("select set_config('app.user_id','',false)"); await assert.rejects(run(),/Forbidden/);
 }finally{await db.close();}
});

