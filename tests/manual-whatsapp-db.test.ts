import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('manual WhatsApp storage is idempotent, channel-safe and admin-only',async()=>{
 const db=new PGlite();const admin='00000000-0000-0000-0000-000000000001';
 try{
 await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$; insert into auth.users values('${admin}'); select set_config('app.user_id','${admin}',false); grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const file of ['PROPOSED.sql','INTERNATIONAL-PHONES-PROPOSED.sql','MATCHING-V2-PROPOSED.sql','MANUAL-WHATSAPP-PROPOSED.sql','MANUAL-WHATSAPP-PROPOSED.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.query('insert into ga_admins values ($1)',[admin]);
 await db.exec(`create table public.ga_connections(id text primary key,metadata jsonb); insert into public.ga_connections values ('google','{"sheet_id":"sheet"}'); select ga_record_click_sync('sheet',0,0,true);`);
 const record=async(phone:string,time:string)=>(await db.query<{r:{saved:boolean;callId:string}}> ('select ga_record_manual_whatsapp($1,$2,$3) r',[phone,time,'minute'])).rows[0].r;
 assert.equal((await record('0722882726','2026-10-10T06:42:00Z')).saved,true);
 assert.equal((await record('+40722882726','2026-10-10T08:42:00Z')).saved,false);
 assert.equal((await db.query<{n:number}>('select count(*)::int n from ga_whatsapp_entries')).rows[0].n,1);
 assert.equal((await db.query<{active:boolean}>("select active from ga_devices where name='Internal manual WhatsApp'")).rows[0].active,false);
 await db.exec("update ga_calls set created_at=now()-interval '10 minutes'; insert into ga_clicks(source_key,clicked_at,gclid,created_at) values ('sheet:one','2026-10-10T06:41:00Z','one',now()-interval '10 minutes');");
 assert.equal((await db.query('select * from ga_match_options')).rows.length,0);
 const id=(await db.query<{id:string}>('select id from ga_clicks')).rows[0].id;
 await db.query('select ga_record_click_channels($1::jsonb)',[JSON.stringify([{click_id:id,channel:'whatsapp'}])]);
 assert.equal((await db.query('select * from ga_match_options')).rows.length,1);
 assert.equal((await db.query<{n:number}>("select ga_auto_confirm_matches('2026-09-23T21:00:00Z') n")).rows[0].n,1);
 await record('+40744359717','2026-10-10T07:02:00Z');
 await db.exec("update ga_calls set created_at=now()-interval '10 minutes'; insert into ga_clicks(source_key,clicked_at,gclid,created_at) values ('sheet:unsafe','2026-10-10T07:00:30Z','unsafe',now()-interval '10 minutes');");
 const unsafe=(await db.query<{id:string}>("select id from ga_clicks where gclid='unsafe'")).rows[0].id;
 await db.query('select ga_record_click_channels($1::jsonb)',[JSON.stringify([{click_id:unsafe,channel:'whatsapp'}])]);
 assert.equal((await db.query<{n:number}>("select ga_auto_confirm_matches('2026-09-23T21:00:00Z') n")).rows[0].n,0);
 await db.exec("select set_config('app.user_id','',false); set role authenticated;");
 assert.equal((await db.query('select * from ga_whatsapp_entries')).rows.length,0);
 await assert.rejects(record('+40722123456','2026-10-10T09:00:00Z'),/Forbidden/);
 }finally{await db.close();}
});
