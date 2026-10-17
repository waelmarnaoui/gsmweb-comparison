import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tool} from 'ai';
import {z} from 'zod';
import {runActionAgent} from '../lib/action-agent-model';
test('Claude SDK actually executes a typed tool and receives its real result before replying',async()=>{
 let calls=0,executed=0;
 const output={reply:'Recorded payments are 1000 lei.',evidence:['CRM returned 100000 bani.'],recommendation:'Continue monitoring.',expectedImpact:'Unknown.',risks:'Not attributed profit.',confidence:'high',missingData:[]};
 const result=await runActionAgent({key:'TEST_NOT_REAL',model:'claude-sonnet-5',message:'What did we cash in today?',context:{},history:[],tools:{customer_payments:tool({description:'Read verified payments',inputSchema:z.object({date:z.string()}),execute:async p=>{assert.equal(p.date,'2026-10-17');executed++;return {amountBani:100000};}})},fetcher:async(_url,init)=>{
  calls++;const body=JSON.parse(String(init?.body));assert.ok(body.tools.some((t:any)=>t.name==='customer_payments'));
  if(calls===2){assert.ok(JSON.stringify(body.messages).includes('100000'));assert.ok(JSON.stringify(body.messages).includes('tool_result'));}
  return Response.json({id:'msg_test',type:'message',role:'assistant',model:'claude-sonnet-5',content:calls===1?[{type:'tool_use',id:'tool_1',name:'customer_payments',input:{date:'2026-10-17'}}]:[{type:'text',text:JSON.stringify(output)}],stop_reason:calls===1?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:10,output_tokens:20}});
 }});assert.equal(executed,1);assert.equal(calls,2);assert.deepEqual(result,output);
});
