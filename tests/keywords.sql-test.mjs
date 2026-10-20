import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),actor='00000000-0000-4000-8000-000000000001';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${actor}');create table ga_connections(id text check(id in('google')));create function ga_is_admin() returns boolean language sql as 'select false';create function ga_audit_change() returns trigger language plpgsql as $$begin return new;end$$;`);
 const sql=await readFile('supabase/KEYWORD-WORKSPACE-PROPOSED.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec('set role service_role');const insert=`insert into ga_keyword_actions(actor,account_id,content_hash,payload) values('${actor}','2050434247','${'a'.repeat(64)}','{"kind":"pause"}') returning id`;
 const id=(await db.query(insert)).rows[0].id;await assert.rejects(db.query(insert),/duplicate key/);
 await assert.rejects(db.exec(`update ga_keyword_actions set payload='{}' where id='${id}'`),/immutable/);
 await assert.rejects(db.exec(`update ga_keyword_actions set state='success' where id='${id}'`),/transition/);
 await db.exec(`update ga_keyword_actions set state='submitting' where id='${id}';update ga_keyword_actions set state='uncertain' where id='${id}'`);
 await assert.rejects(db.exec(`update ga_keyword_actions set state='draft' where id='${id}'`),/transition/);
 await assert.rejects(db.exec('delete from ga_keyword_actions'),/permission denied/);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(db.exec(insert),/permission denied/);if(role==='authenticated')assert.equal((await db.query('select * from ga_keyword_actions')).rows.length,0);else await assert.rejects(db.exec('select * from ga_keyword_actions'),/permission denied/);}
 console.log('Keyword storage: RLS, grants, idempotence, immutable intent and no uncertain replay passed.');
}finally{await db.close();}
