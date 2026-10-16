import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askAdvisor,type AdvisoryReply} from '../lib/agent-model';
const reply:AdvisoryReply={reply:'Reporting is delayed.',evidence:['No verified CRM attribution.'],recommendation:'Review attribution before editing bids.',expectedImpact:'Unknown.',risks:'Reduced search visibility.',confidence:'low',missingData:['Paid customers.']};
test('advisor uses strict structured output, no tools and bounded history',async()=>{
 const result=await askAdvisor({key:'secret',model:'configured-model',message:'What should I fix?',context:{mode:'ADVISE'},history:Array.from({length:20},()=>({role:'user' as const,content:'prior'})),fetcher:async(url,init)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(String(init?.body));
  assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.text.format.strict,true);assert.equal(body.input.length,14);
  assert.ok(body.instructions.includes('cannot change ads'));
  return Response.json({status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:JSON.stringify(reply)}]}]});
 }});assert.deepEqual(result,reply);
});
test('incomplete, refused, malformed and provider errors never become advice',async()=>{
 for(const payload of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"reply":"fabricated"}'}]}]}]){
  await assert.rejects(askAdvisor({key:'secret',model:'model',message:'x',context:{},history:[],fetcher:async()=>Response.json(payload)}));
 }
 await assert.rejects(askAdvisor({key:'secret',model:'model',message:'x',context:{},history:[],fetcher:async()=>new Response('private',{status:401})}),error=>error instanceof Error&&!error.message.includes('private'));
});
