import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tool} from 'ai';
import {z} from 'zod';
import {runActionAgent} from '../lib/action-agent-model';
import {googleReply} from './google-fixture';
test('Gemini SDK executes a typed tool, preserves its signature and receives real results before replying',async()=>{
 let calls=0,executed=0;
 const output={reply:'Recorded payments are 1000 lei.',evidence:['CRM returned 100000 bani.'],recommendation:'Continue monitoring.',expectedImpact:'Unknown.',risks:'Not attributed profit.',confidence:'high',missingData:[]};
 const result=await runActionAgent({key:'TEST_NOT_REAL',model:'gemini-3.8-flash',message:'What did we cash in today?',context:{},history:[],tools:{customer_payments:tool({description:'Read verified payments',inputSchema:z.object({date:z.string()}),execute:async p=>{assert.equal(p.date,'2026-10-17');executed++;return {amountBani:100000};}})},fetcher:async(url,init)=>{
  calls++;assert.match(String(url),/^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-3.8-flash:generateContent$/);
  const body=JSON.parse(String(init?.body));assert.ok(body.tools[0].functionDeclarations.some((t:any)=>t.name==='customer_payments'));assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'low');
  if(calls===2){assert.ok(JSON.stringify(body.contents).includes('100000'));assert.ok(JSON.stringify(body.contents).includes('functionResponse'));assert.ok(JSON.stringify(body.contents).includes('signed-test'));}
  return calls===1?Response.json({candidates:[{content:{role:'model',parts:[{functionCall:{name:'customer_payments',args:{date:'2026-10-17'}},thoughtSignature:'signed-test'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,totalTokenCount:30}}):googleReply(output);
 }});assert.equal(executed,1);assert.equal(calls,2);assert.deepEqual(result,output);
});
test('Gemini quota errors do not retry or call another provider',async()=>{
 let calls=0;
 await assert.rejects(runActionAgent({key:'TEST_NOT_REAL',model:'gemini-3.8-flash',message:'Read only',context:{},history:[],tools:{},fetcher:async url=>{calls++;assert.match(String(url),/generativelanguage.googleapis.com/);return Response.json({error:{code:429,message:'private provider detail',status:'RESOURCE_EXHAUSTED'}},{status:429});}}));
 assert.equal(calls,1);
});
