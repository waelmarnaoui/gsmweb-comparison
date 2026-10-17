'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Opportunity,SearchReport} from '@/lib/ai-ads/search-growth';
import '../../optimizer/agent.css';
type Data={reliable:boolean;error:string|null;report:{search:SearchReport;opportunities:Opportunity[];activeCampaigns:string[];publicationBlockedReason:string}|null;notifications:{notification_key:string;created_at:string;details:{message:string}}[]};
export default function SearchOpportunities(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[voice,setVoice]=useState(false);
 const inFlight=useRef(false),seen=useRef(new Set<string>()),initialized=useRef(false);
 const refresh=useCallback(async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);
  try{const r=await fetch('/api/ai-ads/growth',{method:'POST',cache:'no-store'});if(r.status===401){window.location.assign('/login');return;}const d=await r.json();if(!r.ok)throw new Error(d.error||'Search monitoring is unavailable.');setData(d);setError('');}
  catch(e){setError(e instanceof Error?e.message:'Search monitoring is unavailable.');}finally{inFlight.current=false;setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},60000);return()=>clearInterval(timer);},[refresh]);
 useEffect(()=>{
  if(!data)return;
  const fresh=data.notifications.filter(n=>!seen.current.has(n.notification_key));
  for(const n of data.notifications)seen.current.add(n.notification_key);
  if(initialized.current&&voice&&!document.hidden&&'speechSynthesis' in window&&fresh.length){const u=new SpeechSynthesisUtterance(fresh.length===1?fresh[0].details.message:`${fresh.length} new stock-matched advertising drafts are ready. They have not been published. Review Search opportunities.`);u.lang='en-GB';window.speechSynthesis.speak(u);}
  initialized.current=true;
 },[data,voice]);
 const report=data?.report,search=report?.search,current=!!data?.reliable&&!error;
 return <div className="setup-page"><header className="setup-header"><a href="/ai-ads" className="secondary">Stock and drafts</a><strong>GSMWEB</strong><a href="/ai-ads/control" className="secondary">Account control</a></header><main className="setup-main">
 <h1>Search opportunities</h1><p>The agent checks the actual Google Search campaign schedules and matches reported searches to verified display, battery and charging-port stock. Existing ads, keywords, campaign settings and budgets stay protected.</p>
 <div className="agent-actions"><button disabled={busy} onClick={()=>void refresh()}>{busy?'Checking…':'Refresh searches and stock'}</button><button className="secondary" onClick={()=>{if(!('speechSynthesis' in window)){setError('Voice is unavailable in this browser.');return;}setVoice(v=>!v);if(!voice){const u=new SpeechSynthesisUtterance('Voice notifications enabled for new advertising drafts while this page is open.');u.lang='en-GB';window.speechSynthesis.speak(u);}}}>{voice?'Turn voice off':'Enable voice notifications'}</button></div>
 <p>This page checks every minute while visible; fresh reports are reused for five minutes. The paired laptop also checks in the background while its worker is running. Voice requires this page to remain open and visible.</p>
 {error&&<p role="alert">{error}</p>}{data?.error&&<p role="alert">Latest search collection failed: {data.error}. Historical results below are not current.</p>}
 {!current&&data&&<p role="alert">Current search and inventory evidence is unconfirmed. Drafts below must be rechecked before use.</p>}
 {search&&<section className="agent-review"><h2>{current?'Monitoring current':'Historical monitoring result'}</h2><p>Account {search.accountId} · {search.timeZone} · {search.currency}. Last complete collection {new Date(search.fetchedAt).toLocaleString()}.</p><p>{report!.activeCampaigns.length} campaigns were within their enabled schedule at collection. {search.termsCollected?`${search.terms.length} reported search terms collected for ${search.windowStart} through ${search.windowEnd}.`:'Search-term collection waits until an enabled campaign enters its working schedule.'}</p><p>Google hides some search terms and reporting can lag. These are your account’s reported searches; they do not represent the entire market or live search volume.</p><details><summary>Campaign schedules</summary>{search.campaigns.map(c=><p key={c.id}>{c.name} · {c.status} · {c.schedule.length?c.schedule.map(s=>`${s.day} ${String(Math.floor(s.start/60)).padStart(2,'0')}:${String(s.start%60).padStart(2,'0')}–${String(Math.floor(s.end/60)).padStart(2,'0')}:${String(s.end%60).padStart(2,'0')}`).join(', '):'All hours in Google configuration'}{c.startDate?` · starts ${c.startDate}`:''}{c.endDate?` · ends ${c.endDate}`:''}</p>)}</details></section>}
 <section className="agent-review"><h2>Additional ad drafts</h2><p>New consumer phone hardware-repair ads require policy clearance. The agent prepares drafts but cannot publish them or keep resubmitting wording to bypass that restriction. <a href="https://support.google.com/adspolicy/answer/13527027?hl=en" target="_blank" rel="noreferrer">Google’s official policy</a>.</p>
 {report?.opportunities.map(o=><details key={o.id}><summary>{o.model} · {o.partType} · {o.stock} in stock at preparation · Prepared, not published</summary><p>{o.explanation}</p><p>Campaign: {o.campaignName}. Search evidence: {o.observedTerms.join('; ')}. {o.impressions} impressions · {o.clicks} clicks · {Number(o.costMicros)/1000000} {search?.currency} reported spend. This is not a forecast or profit estimate.</p><p>Stock fingerprint {o.inventoryFingerprint.slice(0,12)}. Any later publication requires a fresh stock read and policy review. Parts are for installation in store, not online sale.</p><h3>15 headlines</h3><ol>{o.draft.headlines.map((h,i)=><li key={i}>{h}</li>)}</ol><h3>Descriptions</h3><ul>{o.draft.descriptions.map((d,i)=><li key={i}>{d}</li>)}</ul><h3>Keyword suggestions</h3><ul>{o.draft.keywords.map((k,i)=><li key={i}>{k.matchType}: {k.text}</li>)}</ul><p>Publishing blocked — policy clearance required.</p></details>)}
 {report&&!report.opportunities.length&&<p>No new stock-matched opportunities were prepared in this collection. This does not mean there is no demand.</p>}{!report&&<p>No complete search collection has been stored yet.</p>}</section>
 <section className="agent-review" aria-live="polite"><h2>Notifications</h2><p>Every new draft is recorded once for the same product, search group and copy. A prepared draft is not a published ad. No existing account changes are permitted.</p>{data?.notifications.map(n=><p key={n.notification_key}>{new Date(n.created_at).toLocaleString()} · {n.details.message}</p>)}{data&&!data.notifications.length&&<p>No new draft notifications yet.</p>}</section>
 </main></div>;
}
