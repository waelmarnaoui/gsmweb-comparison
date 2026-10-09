import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {autoMatch} from '../lib/auto-match';
function client(result:unknown){return {rpc:async(name:string,args:unknown)=>{assert.equal(name,'ga_auto_confirm_matches');assert.deepEqual(args,{p_since:'2026-10-08T21:00:00.000Z'});return result;}} as unknown as SupabaseClient;}
test('automatic matching calls the approved RPC with the Bucharest cutoff',async()=>{
 assert.deepEqual(await autoMatch(client({data:3,error:null})),{configured:true,confirmed:3});
});
test('missing migration remains explicitly pending, other errors fail closed',async()=>{
 assert.deepEqual(await autoMatch(client({data:null,error:{code:'PGRST202'}})),{configured:false,confirmed:0});
 await assert.rejects(autoMatch(client({data:null,error:{code:'42501'}})),/Automatic attribution failed/);
});
