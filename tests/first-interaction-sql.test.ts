import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('database uses first missed interaction and rejects later calls without deleting history',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$; insert into auth.users values('${admin}'); select set_config('app.user_id','${admin}',false);`);
  for(const file of ['PROPOSED.sql','AUTO-MATCH-PROPOSED.sql','FIRST-INTERACTION-PROPOSED.sql','FIRST-INTERACTION-PROPOSED.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.query('insert into ga_admins values ($1)',[admin]);
  const device=(await db.query<{id:string}>("insert into ga_devices(name,token_hash) values ('test','test') returning id")).rows[0].id;
  const call=async(name:string,time:string,direction:string)=>(await db.query<{id:string}>("insert into ga_calls(device_id,external_id,phone,started_at,duration_seconds,direction) values ($1,$2,'+40722123456',$3,0,$4) returning id",[device,name,time,direction])).rows[0].id;
  const click=(await db.query<{id:string}>("insert into ga_clicks(source_key,clicked_at) values ('click','2026-10-10T09:41:10+03:00') returning id")).rows[0].id;
  await call('early-outgoing','2026-10-10T08:00:00+03:00','outgoing');
  const missed=await call('first','2026-10-10T09:42:16+03:00','missed');
  const repeat=await call('repeat','2026-10-10T09:42:30+03:00','incoming');
  await call('callback','2026-10-10T11:04:28+03:00','outgoing');
  const candidates=await db.query<{call_id:string}>('select call_id from ga_candidates');
  assert.deepEqual(candidates.rows.map(r=>r.call_id),[missed]);
  await assert.rejects(db.query('select ga_confirm_match($1,$2)',[repeat,click]),/Outside matching window/);
  // A later query start must not promote a repeat call to a new lead.
  assert.equal((await db.query<{n:number}>("select ga_auto_confirm_matches('2026-10-10T06:42:20Z') as n")).rows[0].n,0);
  assert.equal((await db.query<{n:number}>("select ga_auto_confirm_matches('2026-09-23T21:00:00Z') as n")).rows[0].n,1);
  assert.equal((await db.query<{n:number}>("select ga_auto_confirm_matches('2026-09-23T21:00:00Z') as n")).rows[0].n,0);
  assert.equal((await db.query<{n:number}>('select count(*)::int as n from ga_calls')).rows[0].n,4);
  assert.equal((await db.query('select id from ga_audit where entity=$1',['ga_matches'])).rows.length,1);
  await db.exec("select set_config('app.user_id','',false)");await assert.rejects(db.query("select ga_auto_confirm_matches('2026-09-23T21:00:00Z')"),/Forbidden/);
 }finally{await db.close();}
});
