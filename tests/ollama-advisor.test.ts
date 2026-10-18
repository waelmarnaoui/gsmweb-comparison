import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askOllama,ollamaEndpoint,submitOllamaJob,readOllamaJob,OLLAMA_JOB_MS,OLLAMA_BUSINESS_INSTRUCTIONS} from '../lib/ollama-advisor';

test('business grounding distinguishes phone repair, saved history and approval-only changes',()=>{
 assert.match(OLLAMA_BUSINESS_INSTRUCTIONS,/smartphone repair shop in Bucharest/);
 assert.match(OLLAMA_BUSINESS_INSTRUCTIONS,/not a mobile network/);
 assert.match(OLLAMA_BUSINESS_INSTRUCTIONS,/does NOT delete saved chat history/);
 assert.match(OLLAMA_BUSINESS_INSTRUCTIONS,/propose save_ad_drafts/);
 assert.match(OLLAMA_BUSINESS_INSTRUCTIONS,/Approve & execute/);
});
test('Ollama gateway restricts outbound destinations',()=>{
 assert.equal(ollamaEndpoint('https://test.ngrok-free.dev/'),'https://test.ngrok-free.dev/v1');
 for(const value of ['http://test.ngrok-free.dev','https://127.0.0.1','https://test.ngrok-free.dev/other','https://test.ngrok-free.dev?token=x','https://test.ngrok-free.dev.evil.com'])assert.throws(()=>ollamaEndpoint(value));
});
test('long requests use schema enforcement and keep the complete user message',async()=>{
 const message='Long requirements '.repeat(200),reply={reply:'Reviewed',evidence:[],recommendation:'',expectedImpact:'',risks:'',confidence:'low',missingData:[]};
 const result=await askOllama({key:'private',baseURL:'https://test.ngrok-free.dev',message,context:{},history:[],fetcher:async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.messages.at(-1).content,message);assert.equal(body.max_tokens,2400);assert.equal(body.response_format.type,'json_schema');assert.ok(body.response_format.json_schema.schema.required.includes('reply'));return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(reply)}}]});}});
 assert.deepEqual(result,{...reply,actions:[]});
});
test('timeouts, output exhaustion, malformed replies and busy gateway have distinct safe errors',async()=>{
 for(const [response,expected] of [[new Response('',{status:504}),/deadline/],[new Response('',{status:429}),/busy/],[Response.json({choices:[{finish_reason:'length'}]}),/reply limit/],[Response.json({choices:[{finish_reason:'stop',message:{content:'{}'}}]}),/invalid structured/]] as const){
  await assert.rejects(askOllama({key:'private',baseURL:'https://test.ngrok-free.dev',message:'test',context:{},history:[],fetcher:async()=>response}),expected);
 }
 await assert.rejects(askOllama({key:'private',baseURL:'https://test.ngrok-free.dev',message:'test',context:{},history:[],fetcher:async()=>{throw new DOMException('private transport details','TimeoutError');}}),/deadline/);
});
test('30 minute background submission and status checks use separate short authenticated requests',async()=>{
 assert.equal(OLLAMA_JOB_MS,1800000);const id='12345678-1234-4123-8123-123456789abc';let submits=0;
 const options={id,key:'private',baseURL:'https://test.ngrok-free.dev',message:'test',context:{},history:[],fetcher:async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer private');if(init?.method==='POST'){submits++;assert.ok(String(url).endsWith('/v1/jobs'));return Response.json({id,state:'pending'});}return Response.json({id,state:'pending'});}};
 await submitOllamaJob(options);assert.equal(await readOllamaJob(options),null);assert.equal(await readOllamaJob(options),null);assert.equal(submits,1);
});
test('Ollama failures never fall back or leak provider details',async()=>{
 let calls=0;await assert.rejects(askOllama({key:'private',baseURL:'https://test.ngrok-free.dev',message:'test',context:{},history:[],fetcher:async()=>{calls++;return new Response('sensitive provider body',{status:401});}}),error=>error instanceof Error&&error.name==='OllamaProviderError'&&!error.message.includes('sensitive'));
 assert.equal(calls,1);
});
