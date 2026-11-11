import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';import ts from 'typescript';
const source=readFileSync(new URL('../supabase/functions/smooth-function/index.ts',import.meta.url),'utf8');
function collector(code=source){
 let handler:(request:Request)=>Promise<Response>;const saved:any[]=[];
 const db={from:(table:string)=>table==='ga_devices'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'device',active:true},error:null})})})}:table==='ga_calls'?{upsert:(rows:any[])=>{saved.push(...rows);return {select:async()=>({data:rows.map((_,i)=>({id:i})),error:null})};}}:{insert:async()=>({error:null})}};
 const javascript=ts.transpileModule(code.replace(/^import .*?;\s*/s,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.runInNewContext(javascript,{createClient:()=>db,Deno:{env:{get:()=> 'private-test-value'},serve:(h:any)=>{handler=h;}},Response,Request,Uint8Array,TextEncoder,TextDecoder,crypto:webcrypto});
 return {saved,send:(calls:any[],authorized=true)=>handler(new Request('https://example.test',{method:'POST',headers:authorized?{Authorization:'Bearer '+'a'.repeat(43)}:{},body:JSON.stringify({calls})}))};
}
const call=(phone:string,event_id='event')=>({event_id,phone,started_at:'2026-11-11T12:34:56+02:00',duration_seconds:30,direction:'incoming'});
test('deployed Romanian-only validation reproduces a blocked mixed-country batch',async()=>{
 const legacy=source.replace(String.raw`/^\+[1-9][0-9]{7,14}$/`,String.raw`/^\+40[0-9]{9}$/`);
 assert.notEqual(legacy,source);const api=collector(legacy),response=await api.send([call('+40722882726'),call('+33751476704','foreign')]);
 assert.equal(response.status,400);assert.equal(api.saved.length,0);
});
test('collector accepts international E164 batches and preserves phone timestamp instant',async()=>{
 const api=collector(),response=await api.send(['+40722882726','+33751476704','+447911123456','+4915112345678'].map((phone,i)=>call(phone,'event-'+i)));
 assert.equal(response.status,200);assert.equal(api.saved.length,4);assert.equal(api.saved[0].started_at,'2026-11-11T10:34:56.000Z');
 assert.deepEqual((await response.json()),{ok:true,received:4,inserted:4});
});
test('collector keeps authentication and malformed-number validation',async()=>{
 const api=collector();assert.equal((await api.send([call('+33751476704')],false)).status,401);
 assert.equal((await api.send([call('private')])).status,400);assert.equal(api.saved.length,0);
});
