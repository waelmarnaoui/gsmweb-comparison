'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {StockSnapshot} from '@/lib/ai-ads/monitor';
import AdPolicyReview from '@/components/ad-policy-review';
import {gsmwebLocalPlan} from '@/lib/ai-ads/business-profile';
import {advertisingPartType,COPY_RULES_VERSION} from '@/lib/ai-ads/copy-rules';
type Monitor={snapshot:StockSnapshot|null;stale:boolean;reliable:boolean;lastAttemptFailed:boolean;lastAttemptAt:string|null;executionEnabled:false;mode:string;diagnostic?:{code:string;table:string|null;action:string}|null};
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
 const currentCopyRules=snapshot?.copyRulesVersion===COPY_RULES_VERSION;
 useEffect(()=>{
  if(!voice||document.hidden||!('speechSynthesis' in window))return;
  const unavailable=error||monitor?.lastAttemptFailed||monitor?.stale;
  const key=unavailable?'source-unavailable':snapshot?.observedAt;
  if(!key||spoken.current.has(key))return;
  const count=snapshot?.events.filter(event=>event.kind==='unavailable').length??0;
  const text=unavailable?'Stock monitoring cannot confirm current availability. Review the dashboard before using stock-based advertising recommendations.':count?`${count} previously qualified parts are now unavailable or below the stock threshold. Review Account control for the status of any linked ad changes.`:'';
  if(text){spoken.current.add(key);const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-GB';window.speechSynthesis.speak(utterance);}
  if(!unavailable)spoken.current.delete('source-unavailable');
 },[voice,error,monitor,snapshot]);
 const parts=(snapshot?.parts??[]).filter(part=>part.category==='PART'&&advertisingPartType(part.partType)&&`${part.name} ${part.sku} ${part.models.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const pages=Math.max(1,Math.ceil(parts.length/100)),currentPage=Math.min(page,pages-1);
 return <div className="setup-page"><header className="setup-header"><a href="/" className="secondary">Dashboard</a><strong>GSMWEB</strong><a href="/optimizer" className="secondary">Ads monitoring and chat</a></header>
 <main className="setup-main"><h1>AI Ads Manager</h1><p>Advertising uses displays, batteries and charging ports only. Small parts are excluded. Each new draft and copy variant contains 15 headlines, including three keyword-insertion assets, and four descriptions.</p><p>Keyword insertion uses Google’s syntax, such as {'{KeyWord:GSMWEB Drumul Taberei}'}. The complete headline default stays inside the braces, with no text outside. It inserts a matching ad-group keyword when it fits, otherwise the default text. It does not change location targeting or guarantee lower costs. Restricted wording is excluded from generated headlines, descriptions and keywords.</p>
 <section className="setup-provider"><h2>Search-driven opportunities</h2><p><a href="/ai-ads/opportunities">View reported searches, stock-matched drafts and notifications</a>. Existing ads are protected.</p><h2>Monitor and prepare drafts</h2><p>This page prepares drafts. <a href="/ai-ads/control">Open Account control</a> to configure stock-related pauses and review exact account changes. No new campaigns are published here. Google’s third-party consumer technical-support policy includes offline hardware repair. Publication remains blocked pending policy clarification and your approval.</p><a href="https://support.google.com/adspolicy/answer/13527027?hl=en" target="_blank" rel="noreferrer">Read the official policy</a></section>
 <section className="setup-provider"><h2>Your local campaign brief</h2><p><a href={gsmwebLocalPlan.website} target="_blank" rel="noreferrer">gsmweb.site</a> · {gsmwebLocalPlan.address}</p><p>Focus: {gsmwebLocalPlan.targetArea}. Proposed location matching: people in or regularly in the selected area, rather than interest-only searches from elsewhere.</p><p>Exact Google location boundaries and any radius are not yet verified or applied. Top placement and the lowest cost cannot both be guaranteed. The 3 lei CPC is a goal, not an auction guarantee.</p><p>Website hours: {gsmwebLocalPlan.websiteHours}. Confirm these before an ad schedule is activated.</p></section>
 <AdPolicyReview/>
 <div className="setup-actions"><button className="primary" disabled={busy} onClick={()=>void refresh()}>{busy?'Checking stock…':'Refresh stock'}</button><button className="secondary" onClick={()=>{
  if(!('speechSynthesis' in window)){setVoiceNotice('This browser cannot play voice warnings. Text alerts remain available.');return;}
  if(voice){window.speechSynthesis.cancel();setVoice(false);}else{const message=new SpeechSynthesisUtterance('Stock voice warnings are enabled while this dashboard is open.');window.speechSynthesis.speak(message);setVoice(true);}
 }}>{voice?'Mute stock voice warnings':'Enable stock voice warnings'}</button></div>
 <p>While open, this page checks every minute and collects a complete stock snapshot when the previous one is five minutes old. Closed dashboards require the authenticated stock scheduler endpoint to be configured. Voice warnings require this page to stay open.</p>
 {error&&<p role="alert">{error}</p>}{voiceNotice&&<p role="status">{voiceNotice}</p>}
 {monitor?.lastAttemptFailed&&<p role="alert">The latest inventory read failed. Verify the saved CRM connection and inventory fields. Any stock and drafts below are from the last successful read and must not be treated as current.</p>}
 {monitor?.lastAttemptFailed&&monitor.diagnostic&&<p role="alert">Stock diagnostic: {monitor.diagnostic.code}{monitor.diagnostic.table?` · ${monitor.diagnostic.table}`:''}. {monitor.diagnostic.action}</p>}
 {snapshot&&<>
 <p role="status">{reliable?'Current stock checks passed.':'Current availability is unconfirmed.'} Last successful read: {new Date(snapshot.observedAt).toLocaleString()}. Source: {snapshot.sourceProject}.</p>
 <p><strong>{snapshot.parts.filter(part=>part.eligible&&part.category==='PART'&&advertisingPartType(part.partType)).length}</strong> stock-qualified displays, batteries and charging ports. Small parts do not enter advertising preparation.</p>
 <p>Monitoring covers products with recorded stock lots, including depleted lots. Catalogue templates with no received lots are outside this read and cannot generate ads. Saved repair allocations are already deducted from available stock. This read does not reserve parts. Part prices are not repair quotes; stock depth does not establish demand, profit or advertising eligibility.</p>
 <section><h2>Changes since the previous successful read</h2>{snapshot.events.length===0?<p>No changes were found, or this is the first successful snapshot.</p>:<ul>{snapshot.events.map(event=><li key={event.id}><strong>{event.name}</strong>: {event.before??'Unknown'} → {event.after??'Unknown'}. {event.message}</li>)}</ul>}</section>
 <section><h2>Parts and availability</h2><label>Find a part or model <input value={query} maxLength={120} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
 <div className="table-scroll"><table><caption>Recorded stock and verified compatibility</caption><thead><tr><th>Part</th><th>Models recorded</th><th>Available</th><th>Minimum</th><th>Stock checks</th></tr></thead><tbody>{parts.slice(currentPage*100,(currentPage+1)*100).map(part=><tr key={part.id}><td>{part.name}<small>{part.sku}</small></td><td>{part.models.join(', ')||'Unknown'}</td><td>{part.available??'Unknown'}</td><td>{part.minimumStock}</td><td>{part.eligible?'Stock qualified':part.reasons.join(', ')}</td></tr>)}</tbody></table></div>
 <p>{parts.length} matching parts · Page {currentPage+1} of {pages}</p><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous parts</button> <button disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Next parts</button></section>
 <section><h2>Stock-based repair advertising drafts</h2><p>Each draft has two installation headlines and 13 headlines about the recorded part, GSMWEB or its location. Installation is mandatory, not a standalone part sale. The draft requires an installation headline at position 1 and the mandatory disclosure at description position 1; these are preparation instructions, not live Google changes.</p><p>Prepared from recorded part types and compatible models, ordered by available stock. These are rule-based draft suggestions, not measured demand or keyword-volume estimates. Every draft remains blocked from publication.</p>
 {!currentCopyRules&&<p role="status">The saved draft set predates your new copy rules. Historical drafts are hidden here; the next five-minute stock collection prepares the 15-headline versions.</p>}
 {!reliable&&<p role="alert">Refresh successfully before relying on draft stock evidence.</p>}
 {(currentCopyRules?snapshot.drafts:[]).map(draft=><details key={draft.id}><summary>{draft.headlines[0]} · {draft.stockAtGeneration} parts at preparation · Publishing blocked</summary><p>Prepared {new Date(draft.createdAt).toLocaleString()}. Stock evidence: {draft.inventoryFingerprint.slice(0,12)}.</p>{draft.pinnedHeadlines?.map(p=><p key={p.field}>Required headline position 1: {p.text}</p>)}{draft.pinnedDescriptions?.map(p=><p key={p.field}>Required description position 1: {p.text}</p>)}<h3>Headlines</h3><ul>{draft.headlines.map(text=><li key={text}>{text}</li>)}</ul><h3>Descriptions</h3><ul>{draft.descriptions.map(text=><li key={text}>{text}</li>)}</ul><h3>Headline and description variants</h3><p>Up to three factual alternatives. Internal drafts have not been submitted to Google. Eligibility is unknown until Google reviews the exact submitted ad.</p>{draft.variants?.map(variant=><details key={variant.id}><summary>{variant.label} · {variant.googleReview}</summary><ul>{variant.headlines.map((text,index)=><li key={`h-${index}`}>{text}</li>)}</ul><ul>{variant.descriptions.map((text,index)=><li key={`d-${index}`}>{text}</li>)}</ul></details>)}{!draft.variants&&<p>Refresh stock to prepare variants for this historical draft.</p>}<h3>Keyword suggestions</h3><ul>{draft.keywords.map(keyword=><li key={`${keyword.matchType}:${keyword.text}`}>{keyword.matchType}: {keyword.text}</li>)}</ul><p>Search volume, competition, expected revenue and repair price are unknown. Negative keywords require a separate relevance review.</p><h3>Policy review</h3><ul>{draft.policy.issues.map(issue=><li key={issue.code}><strong>{issue.risk}</strong>: {issue.explanation} {issue.correction} <a href={issue.source} target="_blank" rel="noreferrer">Official source</a></li>)}</ul><button disabled>Approve and publish — policy and account controls incomplete</button></details>)}
 {currentCopyRules&&snapshot.drafts.length===0&&<p>No stock-qualified parts can generate a draft.</p>}{currentCopyRules&&snapshot.draftsOmitted>0&&<p>Showing the first 50 drafts by stock depth; {snapshot.draftsOmitted} additional qualified parts are not drafted in this snapshot.</p>}</section>
 </>}
 {!snapshot&&!busy&&!error&&<p>No successful stock snapshot has been stored yet.</p>}
 </main></div>;
}
