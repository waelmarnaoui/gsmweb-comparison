import {requireAdmin,apiError,service} from '@/lib/server';
import {configuredProvider} from '@/lib/connections';
import {visibleCallStart} from '@/lib/call-visibility';
import {readCrmComparison} from '@/lib/crm-reader';
import {firstInteractions} from '@/lib/first-interaction';
import {readCallHistory} from '@/lib/call-history';
export async function GET(request:Request){try{
 const {client}=await requireAdmin();const url=new URL(request.url);const until=new Date(url.searchParams.get('until')||Date.now());const since=visibleCallStart(url.searchParams.get('since'));
 if(!Number.isFinite(until.getTime())||since>=until||(url.searchParams.has('since')&&until.getTime()-since.getTime()>31*86400000))throw new Error('Invalid date range');
 const history=await readCallHistory(client,until.toISOString());
 const groups=firstInteractions(history,until.getTime());
 const first=groups.map(g=>g.primary).filter(c=>Date.parse(c.started_at)>=since.getTime()).sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at));
 const results=await Promise.all([Promise.resolve({data:first,error:null}),client.from('ga_settings').select('window_seconds').eq('id',1).single(),client.from('ga_audit').select('action,entity,record_id,created_at').order('created_at',{ascending:false}).limit(50)]);
 for(const result of results)if(result.error)throw result.error;
 const raw=results[0].data||[];const ids=raw.slice(0,500).map(c=>c.id);let candidateRows: {call_id:string;click_id:string;delay_seconds:number}[]=[];let matchRows:{call_id:string;click_id:string;confirmation_method?:string}[]=[];
 if(ids.length){const matches=await client.from('ga_matches').select('*').in('call_id',ids);if(matches.error)throw matches.error;matchRows=matches.data||[];
  for(let offset=0;offset<50000;offset+=1000){const candidates=await client.from('ga_candidates').select('call_id,click_id,delay_seconds').in('call_id',ids).order('call_id').order('click_id').range(offset,offset+999);if(candidates.error)throw candidates.error;candidateRows.push(...(candidates.data||[]));if((candidates.data||[]).length<1000)break;if(offset===49000)throw new Error('Too many candidates: narrow date range');}
 }
 const clickIds=[...new Set([...candidateRows.map(c=>c.click_id),...matchRows.map(m=>m.click_id)])];const clickMap=new Map<string,Record<string,string>>();
 for(let i=0;i<clickIds.length;i+=200){const result=await client.from('ga_clicks').select('id,clicked_at,gclid,campaign').in('id',clickIds.slice(i,i+200));if(result.error)throw result.error;for(const click of result.data||[])clickMap.set(click.id,click);}
 const format=(time:string)=>new Date(time).toLocaleString('en-GB',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 const calls=raw.slice(0,500).map(c=>{const match=matchRows.find(m=>m.call_id===c.id);const candidates=candidateRows.filter(k=>k.call_id===c.id);const attached=match?[{click_id:match.click_id,delay_seconds:Math.round((Date.parse(c.started_at)-Date.parse(clickMap.get(match.click_id)?.clicked_at||c.started_at))/1000)}]:candidates;return {id:c.id,phone:c.phone,time:format(c.started_at),timestamp:c.started_at,direction:c.direction,duration:`${Math.floor(c.duration_seconds/60)}m ${c.duration_seconds%60}s`,customer:'CRM customer not linked',repair:'Payment relationship not verified',payment:0,paymentVerified:false,status:match?'confirmed':candidates.length>1?'ambiguous':candidates.length===1?'candidate':'unmatched',selected:match?.click_id,confirmationMethod:match?.confirmation_method||'manual',clicks:attached.map(k=>{const click=clickMap.get(k.click_id);return {id:k.click_id,campaign:click?.campaign||'Website call click',source:click?.gclid?'Google Ads':'Website',time:format(click?.clicked_at||c.started_at),delay:k.delay_seconds,gclid:click?.gclid||''}})};});
 const activity=(results[2].data||[]).map(a=>({created_at:a.created_at,message:`${format(a.created_at)} · ${a.action} · ${a.entity}`}));
 if(configuredProvider('google')||configuredProvider('supabase_calls')){const connectionAudit=await service().from('ga_connection_audit').select('connection,action,created_at').order('created_at',{ascending:false}).limit(50);for(const row of connectionAudit.data||[])activity.push({created_at:row.created_at,message:`${format(row.created_at)} · ${row.action} · ${row.connection}`});}
 let crmNotice='';
 if(calls.length){try{const comparison=await readCrmComparison(raw.slice(0,500));const byCall=new Map(comparison.map(c=>[c.callId,c]));for(const call of calls){const row=byCall.get(call.id);if(row?.customer){call.customer=row.customer.name;call.repair=row.repairs.map(r=>r.repairCode).join(', ')||'No CRM repairs';}else if(row?.status==='ambiguous'){call.customer='Multiple CRM clients share this number';}}}catch{crmNotice='CRM comparison unavailable. Check the separate project connection.';}}
 return Response.json({calls,crmNotice,window:results[1].data?.window_seconds||120,audit:activity.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,50).map(a=>a.message),limited:raw.length>500,since:since.toISOString(),until:until.toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error)}}
