import type {SupabaseClient} from '@supabase/supabase-js';
import type {ControlStore} from './engine';
import {CONTROL_VERSION,type Action,type ActionState,type ControlSettings,type Heartbeat} from './rules';
export const controlStorageMessage='Account control storage is unavailable. Review ADS-CONTROL-PROPOSED.sql before installing it in the attribution database.';
export function controlStore(db:SupabaseClient):ControlStore{
 return {
  async lock(account){const r=await db.rpc('ga_ads_control_lock',{p_account:account});if(r.error)throw new Error(controlStorageMessage);return r.data as string|null;},
  async unlock(account,token){const r=await db.rpc('ga_ads_control_unlock',{p_account:account,p_token:token});if(r.error)throw new Error(controlStorageMessage);},
  async fence(account,token){const r=await db.rpc('ga_ads_control_renew',{p_account:account,p_token:token});if(r.error||r.data!==true)throw new Error('Account action lease expired.');},
  async settings(account){const r=await db.from('ga_ads_control').select('*').eq('account_id',account).maybeSingle();if(r.error)throw new Error(controlStorageMessage);return r.data??{account_id:account,stock_enabled:false,global_paused:true,version:CONTROL_VERSION,approved_by:null,approved_at:null};},
  async action(id){const r=await db.from('ga_ads_actions').select('*').eq('id',id).single();if(r.error)throw new Error(controlStorageMessage);return r.data as Action;},
  async transition(action:Action,state:ActionState,patch={}){
   const {data,error}=await db.from('ga_ads_actions').update({...patch,state,updated_at:new Date().toISOString()}).eq('id',action.id).eq('account_id',action.account_id).eq('state',action.state).select('*').single();
   if(error||!data)throw new Error('Action storage changed or is unavailable.');return data as Action;
  }
 };
}
export async function controlHeartbeats(db:SupabaseClient,account:string):Promise<Heartbeat[]>{
 const r=await db.from('ga_ads_control_workers').select('role,deployment_id,version,checked_at,ok').eq('account_id',account).order('checked_at',{ascending:false}).limit(20);
 if(r.error)throw new Error(controlStorageMessage);return r.data as Heartbeat[];
}
