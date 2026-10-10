import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {CALLS_VISIBLE_FROM_UTC} from './call-visibility';
import {IntegrationError} from './integration-error';

export async function readCallHistory(client:SupabaseClient,until:string){
 const rows:{id:string;phone:string;started_at:string;direction:string;duration_seconds:number}[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await client.from('ga_calls').select('id,phone,started_at,direction,duration_seconds')
   .gte('started_at',CALLS_VISIBLE_FROM_UTC).lte('started_at',until).order('started_at').order('id').range(offset,offset+499);
  if(error)throw new IntegrationError('Call history could not be read.',503);
  rows.push(...(data||[]));if((data||[]).length<500)return rows;
 }
 throw new IntegrationError('Call history limit reached. No partial first-interaction comparison was returned.',503);
}
