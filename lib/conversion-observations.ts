import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {service} from './server';
import {IntegrationError} from './integration-error';
export type ConversionObservation={payment_transaction_id:string;call_id:string;crm_paid_date:string;first_matched_at:string};
export async function conversionObservations(client:SupabaseClient,seeds:{payment_transaction_id:string;call_id:string;crm_paid_date:string}[],prepare:boolean){
 const all:ConversionObservation[]=[];
 async function read(){
  all.length=0;
  for(let offset=0;offset<10000;offset+=500){
   const {data,error}=await client.from('ga_conversion_observations').select('payment_transaction_id,call_id,crm_paid_date,first_matched_at').order('payment_transaction_id').range(offset,offset+499);
   if(error){if(error.code==='42P01'||error.code==='PGRST205')return false;throw new IntegrationError('Saved conversion match times could not be read.',503);}
   all.push(...(data||[]));if((data||[]).length<500)return true;
  }
  throw new IntegrationError('Too many saved conversion match times. No partial export was generated.',503);
 }
 if(!await read())return {configured:false,rows:all};
 if(prepare){
  const pending=[...new Map(seeds.filter(s=>!all.some(o=>o.payment_transaction_id===s.payment_transaction_id)).map(s=>[s.payment_transaction_id,s])).values()];
  for(let i=0;i<pending.length;i+=200){
   // The database supplies the immutable time; concurrent retries never replace it.
   const {error}=await service().from('ga_conversion_observations').upsert(pending.slice(i,i+200),{onConflict:'payment_transaction_id',ignoreDuplicates:true});
   if(error)throw new IntegrationError('Could not save first conversion match times.',503);
  }
  if(pending.length)await read();
 }
 return {configured:true,rows:all};
}

