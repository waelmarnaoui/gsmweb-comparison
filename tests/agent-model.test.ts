import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askAdvisor,type AdvisoryReply} from '../lib/agent-model';
import {googleReply} from './google-fixture';
const reply:AdvisoryReply={reply:'Reporting is delayed.',evidence:['No verified CRM attribution.'],recommendation:'Review attribution before editing bids.',expectedImpact:'Unknown.',risks:'Reduced search visibility.',confidence:'low',missingData:['Paid customers.']};
test('advisor uses Google directly, strict structured output, no tools and bounded history',async()=>{
 const result=await askAdvisor({key:'secret',model:'gemini-3.8-flash',message:'What should I fix?',context:{mode:'ADVISE'},history:Array.from({length:20},()=>({role:'user' as const,content:'prior'})),fetcher:async(url,init)=>{
  assert.match(String(url),/^https:\/\/generativelanguage.googleapis.com\//);
  const body=JSON.parse(String(init?.body));assert.equal(new Headers(init?.headers).get('x-goog-api-key'),'secret');assert.equal(body.tools,undefined);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.ok(body.generationConfig.responseJsonSchema);assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'low');assert.ok(JSON.stringify(body.systemInstruction).includes('cannot change ads'));
  assert.equal(JSON.stringify(body.contents).match(/prior/g)?.length,12);
  return googleReply(reply);
 }});assert.deepEqual(result,reply);
});
test('incomplete, refused, malformed and provider errors never become advice',async()=>{
 for(const response of [googleReply(reply,'MAX_TOKENS'),Response.json({promptFeedback:{blockReason:'SAFETY'}}),googleReply({reply:'fabricated'}),googleReply({...reply,unexpected:'private'})]){
  await assert.rejects(askAdvisor({key:'secret',model:'gemini-3.8-flash',message:'x',context:{},history:[],fetcher:async()=>response}));
 }
 await assert.rejects(askAdvisor({key:'secret',model:'gemini-3.8-flash',message:'x',context:{},history:[],fetcher:async()=>new Response('private',{status:401})}),error=>error instanceof Error&&!error.message.includes('private'));
});
test('model retains server-selected control scope and confirmed outcomes',async()=>{
 for(const controlMode of ['CONTROL','PAUSED'] as const)await askAdvisor({key:'secret',model:'gemini-3.8-flash',controlMode,message:'manage my account',context:{},history:[],fetcher:async(_url,init)=>{
  const body=JSON.parse(String(init?.body)),system=JSON.stringify(body.systemInstruction);assert.equal(body.tools,undefined);
  assert.ok(system.includes(controlMode==='CONTROL'?'The account is in CONTROL mode':'Account automation is PAUSED'));assert.ok(!system.includes('You are in ADVISE mode'));assert.ok(system.includes('confirmed result'));
  if(controlMode==='CONTROL'){assert.ok(system.includes('Existing ads, budgets and targeting remain protected'));assert.ok(system.includes('free text does not itself execute actions'));}
  return googleReply(reply);
 }});
});
