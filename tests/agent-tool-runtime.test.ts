import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeRecordedTool} from '../lib/agent-tool-runtime';
function fixture(){
 const rows=new Map<string,any>();let admin=true,enabled=true,receipt=true,claims=0;
 const db={from(table:string){let action='read',data:any,filters:Record<string,any>={};const q:any={select(){return q;},eq(k:string,v:any){filters[k]=v;return q;},insert(v:any){action='insert';data=v;return q;},update(v:any){action='update';data=v;return q;},maybeSingle(){return run();},single(){return run();},then(resolve:any,reject:any){return run().then(resolve,reject);}};
  async function run(){if(table==='ga_admins')return {data:admin?{user_id:'owner'}:null,error:null};if(table==='ga_agent_exchanges')return {data:{id:'exchange'},error:null};if(table==='ga_ads_control')return {data:{agent_chat_enabled:enabled,agent_chat_authorization:enabled?'owner approved':null},error:null};
   if(action==='insert'){claims++;if([...rows.values()].some(r=>r.external_id===data.external_id))return {data:null,error:{}};rows.set(data.id,{...data,state:'pending'});return {data:null,error:null};}
   if(action==='update'){if(!receipt)return {data:null,error:{}};const r=rows.get(filters.id);Object.assign(r,data);return {data:[{id:r.id}],error:null};}
   return {data:[...rows.values()].find(r=>r.external_id===filters.external_id)??null,error:null};
  }return q;}};
 return {db:db as any,rows,setAdmin:(v:boolean)=>{admin=v;},setEnabled:(v:boolean)=>{enabled=v;},setReceipt:(v:boolean)=>{receipt=v;},claims:()=>claims};
}
const who={exchangeId:'exchange',account:'2050434247',actor:'owner',readOnly:false,userMessage:'Run a control cycle'};
test('tool execution is durably claimed once and successful retries return the receipt without replay',async()=>{
 const f=fixture();let writes=0;const execute=async()=>{assert.equal(f.claims(),1);writes++;return {status:'queued',jobId:'job'};};
 const a=await executeRecordedTool(f.db,who,'call1','run_control_cycle',{},true,execute),b=await executeRecordedTool(f.db,who,'call1','run_control_cycle',{},true,execute);assert.deepEqual(a,b);assert.equal(writes,1);
});
test('automatic analysis, revoked owner role and missing chat authorization cannot perform mutations',async()=>{
 const f=fixture();let writes=0;const execute=async()=>{writes++;};
 await executeRecordedTool(f.db,{...who,readOnly:true},'call1','change',{},true,execute);assert.equal(writes,0);
 f.setEnabled(false);await executeRecordedTool(f.db,who,'call2','change',{},true,execute);assert.equal(writes,0);
 f.setAdmin(false);await assert.rejects(executeRecordedTool(f.db,who,'call3','read',{},false,execute));assert.equal(writes,0);
});
test('lost receipts leave execution unconfirmed and cannot replay an external write',async()=>{
 const f=fixture();let writes=0;f.setReceipt(false);const execute=async()=>{writes++;return {status:'confirmed'};};
 const a:any=await executeRecordedTool(f.db,who,'call1','change',{},true,execute);assert.equal(a.status,'unconfirmed');await executeRecordedTool(f.db,who,'call1','change',{},true,execute);assert.equal(writes,1);
});
