'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Action,ControlSettings,Heartbeat,Mapping,Kind} from '@/lib/ads-control/rules';
import type {AdPolicyRecord} from '@/lib/ads-policy-reader';
import type {ControlCampaign} from '@/lib/ads-control/google';
import LaptopRecovery from '@/components/laptop-recovery';
import '../../optimizer/agent.css';
type Data={checkMode:'scheduled'|'dashboard';settings:ControlSettings;heartbeats:Heartbeat[];blockers:string[];recoveryReady:boolean;mode:string;actions:Action[];mappings:Mapping[];products:{id:string;name:string;available:number|null;eligible:boolean;fingerprint:string}[];events:{id:number;action_id:string|null;event:string;created_at:string}[];limitations:string[]};
type Resources={ads:AdPolicyRecord[];campaigns:ControlCampaign[];fetchedAt:string|null;adsComplete:boolean;campaignsComplete:boolean;errors:{section:string;message:string}[]};
async function api(body?:unknown,resources=false){
 const r=await fetch('/api/ai-ads/control'+(resources?'?resources=1':''),{method:body?'POST':'GET',cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(r.status===401){window.location.assign('/login');throw new Error('Sign in required.');}
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Account control is unavailable.');return data;
}
export default function ControlCenter(){
 const [data,setData]=useState<Data|null>(null),[resources,setResources]=useState<Resources|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[watching,setWatching]=useState(false);
 const ticking=useRef(false);
 const [ad,setAd]=useState(''),[product,setProduct]=useState(''),[campaign,setCampaign]=useState(''),[budget,setBudget]=useState(''),[ack,setAck]=useState(false),[kind,setKind]=useState<Kind>('ad_status'),[value,setValue]=useState('PAUSED');
 const refresh=useCallback(async()=>{try{setData(await api());setStale(false);}catch(e){setStale(true);setNotice(e instanceof Error?e.message:'Control status unavailable.');}},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);return()=>clearInterval(timer);},[refresh]);
 async function run(fn:()=>Promise<unknown>){setBusy(true);setNotice('');try{await fn();await refresh();}catch(e){setNotice(e instanceof Error?e.message:'The action could not complete.');}finally{setBusy(false);}}
 useEffect(()=>{
  if(!watching)return;
  let stopped=false;
  const tick=async()=>{
   if(ticking.current||document.hidden)return;ticking.current=true;
   try{const result=await api({operation:'tick'});if(!stopped){await refresh();if(!result.reliable)setNotice('Current stock is unconfirmed; no automatic stock change is authorized.');else if(result.changesConfirmed===false)setNotice('Some stock-related ad changes could not be confirmed. Review their action history and the live account.');}}
   catch(e){if(!stopped){setStale(true);setNotice(e instanceof Error?e.message:'Dashboard check failed.');}}
   finally{ticking.current=false;}
  };
  void tick();const timer=setInterval(()=>void tick(),60000);
  return()=>{stopped=true;clearInterval(timer);};
 },[watching,refresh]);
 const selected=resources?.campaigns.find(c=>c.resourceName===campaign);
 async function propose(){
  let target=ad,next=value;
  if(kind==='campaign_pause'){target=campaign;next='PAUSED';}
  if(kind==='budget_decrease'){
   if(!/^\d{1,6}(?:[.,]\d{1,6})?$/.test(budget)||!selected?.budgetEditable||!selected.budgetResource)throw new Error('Choose an editable daily budget and enter a positive lower amount in the account currency.');
   const [whole,fraction='']=budget.replace(',','.').split('.');next=String(Number(whole)*1000000+Number(fraction.padEnd(6,'0')));target=selected.budgetResource;
  }
  await api({operation:'propose',kind,resource:target,value:next,requestId:crypto.randomUUID()});setNotice('Proposal saved. Review its exact before and after values, then approve it.');
 }
 return <div className="setup-page"><header className="setup-header"><a href="/optimizer" className="secondary">Your agent</a><strong>GSMWEB</strong><a href="/ai-ads" className="secondary">Stock and drafts</a></header><main className="setup-main">
  <div className="eyebrow">AI ADS MANAGER</div><h1>Account control</h1><p>Grant specific capabilities, review changes and see what Google actually confirmed.</p><p>Pair this laptop below for background stock checks and independent campaign recovery, even when the tab closes. Dashboard checks are also available while this page stays open and visible.</p>
  {notice&&<p className="agent-notice" role="status">{notice}</p>}
  {resources&&<div role="status"><p>Live ads: {resources.adsComplete?resources.ads.length:'unavailable'} · Search campaigns: {resources.campaignsComplete?resources.campaigns.length:'unavailable'}</p>{resources.errors.map(error=><p key={error.section} role="alert"><strong>{error.section==='ads'?'Ads':'Campaigns'}:</strong> {error.message}</p>)}</div>}
  {stale&&<p role="alert">Current control status is unconfirmed. Refresh before relying on the status below.</p>}
  <div className="agent-actions"><button className="secondary" disabled={busy} onClick={()=>void run(refresh)}>Refresh status</button><button className="secondary" disabled={busy||!data} onClick={()=>setWatching(v=>!v)}>{watching?'Stop dashboard checks':'Start dashboard checks'}</button><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{setResources(await api(undefined,true));})}>Load live ads and campaigns</button><button className="primary" disabled={busy||!data} onClick={()=>void run(()=>api({operation:'settings',paused:true}))}>Pause automation</button></div>
  {data&&<>
   <section className="agent-review"><h2>{stale?'Status unconfirmed':data.mode==='STOCK_CONTROL'?(data.checkMode==='scheduled'||watching?'Stock control is active':'Stock control authorized — start dashboard checks'):'Advice mode'}</h2><p>Automatic stock control can pause individually linked ads when stock is unavailable, below its minimum, or product details change materially. It keeps campaigns running and leaves ad restoration for your review.</p>
    <ul>{data.blockers.map(b=><li key={b}>{b}</li>)}</ul>
    <label className="agent-confirm"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>I authorize automatic stock-related pauses for the ads I link below. New publishing and spending changes require separate review.</label>
    <div className="agent-actions"><button className="primary" disabled={busy||stale||!ack||data.blockers.length>0} onClick={()=>void run(()=>api({operation:'settings',enabled:true,paused:false}))}>Enable stock control</button><button className="secondary" disabled={busy||!data.settings.stock_enabled} onClick={()=>void run(()=>api({operation:'settings',enabled:false}))}>Disable stock control</button><button className="secondary" disabled={busy||!data.settings.global_paused} onClick={()=>void run(()=>api({operation:'settings',paused:false}))}>Allow approved actions</button></div>
    <p>{data.settings.global_paused?'Automation is paused. New account changes are blocked; an in-flight Google request may still finish. Existing temporary campaign pauses still recover.':'Approved actions are allowed. Only stock pauses can be approved automatically.'}</p>
   </section>
   <section className="agent-review"><h2>Link stock to a live ad</h2><p>Only link an ad that specifically advertises the selected product. A broad ad for many products must not be linked to a single part.</p>
    <label>Live ad <select value={ad} onChange={e=>setAd(e.target.value)}><option value="">Choose a live ad</option>{resources?.ads.map(a=><option key={a.resourceName} value={a.resourceName}>{a.headlines[0]||a.adId} · {a.status} · {a.approvalStatus} · {a.adId}</option>)}</select></label>
    <label>Inventory part <select value={product} onChange={e=>setProduct(e.target.value)}><option value="">Choose a verified part</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} · stock {p.available??'unknown'}{p.eligible?'':' · requires review'}</option>)}</select></label>
    <button className="secondary" disabled={busy||stale||!ad||!product} onClick={()=>void run(()=>api({operation:'link',resource:ad,productId:product}))}>Save product link and current facts</button>
    {data.mappings.map(m=><p key={m.resource_name}>{data.products.find(p=>p.id===m.product_id)?.name||m.product_id} → ad {m.resource_name.split('/').pop()} <button className="text-btn" disabled={busy} onClick={()=>void run(()=>api({operation:'unlink',resource:m.resource_name}))}>Remove link</button></p>)}
   </section>
   <section className="agent-review"><h2>Prepare an account change</h2><p>This saves a proposal. Approval and execution are separate steps below.</p>
    <label>Change <select value={kind} onChange={e=>setKind(e.target.value as Kind)}><option value="ad_status">Pause or restore the selected live ad</option><option value="campaign_pause">Temporary campaign pause</option><option value="budget_decrease">Reduce a campaign budget</option></select></label>
    {kind==='ad_status'?<label>New ad status <select value={value} onChange={e=>setValue(e.target.value)}><option value="PAUSED">Paused</option><option value="ENABLED">Enabled — current stock and Google approval required</option></select></label>:<label>Campaign <select value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">Choose a campaign</option>{resources?.campaigns.map(c=><option key={c.resourceName} value={c.resourceName}>{c.name} · {c.status}{c.shared?' · shared budget':''}</option>)}</select></label>}
    {kind==='campaign_pause'&&<p>{data.recoveryReady?'The independent recovery worker passed its recent read and validation check.':'Temporary pauses are blocked until the independent recovery worker is healthy.'} Recovery begins eight minutes after execution starts. Outages can delay restoration; an exact ten-minute guarantee is not possible.</p>}
    {kind==='budget_decrease'&&<><p>Current average daily budget: {selected?(selected.budgetMicros===null?'unavailable':Number(selected.budgetMicros)/1000000):'choose a campaign'} in the Google account currency. {selected&&!selected.budgetEditable?'This campaign’s budget cannot be changed here. ':''}Shared budgets and increases are blocked.</p><label>Lower average daily budget <input value={budget} disabled={!selected?.budgetEditable} inputMode="decimal" onChange={e=>setBudget(e.target.value)}/></label><p>Google average daily budgets are not hard daily billing caps. Google may spend up to twice an average daily budget on a given day.</p></>}
    <button className="secondary" disabled={busy||stale||!resources||(kind==='ad_status'?!ad:!campaign)||(kind==='campaign_pause'&&!data.recoveryReady)} onClick={()=>void run(propose)}>Prepare proposal</button>
   </section>
   <section className="agent-review"><h2>Approvals and history</h2>{!data.actions.length&&<p>No account changes have been requested.</p>}{data.actions.map(a=><article key={a.id}><h3>{a.kind.replaceAll('_',' ')} · {a.state}</h3><p>{a.resource_name}</p><p><strong>{a.before_value} → {a.after_value}</strong> · {a.reason}</p><p>{a.source==='stock'?'Covered by your stock-control permission':'Owner approval required'} · expires {new Date(a.expires_at).toLocaleString()}</p>{a.error_code&&<p role="alert">Attention: {a.error_code.replaceAll('_',' ')}. Check the live account before retrying.</p>}{a.recovery_due_at&&a.state!=='recovered'&&<p>Recovery due {new Date(a.recovery_due_at).toLocaleString()}{Date.now()>Date.parse(a.recovery_due_at)&&['confirmed','uncertain','executing'].includes(a.state)?' — recovery needs immediate attention':''}</p>}
    <div>{['proposed','approved'].includes(a.state)&&<button className="text-btn" disabled={busy||stale} onClick={()=>void run(()=>api({operation:'cancel',id:a.id}))}>Cancel this proposal</button>}</div><div className="agent-actions">{a.state==='proposed'&&<button disabled={busy||stale||Date.parse(a.expires_at)<=Date.now()} onClick={()=>void run(()=>api({operation:'approve',id:a.id}))}>Approve this exact change</button>}{a.state==='approved'&&<button disabled={busy||stale||data.settings.global_paused} onClick={()=>void run(async()=>{const r=await api({operation:'execute',id:a.id});setNotice(`Google change result: ${r.state}${r.errorCode?' · '+r.errorCode:''}`);})}>Execute approved change</button>}{['executing','uncertain'].includes(a.state)&&a.kind!=='campaign_pause'&&<button className="secondary" disabled={busy||stale} onClick={()=>void run(async()=>{const r=await api({operation:'reconcile',id:a.id});setNotice('Observed action status: '+r.state);})}>Check result without retrying</button>}{a.state==='confirmed'&&a.kind==='ad_status'&&<button className="secondary" disabled={busy||stale} onClick={()=>void run(()=>api({operation:'rollback',id:a.id,requestId:crypto.randomUUID()}))}>Prepare rollback for approval</button>}</div></article>)}</section>
   <LaptopRecovery campaigns={resources?.campaigns??[]} ready={data.recoveryReady} createCode={async(canary)=>api({operation:'pair',canary})}/>
   <section className="agent-review"><h2>Worker health</h2>{!data.heartbeats.length&&<p>No deployed worker has checked in yet.</p>}{data.heartbeats.map(h=><p key={h.role+h.deployment_id}>{h.role} · {h.ok?'last check passed':'last check failed'} · {new Date(h.checked_at).toLocaleString()} · {h.deployment_id}</p>)}<p>A recovery health check uses Google validation only. It does not claim a live pause/resume test passed.</p></section>
   <details className="agent-review"><summary>Audit history and scope</summary>{data.events.map(e=><p key={e.id}>{new Date(e.created_at).toLocaleString()} · {e.event} · {e.action_id||'settings or product link'}</p>)}<ul>{data.limitations.map(l=><li key={l}>{l}</li>)}</ul></details>
  </>}
 </main></div>;
}
