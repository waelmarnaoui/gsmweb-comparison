import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('phone validation migration preserves existing calls and accepts international formats',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create table ga_calls(phone text not null constraint ga_calls_phone_check check(phone ~ '^\\+40[0-9]{9}$')); insert into ga_calls values ('+40722481903');");
  const sql=await readFile(new URL('../supabase/INTERNATIONAL-PHONES-PROPOSED.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  await db.exec("insert into ga_calls values ('+447700900123'), ('+12025550123'), ('+21620123456');");
  assert.equal((await db.query<{count:number}>('select count(*)::int as count from ga_calls')).rows[0].count,4);
  for(const phone of ['private','00447700900123','+01234567890','+1234567890123456'])await assert.rejects(db.query('insert into ga_calls values ($1)',[phone]));
 }finally{await db.close();}
});

