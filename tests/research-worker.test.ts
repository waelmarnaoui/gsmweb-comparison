import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResearchWorker} from '../scripts/research-worker.mjs';
const token='gsresearch_'+'a'.repeat(64),report={summary:'Supported saved-data report',findings:[],limitations:['No live web research.'],recommendations:[]};
function task(){return {id:'task',lease_token:'lease',deadline_at:new Date(Date.now()+3600000).toISOString(),checkpoint:{stage:1,report},checkpoint_version:1,instructions:'Review saved data',input:{available:false}};}
test('research worker resumes after the saved stage and checkpoints each completed stage without sharing credentials with Ollama',async()=>{
 const saved:any[]=[];let calls=0;
 const worker=createResearchWorker({token,fetcher:async(url:Parameters<typeof fetch>[0],init:any)=>{
  if(String(url).startsWith('http://127.0.0.1')){calls++;assert.equal(init.headers.Authorization,undefined);return Response.json({done:true,done_reason:'stop',message:{content:JSON.stringify(report)}});}
  assert.equal(url,'https://gsmweb-comparison.vercel.app/api/optimizer/research/worker');assert.equal(init.headers.Authorization,'Bearer '+token);const body=JSON.parse(init.body);
  if(body.operation==='claim')return Response.json({task:task()});if(body.operation==='checkpoint')saved.push(body);return Response.json({saved:true});
 }});
 assert.equal(await worker.once(),true);assert.equal(calls,2);assert.deepEqual(saved.map(x=>[x.version,x.checkpoint.stage,x.finish]),[[1,2,false],[2,3,true]]);
});
test('stopped task aborts local generation and cannot submit a report',async()=>{
 let saves=0;
 const worker=createResearchWorker({token,heartbeatMs:5,fetcher:async(url:Parameters<typeof fetch>[0],init:any)=>{
  if(String(url).startsWith('http://127.0.0.1'))return new Promise<Response>((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('stopped','AbortError'))));
  const body=JSON.parse(init.body);if(body.operation==='claim')return Response.json({task:task()});if(body.operation==='checkpoint')saves++;return new Response('',{status:409});
 }});
 await assert.rejects(worker.once());assert.equal(saves,0);
});
test('invalid or truncated local output cannot become a completed research report',async()=>{
 let saves=0;
 const worker=createResearchWorker({token,fetcher:async(url:Parameters<typeof fetch>[0],init:any)=>{
  if(String(url).startsWith('http://127.0.0.1'))return Response.json({done:true,done_reason:'stop',message:{content:'{}'}});
  const body=JSON.parse(init.body);if(body.operation==='claim')return Response.json({task:task()});if(body.operation==='checkpoint')saves++;return Response.json({saved:true});
 }});await assert.rejects(worker.once());assert.equal(saves,0);
});
