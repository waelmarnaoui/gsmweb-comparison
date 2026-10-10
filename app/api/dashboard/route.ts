import {requireAdmin,apiError,service} from '@/lib/server';
import {configuredProvider} from '@/lib/connections';
import {visibleCallStart} from '@/lib/call-visibility';
import {readCrmComparison} from '@/lib/crm-reader';
import {firstInteractions} from '@/lib/first-interaction';
import {readCallHistory} from '@/lib/call-history';
import {matchingHealth,matchOptions,matchReviews,optionReason,MATCHING_PENDING} from '@/lib/matching-state';
export async function GET(request:Request){try{
 const {client}=await requireAdmin();const url=new URL(request.url);
 const until=new Date(url.searchParams.get('until')||Date.now()),since=visibleCallStart(url.searchParams.get('since'));
 if(!Number.isFinite(until.getTime())||since>=until||(url.searchParams.has('since')&&until.getTime()-since.getTime()>31*86400000))throw new Error('Invalid date range');
 const [history,health,settings,audit]=await Promise.all([
  readCallHistory(client,new Date(Math.min(until.getTime(),Date.now())).toISOString()),matchingHealth(client),
  client.from('ga_settings').select('window_seconds').eq('id',1).single(),
  client.from('ga_audit').select('action,entity,record_id,created_at').order('created_at',{ascending:false}).limit(50)
 ]);
 if(settings.error)throw settings.error;if(audit.error)throw audit.error;
 const groups=firstInteractions(history).filter(g=>Date.parse(g.primary.started_at)>=since.getTime()&&Date.parse(g.primary.started_at)<=until.getTime())
  .sort((a,b)=>Date.parse(b.primary.started_at)-Date.parse(a.primary.started_at));
 const visible=groups.slice(0,500),ids=visible.map(g=>g.primary.id);
 const matches=ids.length?await client.from('ga_matches').select('call_id,click_id,confirmation_method').in('call_id',ids):{data:[],error:null};
 if(matches.error)throw matches.error;
 const [options,reviews]=health.configured?await Promise.all([matchOptions(client,ids),matchReviews(client)]):[[],[]];
 const clickIds=[...new Set([...options.map(o=>o.click_id),...(matches.data||[]).map(m=>m.click_id)])];
 const clicks=new Map<string,{id:string;clicked_at:string;gclid:string;campaign:string}>();
 for(let i=0;i<clickIds.length;i+=200){
  const result=await client.from('ga_clicks').select('id,clicked_at,gclid,campaign').in('id',clickIds.slice(i,i+200));
  if(result.error)throw result.error;for(const click of result.data||[])clicks.set(click.id,click);
 }
 const format=(time:string)=>new Date(time).toLocaleString('en-GB',{timeZone:'Europe/Bucharest',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 const calls=visible.map(g=>{
  const c=g.primary,match=(matches.data||[]).find(m=>m.call_id===c.id),candidate=options.filter(o=>o.call_id===c.id);
  const review=match?reviews.find(r=>r.call_id===c.id):undefined;
  const reason=!health.configured?MATCHING_PENDING:match?(review?(review.reason||'Unique first-call website match'):'Saved match could not be verified'):g.eligible?optionReason(candidate):'Outbound-only history is not a client inquiry';
  const conflict=candidate.some(o=>o.candidate_count>1||o.competing_calls>1||o.source_claimed);
  const status=match?(health.configured&&review?.reason===''?'confirmed':'ambiguous'):conflict?'ambiguous':candidate.length?'candidate':'unmatched';
  const attached=match?[{click_id:match.click_id,delay_seconds:(Date.parse(c.started_at)-Date.parse(clicks.get(match.click_id)?.clicked_at||c.started_at))/1000,related_clicks:candidate.find(o=>o.source_identity==='gclid:'+clicks.get(match.click_id)?.gclid)?.related_clicks||1}]:candidate;
  return {id:c.id,phone:g.phone,time:format(c.started_at),timestamp:c.started_at,direction:c.direction,
   followUpCount:g.followUps.length,duration:`${Math.floor(c.duration_seconds/60)}m ${c.duration_seconds%60}s`,
   customer:'CRM customer not linked',repair:'Payment relationship not verified',payment:0,paymentVerified:false,
   status,matchingReason:reason,selected:match?.click_id,confirmationMethod:match?.confirmation_method||'manual',
   canConfirm:health.configured&&!match&&!conflict&&candidate.length===1&&Date.parse(candidate[0].settled_at)<=Date.now(),
   clicks:attached.map(k=>{const click=clicks.get(k.click_id);return {id:k.click_id,campaign:click?.campaign||'Website call click',source:click?.gclid?'Google Ads':'Website',time:format(click?.clicked_at||c.started_at),delay:k.delay_seconds,gclid:click?.gclid||'',relatedClicks:Number(k.related_clicks)};})};
 });
 const activity=(audit.data||[]).map(a=>({created_at:a.created_at,message:`${format(a.created_at)} · ${a.action} · ${a.entity}`}));
 if(configuredProvider('google')||configuredProvider('supabase_calls')){
  const connectionAudit=await service().from('ga_connection_audit').select('connection,action,created_at').order('created_at',{ascending:false}).limit(50);
  for(const row of connectionAudit.data||[])activity.push({created_at:row.created_at,message:`${format(row.created_at)} · ${row.action} · ${row.connection}`});
 }
 let crmNotice='';
 if(calls.length){try{
  const comparison=await readCrmComparison(visible.map(g=>g.primary)),byCall=new Map(comparison.map(c=>[c.callId,c]));
  for(const call of calls){const row=byCall.get(call.id);if(row?.customer){call.customer=row.customer.name;call.repair=row.repairs.map(r=>r.repairCode).join(', ')||'No CRM repairs';}else if(row?.status==='ambiguous')call.customer='Multiple CRM clients share this number';}
 }catch{crmNotice='CRM comparison unavailable. Check the separate project connection.';}}
 return Response.json({calls,crmNotice,matchingNotice:health.configured?'':MATCHING_PENDING,matchingVersion:health.version,window:settings.data.window_seconds,
  audit:activity.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,50).map(a=>a.message),limited:groups.length>500,
  since:since.toISOString(),until:until.toISOString()},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error)}}
