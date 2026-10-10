import type {SupabaseClient} from '@supabase/supabase-js';
import {IntegrationError} from './integration-error';

export const MATCHING_VERSION=2;
export const MATCHING_PENDING='Matching rules need the approved database update. No new matches will be confirmed until it is installed.';
export type MatchOption={call_id:string;click_id:string;delay_seconds:number;candidate_count:number;competing_calls:number;related_clicks:number;source_identity:string;settled_at:string;call_matched:boolean;source_claimed:boolean};
export type MatchReview={match_id:string;call_id:string;click_id:string;reason:string};
export async function matchingHealth(client:SupabaseClient){
 const {data,error}=await client.rpc('ga_matching_health');
 if(error){if(['PGRST202','42883'].includes(error.code))return {configured:false,version:0};throw new IntegrationError('Matching readiness could not be checked.',503);}
 return {configured:data?.version===MATCHING_VERSION,version:Number(data?.version)||0};
}
export async function matchOptions(client:SupabaseClient,ids:string[]){
 const rows:MatchOption[]=[];
 for(let i=0;i<ids.length;i+=100){
  for(let offset=0;offset<50000;offset+=500){
   const {data,error}=await client.from('ga_match_options').select('*').in('call_id',ids.slice(i,i+100)).order('call_id').order('click_id').range(offset,offset+499);
   if(error)throw new IntegrationError('Matching candidates could not be read.',503);
   rows.push(...(data||[]));if((data||[]).length<500)break;
   if(offset===49500)throw new IntegrationError('Candidate limit reached. No partial matching decision was returned.',503);
  }
 }
 return rows;
}
export async function matchReviews(client:SupabaseClient){
 const rows:MatchReview[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await client.from('ga_match_reviews').select('match_id,call_id,click_id,reason').order('match_id').range(offset,offset+499);
  if(error)throw new IntegrationError('Saved attribution could not be verified.',503);
  rows.push(...(data||[]));if((data||[]).length<500)return rows;
 }
 throw new IntegrationError('Saved attribution limit reached. No partial verification was returned.',503);
}
export function optionReason(options:MatchOption[],now=Date.now()){
 if(!options.length)return 'No website click before this first call within the matching window';
 if(options.some(o=>o.candidate_count!==1))return 'More than one website source fits this call';
 if(options.some(o=>o.competing_calls!==1))return 'Website source fits more than one caller';
 if(options.some(o=>o.source_claimed))return 'Website source already attributed';
 if(options.some(o=>Date.parse(o.settled_at)>now))return 'Waiting for recently imported call and click records';
 return 'One website source fits this first call; no competing caller';
}
