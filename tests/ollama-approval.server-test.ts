import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {decideOllamaAction,handleOllamaActions} from '../lib/ollama-action-server';
function fixture(){
 let permission=true,claimFails=false,executions=0;
 const proposal:any={id:'proposal',actor:'owner',account_id:'account',exchange_id:'original',state:'pending',tool:'proposal:remember_business_preference',input:{name:'language',value:'Romanian'},result:{status:'awaiting_approval'},created_at:new Date().toISOString()};
 const db={rpc:async()=>({data:true,error:null}),from(table:string){let action='read',payload:any;const filters:Record<string,unknown>={};const q:any={select(){return q;},eq(k:string,v:unknown){filters[k]=v;return q;},like(){return q;},single(){return run();},update(value:any){action='update';payload=value;return q;},then(resolve:any,reject:any){return run().then(resolve,reject);}};
  async function run(){
   if(table==='ga_ads_control')return {data:{agent_chat_enabled:permission,agent_chat_authorization:permission?'owner enabled':null},error:null};
   if(table==='ga_agent_exchanges')return {data:action==='read'?{user_message:'Remember my language preference'}:[],error:null};
   if(filters.actor!=='owner'||filters.account_id&&filters.account_id!=='account')return {data:null,error:{}};
   if(action==='read')return {data:{...proposal},error:null};
   if(filters.state&&proposal.state!==filters.state)return {data:[],error:null};
   if(claimFails&&payload.result?.status==='execution_claimed')return {data:null,error:{}};
   Object.assign(proposal,payload);return {data:[{id:proposal.id}],error:null};
  }return q;}};
 const tools:any={remember_business_preference:{inputSchema:z.object({name:z.string(),value:z.string()}).strict(),execute:async(input:unknown)=>{executions++;assert.deepEqual(input,{name:'language',value:'Romanian'});return {status:'confirmed'};}}};
 return {proposal,dependencies:{db,account:'account',tools},executions:()=>executions,disable:()=>{permission=false;},failClaim:()=>{claimFails=true;}};
}
test('approved exact stored payload executes once; duplicate approvals cannot repeat it',async()=>{
 const f=fixture();assert.deepEqual(await decideOllamaAction('owner','proposal',true,f.dependencies),{status:'confirmed'});assert.equal(f.executions(),1);
 await assert.rejects(decideOllamaAction('owner','proposal',true,f.dependencies));assert.equal(f.executions(),1);
});
test('reject, foreign owner, revoked permissions, expired proposal and lost claim cannot execute',async()=>{
 const rejected=fixture();await decideOllamaAction('owner','proposal',false,rejected.dependencies);assert.equal(rejected.executions(),0);
 const foreign=fixture();await assert.rejects(decideOllamaAction('other','proposal',true,foreign.dependencies));assert.equal(foreign.executions(),0);
 const disabled=fixture();disabled.disable();await assert.rejects(decideOllamaAction('owner','proposal',true,disabled.dependencies));assert.equal(disabled.executions(),0);
 const expired=fixture();expired.proposal.created_at='2020-01-01T00:00:00Z';await assert.rejects(decideOllamaAction('owner','proposal',true,expired.dependencies));assert.equal(expired.executions(),0);
 const lost=fixture();lost.failClaim();await assert.rejects(decideOllamaAction('owner','proposal',true,lost.dependencies));assert.equal(lost.executions(),0);
});
test('malformed stored action input is rejected before approval is claimed',async()=>{
 const f=fixture();f.proposal.input={name:'language',value:'Romanian',extra:'unapproved'};await assert.rejects(decideOllamaAction('owner','proposal',true,f.dependencies));assert.equal(f.proposal.state,'pending');assert.equal(f.executions(),0);
});
test('model-requested write only saves a proposal; read-only mode cannot save it or execute it',async()=>{
 let writes=0,proposals=0;
 const tools:any={remember_business_preference:{inputSchema:z.object({name:z.string(),value:z.string()}).strict(),execute:async()=>{writes++;}}};
 const db:any={from(){const q:any={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:null,error:null}),insert(){proposals++;return Promise.resolve({error:null});}};return q;}};
 const action:any={tool:'remember_business_preference',inputJson:JSON.stringify({name:'language',value:'Romanian'}),reason:'Owner requested this preference.'};
 const who={actor:'owner',account:'account',exchangeId:'exchange',userMessage:'Remember Romanian',readOnly:true};
 await handleOllamaActions(who,[action],{db,tools});assert.equal(proposals,0);assert.equal(writes,0);
 await handleOllamaActions({...who,readOnly:false},[action],{db,tools});assert.equal(proposals,1);assert.equal(writes,0);
});
