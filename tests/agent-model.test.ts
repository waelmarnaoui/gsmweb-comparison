import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askAdvisor,type AdvisoryReply} from '../lib/agent-model';
const reply:AdvisoryReply={reply:'Reporting is delayed.',evidence:['No verified CRM attribution.'],recommendation:'Review attribution before editing bids.',expectedImpact:'Unknown.',risks:'Reduced search visibility.',confidence:'low',missingData:['Paid customers.']};
test('advisor uses strict structured output, no tools and bounded history',async()=>{
 const result=await askAdvisor({key:'secret',model:'configured-model',message:'What should I fix?',context:{mode:'ADVISE'},history:Array.from({length:20},()=>({role:'user' as const,content:'prior'})),fetcher:async(url,init)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');const body=JSON.parse(String(init?.body));
  assert.equal((init?.headers as Record<string,string>)['anthropic-version'],'2023-06-01');assert.equal((init?.headers as Record<string,string>)['x-api-key'],'secret');assert.equal(body.thinking.type,'disabled');assert.equal(body.tools,undefined);assert.equal(body.output_config.format.type,'json_schema');assert.equal(body.messages.length,14);
  assert.ok(body.system.includes('cannot change ads'));
  return Response.json({stop_reason:'end_turn',content:[{type:'thinking',thinking:'private internal reasoning'},{type:'text',text:JSON.stringify(reply)}]});
 }});assert.deepEqual(result,reply);
});
test('incomplete, refused, malformed and provider errors never become advice',async()=>{
 for(const payload of [{stop_reason:'max_tokens',content:[]},{stop_reason:'refusal',content:[{type:'text',text:'No'}]},{stop_reason:'end_turn',content:[{type:'text',text:'{"reply":"fabricated"}'}]}]){
  await assert.rejects(askAdvisor({key:'secret',model:'model',message:'x',context:{},history:[],fetcher:async()=>Response.json(payload)}));
 }
 await assert.rejects(askAdvisor({key:'secret',model:'model',message:'x',context:{},history:[],fetcher:async()=>new Response('private',{status:401})}),error=>error instanceof Error&&!error.message.includes('private'));
});
