import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=34317,url=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{windowsHide:true,stdio:'ignore',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:59999',NEXT_PUBLIC_SUPABASE_ANON_KEY:'LOCAL_TEST_ONLY',SUPABASE_SERVICE_ROLE_KEY:'LOCAL_TEST_ONLY',APP_URL:url}});
try{
 let ready=false;for(let i=0;i<50;i++){try{const r=await fetch(url+'/login',{signal:AbortSignal.timeout(1000)});if(r.status===200){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready,'production app started');
 for(const method of ['GET','POST']){
  const r=await fetch(url+'/api/ai-ads/control',{method,headers:{Origin:url,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({operation:'execute',id:'00000000-0000-0000-0000-000000000001'})}:{}),signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,401,'unauthenticated control request rejected');
 }
 for(const path of ['/api/ai-ads/growth','/api/ai-ads/publishing','/api/optimizer/ai-settings'])for(const method of ['GET','POST']){const r=await fetch(url+path,{method,headers:{Origin:url},signal:AbortSignal.timeout(5000)});assert.equal(r.status,401);}
 const tick=await fetch(url+'/api/ai-ads/control/tick',{method:'POST',signal:AbortSignal.timeout(5000)});assert.equal(tick.status,401);
 const pair=await fetch(url+'/api/ai-ads/control/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({setupCode:'invalid',publicKey:'invalid'}),signal:AbortSignal.timeout(5000)});assert.equal(pair.status,400);
 console.log('PASS: production HTTP endpoints deny unauthenticated control and scheduler access; invalid pairing is rejected. Only local dummy configuration was used.');
}finally{child.kill();}
