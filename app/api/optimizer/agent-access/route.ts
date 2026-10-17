import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {agentAccount} from '@/lib/agent-context';
import {readAgentAccess,reviewAgentCode,approveAgentCode} from '@/lib/agent-jobs-server';
import {connectSource} from '@/lib/agent-github';
export const maxDuration=120;
export async function GET(){try{const {user}=await requireAdmin();return Response.json(await readAgentAccess(user.id),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const text=await request.text();if(text.length>2000)throw new Error('Request too large.');const p=JSON.parse(text);
 if(p.operation==='connect_github')return Response.json(await connectSource(user.id,p.token),{headers:{'Cache-Control':'no-store'}});
 if(p.operation==='chat_permissions'&&typeof p.enabled==='boolean'){
  const r=await service().from('ga_ads_control').update({agent_chat_enabled:p.enabled,...(p.enabled?{agent_chat_authorization:`Authenticated dashboard owner ${user.id} authorized supported conversational tools and source proposals. Secrets remain server-side; exact source deployment requires approval and checks.`}:{})}).eq('account_id',agentAccount());if(r.error)throw new Error('Permission could not be stored.');return Response.json(await readAgentAccess(user.id),{headers:{'Cache-Control':'no-store'}});
 }
 if(typeof p.id!=='string'||!/^[a-f0-9-]{36}$/i.test(p.id))throw new Error('Invalid job identity.');
 if(p.operation==='review_code')return Response.json(await reviewAgentCode(p.id,user.id),{headers:{'Cache-Control':'no-store'}});
 if(p.operation==='deploy_code'&&typeof p.head==='string'&&/^[a-f0-9]{40}$/.test(p.head))return Response.json(await approveAgentCode(p.id,user.id,p.head),{headers:{'Cache-Control':'no-store'}});
 throw new Error('Unsupported agent access operation.');
}catch(e){return apiError(e);}}
