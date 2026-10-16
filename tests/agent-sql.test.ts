import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('agent migration protects check-ins, prevents duplicate AI jobs and bounds AI cost',async()=>{
 const db=new PGlite(),actor='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${actor}'),('${other}');create table ga_admins(user_id uuid primary key);insert into ga_admins values('${actor}');`);
  await db.exec(await readFile('supabase/ADS-AGENT-PROPOSED.sql','utf8'));
  await db.exec(await readFile('supabase/ADS-AGENT-PROPOSED.sql','utf8'));
  await db.exec('set role service_role');
  const checkin=()=>db.query(`insert into ga_agent_daily_checkins(account_id,business_date,amount_bani,actor) values('2050434247','2026-10-16',400000,$1)`,[actor]);
  await checkin();await checkin();
  await assert.rejects(db.query('update ga_agent_daily_checkins set amount_bani=0'),/permission denied/);
  const claim=(id:string,user=actor)=>db.query<{claimed:boolean}>('select ga_claim_agent_exchange($1,$2,$3,$4,null) as claimed',[id,'2050434247',user,'Analyze']);
  const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
  assert.equal((await claim(first)).rows[0].claimed,true);assert.equal((await claim(first)).rows[0].claimed,false);
  await assert.rejects(claim(second),/already running/);await assert.rejects(claim(second,other),/Forbidden/);
  await db.query(`update ga_agent_exchanges set state='failed' where id=$1`,[first]);
  assert.equal((await claim(second)).rows[0].claimed,true);
  await assert.rejects(db.query(`update ga_agent_exchanges set user_message='changed'`),/permission denied/);
  await db.exec('reset role');
  for(let i=3;i<=30;i++)await db.query(`insert into ga_agent_exchanges(id,account_id,actor,user_message,state) values($1,'2050434247',$2,'test','failed')`,[`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,actor]);
  await db.exec("update ga_agent_exchanges set state='failed';set role service_role");
  await assert.rejects(claim('00000000-0000-4000-8000-000000000031'),/Hourly/);
  for(const role of ['anon','authenticated']){await db.exec(`reset role;set role ${role}`);await assert.rejects(db.query('select * from ga_agent_exchanges'),/permission denied/);await assert.rejects(checkin(),/permission denied/);await assert.rejects(claim(first),/permission denied/);}
 }finally{await db.close();}
});
