import {createHash} from 'node:crypto';
import {service,apiError} from '@/lib/server';
import {normalizeRomanianPhone} from '@/lib/attribution';
export async function POST(request:Request){try{
 const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];if(!token)return Response.json({error:'Unauthorized'},{status:401});
 const db=service();const {data:device,error}=await db.from('ga_devices').select('id').eq('token_hash',createHash('sha256').update(token).digest('hex')).eq('active',true).maybeSingle();if(error||!device)return Response.json({error:'Unauthorized'},{status:401});
 const body=await request.text();if(body.length>65536)throw new Error('Payload too large');const payload=JSON.parse(body);
 if(!Array.isArray(payload.calls)||payload.calls.length<1||payload.calls.length>100)throw new Error('Invalid batch');
 const rows=payload.calls.map((c:Record<string,unknown>)=>{if(typeof c.event_id!=='string'||!/^[\w:-]{1,100}$/.test(c.event_id)||typeof c.started_at!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(c.started_at)||!Number.isFinite(Date.parse(c.started_at))||typeof c.duration_seconds!=='number'||!Number.isInteger(c.duration_seconds)||c.duration_seconds<0||c.duration_seconds>86400||!['incoming','outgoing','missed'].includes(String(c.direction)))throw new Error('Invalid call');return {device_id:device.id,external_id:c.event_id,phone:normalizeRomanianPhone(String(c.phone)),started_at:new Date(c.started_at).toISOString(),duration_seconds:c.duration_seconds,direction:c.direction};});
 const result=await db.from('ga_calls').upsert(rows,{onConflict:'device_id,external_id',ignoreDuplicates:true}).select('id');if(result.error)throw result.error;
 return Response.json({inserted:result.data?.length||0});
 }catch(error){return apiError(error)}}
