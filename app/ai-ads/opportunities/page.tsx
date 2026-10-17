'use client';

import {useCallback,useEffect,useRef,useState} from 'react';



import {COPY_RULES_VERSION} from '@/lib/ai-ads/copy-rules';

import type {Opportunity,SearchReport} from '@/lib/ai-ads/search-growth';

import '../../optimizer/agent.css';

type Data={reliable:boolean;error:string|null;report:{copyRulesVersion?:string;search:SearchReport;opportunities:Opportunity[];activeCampaigns:string[];publicationBlockedReason:string}|null;notifications:{notification_key:string;created_at:string;details:{message:string}}[]};

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

 return <main className="setup-main"><div className="workspace-heading"><h1>Create ads</h1><a className="secondary" href="/optimizer/ads">Ads & status</a></div>
 <div className="workspace-toolbar"><button className="primary" disabled={busy} onClick={()=>void refresh()}>{busy?'Preparing drafts...':'Prepare drafts from searches & stock'}</button><span className="agent-small">{report?.opportunities.length??0} prepared drafts</span></div>
 {error&&<p role="alert" className="agent-notice">{error}</p>}{data?.error&&<p role="alert" className="agent-notice">Latest collection failed: {data.error}. Saved results are not current.</p>}{!current&&data&&<p role="alert">Current stock and search evidence is unconfirmed.</p>}
 {search&&<p className="agent-small">{search.terms.length} reported searches · {report!.activeCampaigns.length} campaigns within their schedule · Last collection: {new Date(search.fetchedAt).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}</p>}
 {report&&report.copyRulesVersion!==COPY_RULES_VERSION&&<p role="status">Drafts need a complete collection with current copy rules.</p>}
 <div className="table-scroll"><table><thead><tr><th>Model</th><th>Part / stock</th><th>Search evidence</th><th>Draft review</th></tr></thead><tbody>{(report?.copyRulesVersion===COPY_RULES_VERSION?report.opportunities:[]).map(o=><tr key={o.id}><td><b>{o.model}</b><small>{o.campaignName}</small></td><td>{o.partType}<small>{o.stock} available at preparation</small></td><td>{o.observedTerms.join('; ')}<small>{o.impressions} impressions · {o.clicks} clicks</small></td><td><details><summary>Review ad assets</summary><p>{o.explanation}</p><p>Campaign: {o.campaignName}. Search evidence: {o.observedTerms.join('; ')}. {o.impressions} impressions · {o.clicks} clicks · {Number(o.costMicros)/1000000} {search?.currency} reported spend. This is not a forecast or profit estimate.</p><p>Stock fingerprint {o.inventoryFingerprint.slice(0,12)}. Any later publication requires a fresh stock read and policy review. Parts are for installation in store, not online sale.</p>{o.draft.pinnedHeadlines?.map(p=><p key={p.field}>Required headline position 1: {p.text}</p>)}{o.draft.pinnedDescriptions?.map(p=><p key={p.field}>Required description position 1: {p.text}</p>)}<h3>15 headlines</h3><ol>{o.draft.headlines.map((h,i)=><li key={i}>{h}</li>)}</ol><h3>Descriptions</h3><ul>{o.draft.descriptions.map((d,i)=><li key={i}>{d}</li>)}</ul><h3>Keyword suggestions</h3><ul>{o.draft.keywords.map((k,i)=><li key={i}>{k.matchType}: {k.text}</li>)}</ul><p>Draft evidence only. Publication and policy decisions are recorded under Ads & status.</p></details></td></tr>)}</tbody></table></div>
 {report&&!report.opportunities.length&&<p className="empty-state">No stock-matched drafts available from the reported searches.</p>}{!report&&!busy&&<p className="empty-state">No complete search collection yet.</p>}
 <details className="publishing-settings"><summary>Publication safeguards</summary><p>Preparation does not publish an ad. New truthful installation-only ads enter Google review through the separately authorized publishing workflow. Groups remain paused until exact Google approval and current stock, campaign schedule, targeting and allowance checks pass. Original ads and budgets stay protected.</p><p>Google can restrict third-party technical-support offers. A business-policy rejection is not corrected by disguising a repair as a part sale. <a href="https://support.google.com/adspolicy/answer/13527027?hl=en" target="_blank" rel="noreferrer">Google policy</a>.</p><p><a href="/optimizer/ads">Publishing settings and actual submission results</a></p></details>
 <details className="publishing-settings"><summary>Recent draft notifications ({data?.notifications.length??0})</summary><div className="table-scroll"><table><thead><tr><th>Time</th><th>Event</th></tr></thead><tbody>{data?.notifications.map(item=><tr key={item.notification_key}><td>{new Date(item.created_at).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}</td><td>{item.details.message}</td></tr>)}</tbody></table></div></details>
 </main>;
}

