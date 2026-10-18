import {createHash} from 'node:crypto';
import {service,apiError} from '@/lib/server';
import {researchCheckpointSchema} from '@/lib/research-task';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=30;
export async function POST(request:Request){try{
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token||!/^gsresearch_[a-f0-9]{64}$/.test(token))throw new IntegrationError('Worker unauthorized.',401);
 const db=service(),worker=await db.from('ga_research_workers').select('id,actor').eq('token_hash',createHash('sha256').update(token).digest('hex')).eq('active',true).maybeSingle();if(worker.error||!worker.data)throw new IntegrationError('Worker unauthorized.',401);
 const admin=await db.from('ga_admins').select('user_id').eq('user_id',worker.data.actor).maybeSingle();if(admin.error||!admin.data)throw new IntegrationError('Worker authorization revoked.',403);
 const raw=await request.text();if(Buffer.byteLength(raw)>500000)throw new IntegrationError('Research checkpoint too large.',413);const input=JSON.parse(raw);
 if(input.operation==='claim'){
  const r=await db.rpc('ga_research_claim',{p_worker:worker.data.id});if(r.error)throw new Error('Research claim unavailable.');return Response.json({task:r.data?.[0]??null},{headers:{'Cache-Control':'no-store'}});
 }
 for(const key of ['taskId','lease'])if(typeof input[key]!=='string'||!/^[a-f0-9-]{36}$/i.test(input[key]))throw new Error('Invalid lease identity.');
 if(input.operation==='heartbeat'){
  const r=await db.rpc('ga_research_heartbeat',{p_worker:worker.data.id,p_task:input.taskId,p_lease:input.lease});if(r.error||!r.data)throw new IntegrationError('Research lease lost or task stopped.',409);return Response.json({active:true},{headers:{'Cache-Control':'no-store'}});
 }
 if(input.operation!=='checkpoint'||!Number.isInteger(input.version)||typeof input.finish!=='boolean')throw new Error('Invalid research operation.');
 const checkpoint=researchCheckpointSchema.parse(input.checkpoint);if(input.finish&&checkpoint.stage!==3)throw new Error('Final report stage required.');
 const r=await db.rpc('ga_research_checkpoint',{p_worker:worker.data.id,p_task:input.taskId,p_lease:input.lease,p_version:input.version,p_checkpoint:checkpoint,p_report:input.finish?checkpoint.report:null,p_finish:input.finish});
 if(r.error||!r.data)throw new IntegrationError('Checkpoint not accepted. Lease or version changed.',409);
 return Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
