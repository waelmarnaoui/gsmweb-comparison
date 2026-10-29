import {pmaxDraftSchema,pmaxHash,type PmaxRow} from './model';
import {ControlProviderError} from '../ads-control/google';
export async function publishPmax(input:{actor:string;account:string;hash:string;confirmed:boolean;load:()=>Promise<PmaxRow>;transition:(row:PmaxRow,state:string,patch?:Record<string,unknown>)=>Promise<PmaxRow>;lock:()=>Promise<string|null>;fence:(token:string)=>Promise<void>;unlock:(token:string)=>Promise<void>;guard:()=>Promise<void>;validate:(row:PmaxRow)=>Promise<Record<string,unknown>[]>;create:(row:PmaxRow,operations:Record<string,unknown>[])=>Promise<unknown>}){
 if(!input.confirmed)throw new Error('Approve the campaign budget and enabled publishing first.');
 const token=await input.lock();if(!token)throw new Error('Another account action is running.');let row:PmaxRow|null=null,writing=false;
 try{
  row=await input.load();if(row.actor!==input.actor||row.account_id!==input.account||row.content_hash!==input.hash)throw new Error('Campaign preview changed. Review again.');
  if(['validating','submitting','submitted','uncertain'].includes(row.state))return row;
  if(row.state!=='draft'||!row.draft)throw new Error('Save a valid campaign draft first.');
  pmaxDraftSchema.parse(row.draft);if(pmaxHash(input.account,row.draft)!==input.hash)throw new Error('Campaign content changed.');
  await input.guard();row=await input.transition(row,'validating');const operations=await input.validate(row);
  await input.guard();await input.fence(token);row=await input.transition(row,'submitting');writing=true;await input.fence(token);
  const result=await input.create(row,operations);return await input.transition(row,'submitted',{result,error_code:null});
 }catch(error){
  if(row&&['validating','submitting'].includes(row.state)){
   const uncertain=writing&&(!(error instanceof ControlProviderError)||error.uncertain);
   try{await input.transition(row,uncertain?'uncertain':'rejected',{error_code:error instanceof ControlProviderError?[error.code,...error.diagnostics].join(':').slice(0,250):writing?'pmax_submission_unconfirmed':'pmax_validation_failed'});}catch{}
  }
  throw error;
 }finally{await input.unlock(token);}
}
