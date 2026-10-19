import {assertBulkDraft,type BulkDraft} from './drafts';
import {ControlProviderError} from '../ads-control/google';
export type BulkRow={id:string;account_id:string;actor:string;campaign_id:string;family:string;service:string;draft:BulkDraft;content_hash:string;cpc_micros:string|null;state:string;version:number;result:unknown;error_code:string|null;created_at:string};
export type BulkStore={lock:()=>Promise<string|null>;unlock:(token:string)=>Promise<void>;fence:(token:string)=>Promise<void>;load:()=>Promise<BulkRow>;transition:(row:BulkRow,state:string,patch?:{result?:unknown;error_code?:string|null})=>Promise<BulkRow>};
export async function submitBulkGroup(input:{hash:string;confirmed:boolean;actor:string;store:BulkStore;guard:()=>Promise<void>;google:{validate:(row:BulkRow)=>Promise<void>;create:(row:BulkRow)=>Promise<unknown>};uncertain:(error:unknown)=>boolean;errorCode:(error:unknown)=>string;quota:(error:unknown)=>Promise<void>}){
 if(!input.confirmed)throw new Error('Confirm the saved group before publishing.');
 const token=await input.store.lock();if(!token)throw new Error('Another account action is running. Try later.');
 let current:BulkRow|null=null,claimed=false,writing=false;
 try{
  current=await input.store.load();if(current.actor!==input.actor||current.content_hash!==input.hash)throw new Error('The preview changed. Review the saved group again.');
  if(['submitted','submitting','uncertain','validating'].includes(current.state))return current;
  if(current.state!=='draft')throw new Error('Review and save a new draft before submitting.');
  assertBulkDraft(current.draft);await input.guard();
  current=await input.store.transition(current,'validating');claimed=true;
  await input.google.validate(current);await input.store.fence(token);await input.guard();
  current=await input.store.transition(current,'submitting');writing=true;
  await input.store.fence(token);
  const result=await input.google.create(current);
  return await input.store.transition(current,'submitted',{result,error_code:null});
 }catch(error){
  if(claimed&&current){
   const state=writing&&input.uncertain(error)?'uncertain':'rejected';
   // If receipt storage fails after Google acknowledged the write, keep the durable
   // submitting intent. Neither that intent nor an uncertain request can be resent.
   if(writing&&!(error instanceof ControlProviderError))throw error;
   await input.store.transition(current,state,{error_code:input.errorCode(error)});await input.quota(error);
  }
  throw error;
 }finally{await input.store.unlock(token);}
}
