'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {StockSnapshot} from '@/lib/ai-ads/monitor';
type Monitor={snapshot:StockSnapshot|null;stale:boolean;reliable:boolean;lastAttemptFailed:boolean;lastAttemptAt:string|null;executionEnabled:false;mode:string};
export default function AiAdsManager(){
 const [monitor,setMonitor]=useState<Monitor|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0),[voice,setVoice]=useState(false),[voiceNotice,setVoiceNotice]=useState('');
 const inFlight=useRef(false),spoken=useRef(new Set<string>());
 const refresh=useCallback(async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/ai-ads/monitor',{method:'POST',cache:'no-store'});
   if(response.status===401){window.location.assign('/login');return;}
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Stock monitoring is unavailable.');setMonitor(result);
  }catch(cause){setError(cause instanceof Error?cause.message:'Stock monitoring is unavailable.');}finally{setBusy(false);inFlight.current=false;}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},60000);return()=>clearInterval(timer);},[refresh]);
 const snapshot=monitor?.snapshot,reliable=!!monitor?.reliable&&!error;
 useEffect(()=>{
  if(!voice||document.hidden||!('speechSynthesis' in window))return;
  const unavailable=error||monitor?.lastAttemptFailed||monitor?.stale;
  const key=unavailable?'source-unavailable':snapshot?.observedAt;
  if(!key||spoken.current.has(key))return;
  const count=snapshot?.events.filter(event=>event.kind==='unavailable').length??0;
  const text=unavailable?'Stock monitoring cannot confirm current availability. Review the dashboard before using stock-based advertising recommendations.':count?`${count} previously qualified parts are now unavailable or below the stock threshold. Review any advertising that relies on those parts. No ads were changed.`:'';
  if(text){spoken.current.add(key);const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-GB';window.speechSynthesis.speak(utterance);}
  if(!unavailable)spoken.current.delete('source-unavailable');
 },[voice,error,monitor,snapshot]);
 const parts=(snapshot?.parts??[]).filter(part=>part.category==='PART'&&`${part.name} ${part.sku} ${part.models.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const pages=Math.max(1,Math.ceil(parts.length/100)),currentPage=Math.min(page,pages-1);
 return <div className="setup-page"><header className="setup-header"><a href="/" className="secondary">Dashboard</a><strong>GSMWEB</strong><a href="/optimizer" className="secondary">Ads monitoring and chat</a></header>
 <main className="setup-main"><h1>AI Ads Manager</h1><p>Monitor parts available for repairs in your store and review stock-based advertising drafts.</p>
 <section className="setup-provider"><h2>Monitor and prepare drafts</h2><p>No campaigns are published, paused, re-enabled or given extra budget by this module. Google’s third-party consumer technical-support policy includes offline hardware repair. Publication remains blocked pending policy clarification and your approval.</p><a href="https://support.google.com/adspolicy/answer/13527027?hl=en" target="_blank" rel="noreferrer">Read the official policy</a></section>
 <div className="setup-actions"><button className="primary" disabled={busy} onClick={()=>void refresh()}>{busy?'Checking stock…':'Refresh stock'}</button><button className="secondary" onClick={()=>{
  if(!('speechSynthesis' in window)){setVoiceNotice('This browser cannot play voice warnings. Text alerts remain available.');return;}
  if(voice){window.speechSynthesis.cancel();setVoice(false);}else{const message=new SpeechSynthesisUtterance('Stock voice warnings are enabled while this dashboard is open.');window.speechSynthesis.speak(message);setVoice(true);}
 }}>{voice?'Mute stock voice warnings':'Enable stock voice warnings'}</button></div>
 <p>While open, this page checks every minute and collects a complete stock snapshot when the previous one is five minutes old. Closed dashboards require the authenticated stock scheduler endpoint to be configured. Voice warnings require this page to stay open.</p>
 {error&&<p role="alert">{error}</p>}{voiceNotice&&<p role="status">{voiceNotice}</p>}
 {monitor?.lastAttemptFailed&&<p role="alert">The latest inventory read failed. Verify the saved CRM connection and inventory fields. Any stock and drafts below are from the last successful read and must not be treated as current.</p>}
 {snapshot&&<>
 <p role="status">{reliable?'Current stock checks passed.':'Current availability is unconfirmed.'} Last successful read: {new Date(snapshot.observedAt).toLocaleString()}. Source: {snapshot.sourceProject}.</p>
 <p><strong>{snapshot.summary.stockQualified}</strong> stock-qualified parts · {snapshot.summary.outOfStock} out of stock · {snapshot.summary.lowStock} below the minimum · {snapshot.summary.parts} parts checked.</p>
 <p>Saved repair allocations are already deducted from available stock. This read does not reserve parts. Part prices are not repair quotes; stock depth does not establish demand, profit or advertising eligibility.</p>
 <section><h2>Changes since the previous successful read</h2>{snapshot.events.length===0?<p>No changes were found, or this is the first successful snapshot.</p>:<ul>{snapshot.events.map(event=><li key={event.id}><strong>{event.name}</strong>: {event.before??'Unknown'} → {event.after??'Unknown'}. {event.message}</li>)}</ul>}</section>
 <section><h2>Parts and availability</h2><label>Find a part or model <input value={query} maxLength={120} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
 <div className="table-scroll"><table><caption>Recorded stock and verified compatibility</caption><thead><tr><th>Part</th><th>Models recorded</th><th>Available</th><th>Minimum</th><th>Stock checks</th></tr></thead><tbody>{parts.slice(currentPage*100,(currentPage+1)*100).map(part=><tr key={part.id}><td>{part.name}<small>{part.sku}</small></td><td>{part.models.join(', ')||'Unknown'}</td><td>{part.available??'Unknown'}</td><td>{part.minimumStock}</td><td>{part.eligible?'Stock qualified':part.reasons.join(', ')}</td></tr>)}</tbody></table></div>
 <p>{parts.length} matching parts · Page {currentPage+1} of {pages}</p><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous parts</button> <button disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Next parts</button></section>
 <section><h2>Stock-based repair advertising drafts</h2><p>Prepared from recorded part types and compatible models, ordered by available stock. These are rule-based draft suggestions, not measured demand or keyword-volume estimates. Every draft remains blocked from publication.</p>
 {!reliable&&<p role="alert">Refresh successfully before relying on draft stock evidence.</p>}
 {snapshot.drafts.map(draft=><details key={draft.id}><summary>{draft.headlines[0]} · {draft.stockAtGeneration} parts at preparation · Publishing blocked</summary><p>Prepared {new Date(draft.createdAt).toLocaleString()}. Stock evidence: {draft.inventoryFingerprint.slice(0,12)}.</p><h3>Headlines</h3><ul>{draft.headlines.map(text=><li key={text}>{text}</li>)}</ul><h3>Descriptions</h3><ul>{draft.descriptions.map(text=><li key={text}>{text}</li>)}</ul><h3>Keyword suggestions</h3><ul>{draft.keywords.map(keyword=><li key={`${keyword.matchType}:${keyword.text}`}>{keyword.matchType}: {keyword.text}</li>)}</ul><p>Search volume, competition, expected revenue and repair price are unknown. Negative keywords require a separate relevance review.</p><h3>Policy review</h3><ul>{draft.policy.issues.map(issue=><li key={issue.code}><strong>{issue.risk}</strong>: {issue.explanation} {issue.correction} <a href={issue.source} target="_blank" rel="noreferrer">Official source</a></li>)}</ul><button disabled>Approve and publish — policy and account controls incomplete</button></details>)}
 {snapshot.drafts.length===0&&<p>No stock-qualified parts can generate a draft.</p>}{snapshot.draftsOmitted>0&&<p>Showing the first 50 drafts by stock depth; {snapshot.draftsOmitted} additional qualified parts are not drafted in this snapshot.</p>}</section>
 </>}
 {!snapshot&&!busy&&!error&&<p>No successful stock snapshot has been stored yet.</p>}
 </main></div>;
}
