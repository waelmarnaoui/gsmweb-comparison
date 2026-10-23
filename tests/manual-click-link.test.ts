import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {manualClickInput} from '../lib/manual-click-link';
const admin='00000000-0000-0000-0000-000000000001';
test('manual linking requires explicit confirmation, valid IDs and evidence',()=>{
 const valid={callId:admin,interactionId:admin,clickId:admin,reason:'Customer confirmed this website visit',confirmed:true};
 assert.equal(manualClickInput(valid).reason,valid.reason);
 for(const bad of [null,{...valid,confirmed:false},{...valid,reason:'guess'},{...valid,clickId:'bad'}])assert.throws(()=>manualClickInput(bad));
});
test('manual follow-up attribution is audited, unique, admin-only and revalidated',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;insert into auth.users values('${admin}');select set_config('app.user_id','${admin}',false);grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of ['PROPOSED.sql','INTERNATIONAL-PHONES-PROPOSED.sql','MATCHING-V2-PROPOSED.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into ga_admins values('${admin}');create table ga_connections(id text primary key,metadata jsonb);insert into ga_connections values('google','{"sheet_id":"sheet"}');create table ga_client_consents(id bigint primary key,phone text);create table ga_ads_uploads(consent_id bigint);`);
 await db.exec(await readFile(new URL('../supabase/MANUAL-CLICK-LINK-PROPOSED.sql',import.meta.url),'utf8'));
 const device=(await db.query<{id:string}>("insert into ga_devices(name,token_hash) values('test','test') returning id")).rows[0].id;
 const call=async(phone:string,hours:number,direction='incoming')=>(await db.query<{id:string}>("insert into ga_calls(device_id,external_id,phone,started_at,duration_seconds,direction) values($1,gen_random_uuid()::text,$2,now()-make_interval(hours=>$3),0,$4) returning id",[device,phone,hours,direction])).rows[0].id;
 const click=async(source:string,gclid:string,hours:number)=>(await db.query<{id:string}>("insert into ga_clicks(source_key,gclid,clicked_at) values($1,$2,now()-make_interval(hours=>$3)) returning id",[source,gclid,hours])).rows[0].id;
 const first=await call('+33751476704',48,'missed'),follow=await call('+33751476704',24,'outgoing'),other=await call('+40722123456',24);
 const selected=await click('sheet:click','gclid-1',25),duplicate=await click('sheet:duplicate','gclid-1',26),future=await click('sheet:later','gclid-2',23),wrong=await click('other:click','gclid-3',25);
 const link=(c:string,i:string,k:string)=>db.query('select ga_link_click_manually($1,$2,$3,$4)',[c,i,k,'Customer verified their website visit']);
 await assert.rejects(link(first,other,selected),/different customer/);
 await assert.rejects(link(first,follow,future),/before the chosen/);
 await assert.rejects(link(first,follow,wrong),/active website click/);
 await db.exec("select set_config('app.user_id','',false)");await assert.rejects(link(first,follow,selected),/Forbidden/);await db.exec(`select set_config('app.user_id','${admin}',false)`);
 await link(first,follow,selected);
 assert.notEqual((await db.query<{reason:string}>('select reason from ga_match_reviews')).rows[0].reason,'');
 assert.equal((await db.query<{reason:string}>('select reason from ga_manual_click_reviews')).rows[0].reason,'');
 await assert.rejects(link(other,other,duplicate),/already linked/);
 await assert.rejects(link(first,follow,selected),/already linked/);
 assert.equal((await db.query<{n:number}>("select count(*)::int n from ga_audit where entity='ga_manual_click_links'")).rows[0].n,1);
 await db.exec("update ga_calls set phone='+40722123457' where id='"+follow+"'");
 assert.match((await db.query<{reason:string}>('select reason from ga_manual_click_reviews')).rows[0].reason,/customer changed/);
 await db.exec('set role authenticated');
 await assert.rejects(db.exec('delete from ga_manual_click_links'),/permission denied/);
 await db.exec('reset role');
 const reserved=await call('+40722123458',24),reservedClick=await click('sheet:reserved','gclid-4',25);
 await db.exec("insert into ga_client_consents values(1,'+40722123458');insert into ga_ads_uploads values(1)");
 await assert.rejects(link(reserved,reserved,reservedClick),/reserved or submitted/);
 }finally{await db.close();}
});
