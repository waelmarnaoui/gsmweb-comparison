import 'server-only';
import {service} from '../server';
import {agentAccount} from '../agent-context';
import {POLICY_ONLY_PREFERENCE} from './intervention-policy';
// A restriction may remove authority, never grant it. An unreadable preference
// fails closed; arbitrary preference text cannot enable any account operation.
export async function policyOnlyIntervention(){
 const r=await service().from('ga_agent_preferences').select('value').eq('account_id',agentAccount()).eq('name',POLICY_ONLY_PREFERENCE).maybeSingle();
 return !!r.error||typeof r.data?.value==='string'&&r.data.value.trim().length>0;
}
