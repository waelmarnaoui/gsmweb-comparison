import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {autoMatch} from '../lib/auto-match';
function client(result:unknown,health:unknown={data:{version:2},error:null}){return {rpc:async(name:string,args:unknown)=>{
 if(name==='ga_matching_health')return health;
 assert.equal(name,'ga_auto_confirm_matches');assert.deepEqual(args,{p_since:'2026-09-23T21:00:00.000Z'});return result;
}} as unknown as SupabaseClient;}
test('automatic matching calls the approved RPC with the Bucharest cutoff',async()=>{
 assert.deepEqual(await autoMatch(client({data:3,error:null})),{configured:true,confirmed:3});
});
test('missing migration remains explicitly pending, other errors fail closed',async()=>{
 assert.deepEqual(await autoMatch(client({data:null,error:{code:'PGRST202'}})),{configured:false,confirmed:0});
 await assert.rejects(autoMatch(client({data:null,error:{code:'42501'}})),/Automatic attribution failed/);
});
test('old or absent matching version never invokes the unsafe automatic RPC',async()=>{
 for(const health of [{data:{version:1},error:null},{data:null,error:{code:'PGRST202'}}])
  assert.deepEqual(await autoMatch(client(null,health)),{configured:false,confirmed:0});
 await assert.rejects(autoMatch(client(null,{data:null,error:{code:'42501'}})),/readiness could not be checked/);
});
