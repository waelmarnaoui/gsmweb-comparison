import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createGateway} from '../scripts/ollama-gateway.mjs';

test('background job acknowledges immediately, is authenticated, and runs once across polls and duplicate submissions',async t=>{
 let finish,calls=0;const gate=new Promise(resolve=>{finish=resolve;});
 const server=createGateway({token:'test-secret',fetcher:async(url,init)=>{calls++;assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(init.headers.Authorization,undefined);assert.equal(JSON.parse(init.body).options.num_ctx,4096);await gate;return Response.json({done:true,done_reason:'stop',message:{content:'{"reply":"ok"}'}});}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer test-secret','Content-Type':'application/json'},id='12345678-1234-4123-8123-123456789abc',request={model:'llama3.1:8b',stream:false,messages:[{role:'user',content:'static test'}]};
 assert.equal((await fetch(base+'/v1/jobs/'+id)).status,401);
 assert.equal((await fetch(base+'/api/pull',{method:'POST',headers,body:'{}'})).status,404);
 const submit=()=>fetch(base+'/v1/jobs',{method:'POST',headers,body:JSON.stringify({id,request})});
 assert.equal((await submit()).status,202);
 assert.equal((await submit()).status,200);
 assert.equal((await (await fetch(base+'/v1/jobs/'+id,{headers})).json()).state,'pending');
 assert.equal(calls,1);finish();await new Promise(resolve=>setTimeout(resolve,20));
 const result=await (await fetch(base+'/v1/jobs/'+id,{headers})).json();assert.equal(result.state,'completed');assert.equal(result.result.choices[0].finish_reason,'stop');assert.equal(calls,1);
 const changed=await fetch(base+'/v1/jobs',{method:'POST',headers,body:JSON.stringify({id,request:{...request,messages:[{role:'user',content:'changed'}]}})});assert.equal(changed.status,409);
});
test('background model timeout is retained as failed, not automatically retried',async t=>{
 let calls=0;const server=createGateway({token:'test',fetcher:async()=>{calls++;throw new DOMException('not logged','TimeoutError');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer test','Content-Type':'application/json'},id='12345678-1234-4123-8123-123456789abc';
 await fetch(base+'/v1/jobs',{method:'POST',headers,body:JSON.stringify({id,request:{model:'llama3.1:8b',stream:false,messages:[]}})});
 await new Promise(resolve=>setTimeout(resolve,20));
 const status=await (await fetch(base+'/v1/jobs/'+id,{headers})).json();assert.equal(status.state,'failed');assert.equal(status.error,'timeout');assert.equal(calls,1);
});
