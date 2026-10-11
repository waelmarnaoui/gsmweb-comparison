import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {IntegrationError} from './integration-error';
import type {ClientConsent} from './client-consent';
export async function readClientConsents(client:SupabaseClient,project:string,clientIds:string[]){
 const latest=new Map<string,ClientConsent>();
 const ids=[...new Set(clientIds)];
 for(let start=0;start<ids.length;start+=100){for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await client.from('ga_client_consents').select('*').eq('crm_project_ref',project).in('client_id',ids.slice(start,start+100)).order('id',{ascending:false}).range(offset,offset+499);
  if(error){if(['42P01','PGRST205'].includes(error.code))return {configured:false,latest};throw new IntegrationError('Consent records could not be verified.',503);}
  for(const row of data||[])if(!latest.has(row.client_id))latest.set(row.client_id,row as ClientConsent);
  if((data||[]).length<500)break;
  if(offset===9500)throw new IntegrationError('Consent history limit reached. Upload is paused.',503);
 }}
 return {configured:true,latest};
}
