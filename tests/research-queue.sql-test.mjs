import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${actor}'),('${other}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.ga_admins(user_id uuid primary key);insert into ga_admins values('${actor}');create function public.ga_is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.ga_admins where user_id=auth.uid())$$;create table public.ga_ads_control(account_id text primary key);insert into ga_ads_control values('account');create table public.ga_audit(id bigint generated always as identity primary key,actor uuid,action text,entity text,record_id text,details jsonb);grant select on public.ga_admins to service_role;grant insert on public.ga_audit to service_role;grant usage on sequence public.ga_audit_id_seq to service_role;`);
 await db.exec(await readFile(new URL('../supabase/RESEARCH-QUEUE-PROPOSED.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');
 const worker=(await db.query("insert into public.ga_research_workers(account_id,actor,label,token_hash) values('account',$1,'test',repeat('a',64)) returning id",[actor])).rows[0].id;
 const task=(await db.query("insert into public.ga_research_tasks(account_id,actor,kind,title,instructions) values('account',$1,'keywords','Keyword task','Review saved facts only') returning id",[actor])).rows[0].id;
 const claim=(await db.query('select * from public.ga_research_claim($1)',[worker])).rows[0];assert.equal(claim.id,task);assert.equal(claim.state,'running');assert.equal((await db.query('select * from public.ga_research_claim($1)',[worker])).rows.length,0);
 const save=async(token,version,finish=false)=>(await db.query('select public.ga_research_checkpoint($1,$2,$3,$4,$5,$6,$7) as ok',[worker,task,token,version,{stage:1},{summary:'Saved report'},finish])).rows[0].ok;
 assert.equal(await save(other,0),false);assert.equal(await save(claim.lease_token,0),true);assert.equal(await save(claim.lease_token,0),false);
 await db.query("update public.ga_research_tasks set lease_until=now()-interval '1 second' where id=$1",[task]);
 const resumed=(await db.query('select * from public.ga_research_claim($1)',[worker])).rows[0];assert.equal(resumed.checkpoint_version,1);assert.equal(resumed.checkpoint.stage,1);assert.notEqual(resumed.lease_token,claim.lease_token);
 assert.equal(await save(claim.lease_token,1),false);assert.equal(await save(resumed.lease_token,1,true),true);assert.equal(await save(resumed.lease_token,2),false);
 await assert.rejects(db.query('delete from public.ga_research_tasks where id=$1',[task]));
 await db.exec('reset role');await db.query("select set_config('app.user_id',$1,false)",[actor]);await db.exec('set role authenticated');assert.equal((await db.query('select * from public.ga_research_tasks')).rows.length,1);
 await assert.rejects(db.query('select token_hash from public.ga_research_workers'));await assert.rejects(db.query('select * from public.ga_research_claim($1)',[worker]));await assert.rejects(db.query("update public.ga_research_tasks set state='running'"));
 await db.exec('reset role');await db.query("select set_config('app.user_id',$1,false)",[other]);await db.exec('set role authenticated');assert.equal((await db.query('select * from public.ga_research_tasks')).rows.length,0);await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.ga_research_tasks'));await db.exec('reset role');
 assert.ok((await db.query("select * from public.ga_audit where entity='research_task'")).rows.length>=4);
 console.log('Research queue: owner isolation, private tokens, read-only browser grants, single claim, checkpoint CAS, expired-lease resume, stale fencing and audit passed.');
}finally{await db.close();}
