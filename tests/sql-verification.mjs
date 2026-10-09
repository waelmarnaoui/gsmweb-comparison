import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite();
const admin='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
try{
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;grant usage on schema auth to authenticated;insert into auth.users values('${admin}'),('${other}');select set_config('app.user_id','${admin}',false);`);
 await db.exec(await readFile(root+'/supabase/PROPOSED.sql','utf8'));
 await db.exec(await readFile(root+'/supabase/AUTO-MATCH-PROPOSED.sql','utf8'));
 await db.query('insert into ga_admins values($1)',[admin]);
 const device=(await db.query("insert into ga_devices(name,token_hash) values('test','dummy') returning id")).rows[0].id;
 async function click(name,time){return (await db.query('insert into ga_clicks(source_key,clicked_at) values($1,$2) returning id',[name,time])).rows[0].id;}
 async function call(name,time,direction='incoming'){return (await db.query("insert into ga_calls(device_id,external_id,phone,started_at,duration_seconds,direction) values($1,$2,'+40722123456',$3,30,$4) returning id",[device,name,time,direction])).rows[0].id;}
 await click('single','2026-10-09T12:00:00+03:00');await call('single','2026-10-09T12:00:30+03:00');
 await click('ambiguous-a','2026-10-09T12:59:00+03:00');await click('ambiguous-b','2026-10-09T12:59:30+03:00');await call('ambiguous','2026-10-09T13:00:00+03:00');
 await click('shared','2026-10-09T13:59:30+03:00');await call('shared-a','2026-10-09T14:00:00+03:00');await call('shared-b','2026-10-09T14:00:30+03:00');
 await click('old','2026-10-08T12:00:00+03:00');await call('old','2026-10-08T12:00:30+03:00');
 await click('future','2026-10-09T15:00:10+03:00');await call('future','2026-10-09T15:00:00+03:00');
 await click('outgoing','2026-10-09T16:00:00+03:00');await call('outgoing','2026-10-09T16:00:30+03:00','outgoing');
 const usedClick=await click('used','2026-10-09T17:00:00+03:00'),usedCall=await call('used-a','2026-10-09T17:00:30+03:00');await call('used-b','2026-10-09T17:01:00+03:00');await db.query('select ga_confirm_match($1,$2)',[usedCall,usedClick]);
 await click('boundary','2026-10-08T23:59:50+03:00');await call('boundary','2026-10-09T00:00:00+03:00');
 await db.exec('set role authenticated');
 const run=()=>db.query("select ga_auto_confirm_matches('2026-10-08T21:00:00Z') as n");
 assert.equal((await run()).rows[0].n,2);assert.equal((await run()).rows[0].n,0);
 const matched=(await db.query('select c.external_id,m.confirmation_method from ga_matches m join ga_calls c on c.id=m.call_id order by c.external_id')).rows;
 assert.deepEqual(matched.map(r=>[r.external_id,r.confirmation_method]),[['boundary','automatic'],['single','automatic'],['used-a','manual']]);
 assert.equal((await db.query("select count(*)::int as n from ga_audit where entity='ga_matches' and details->'after'->>'confirmation_method'='automatic'")).rows[0].n,2);
 await db.query("select set_config('app.user_id',$1,false)",[other]);await assert.rejects(run(),/Forbidden/);await db.exec('reset role');await db.query("select set_config('app.user_id',$1,false)",[admin]);
 await db.exec(await readFile(root+'/supabase/CONNECTIONS-PROPOSED.sql','utf8'));
 await db.exec('set role service_role');await db.query("insert into ga_connections(id,encrypted_credentials,connected_by) values('google','opaque-test-cipher',$1)",[admin]);
 assert.equal((await db.query('select count(*)::int as n from ga_connection_audit')).rows[0].n,1);
 await db.query("select ga_disconnect_connection('google',$1)",[admin]);assert.equal((await db.query('select count(*)::int as n from ga_connections')).rows[0].n,0);assert.equal((await db.query('select count(*)::int as n from ga_connection_audit')).rows[0].n,2);
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from ga_connections'),/permission denied/);await db.exec('reset role;set role anon');await assert.rejects(run(),/permission denied/);
 console.log('PASS: actual local PostgreSQL migrations; reciprocal unique matching; ambiguous/shared/old/future/outgoing/used clicks excluded; midnight inclusion; idempotency; audit; non-admin/anonymous rejection; RLS connection access denied; audited disconnect. No production database accessed.');
}finally{await db.close();}

