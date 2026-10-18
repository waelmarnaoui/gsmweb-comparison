import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {agentAccount} from '@/lib/agent-context';
import {adsReadWait,type AdsReadKind} from '@/lib/ads-web-mode';
import {clearCurrentAdsCooldown} from '@/lib/ads-cooldown-reset';
import {controlStore} from '@/lib/ads-control/store';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=30;
export async function GET(){try{
 await requireAdmin();const account=agentAccount(),r=await service().from('ga_audit').select('id,action,created_at').eq('entity','google_ads_read_gate').eq('record_id',account).gte('created_at',new Date(Date.now()-48*3600000).toISOString()).order('id',{ascending:false}).limit(100);
 if(r.error)throw new IntegrationError('Cooldown status unavailable.',503);
 const now=Date.now(),waits=Object.fromEntries((['report','policy','resources','search'] as AdsReadKind[]).map(kind=>[kind,adsReadWait(kind,r.data??[],now)]));
 return Response.json({waits,checkedAt:new Date(now).toISOString()},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const raw=await request.text();if(Buffer.byteLength(raw)>1000)throw new IntegrationError('Reset request too large.',413);
 const input=JSON.parse(raw);if(input.operation!=='clear_current_cooldowns'||input.confirmed!==true||typeof input.requestId!=='string')throw new IntegrationError('Confirm the cooldown reset first.',400);
 const db=service(),account=agentAccount(),locks=controlStore(db);
 const result=await clearCurrentAdsCooldown(user.id,input.requestId,{
  lock:()=>locks.lock(account),unlock:token=>locks.unlock(account,token),
  alreadyRecorded:async requestId=>{const r=await db.from('ga_audit').select('id').eq('entity','google_ads_read_gate').eq('record_id',account).eq('action','owner_reset').contains('details',{requestId}).limit(1).maybeSingle();if(r.error)throw new Error('Reset history unavailable.');return !!r.data;},
  record:async(requestId,actor)=>{const r=await db.from('ga_audit').insert({actor,action:'owner_reset',entity:'google_ads_read_gate',record_id:account,details:{requestId,scope:'current_read_and_quota_cooldowns',nextQuotaErrorBlocksAgain:true}});if(r.error)throw new Error('Reset could not be saved.');}
 });
 return Response.json({...result,notice:'Current app cooldowns cleared. Checks can run again; a new quota error will activate the cooldown again.'},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error instanceof Error&&error.message==='ads_read_busy'?new IntegrationError('Another account check is running. Wait for it to finish before clearing cooldowns.',409):error);}}
