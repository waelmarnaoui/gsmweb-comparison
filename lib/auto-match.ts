import type {SupabaseClient} from '@supabase/supabase-js';
import {CALLS_VISIBLE_FROM_UTC} from './call-visibility';
import {IntegrationError} from './integration-error';
export async function autoMatch(client:SupabaseClient){
 const {data,error}=await client.rpc('ga_auto_confirm_matches',{p_since:CALLS_VISIBLE_FROM_UTC});
 if(error){if(['PGRST202','42883'].includes(error.code))return {configured:false,confirmed:0};throw new IntegrationError('Automatic attribution failed. Check administrator access and the approved matching migration.',503);}
 return {configured:true,confirmed:Number(data)||0};
}
