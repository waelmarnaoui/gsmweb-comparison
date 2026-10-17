'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import AdvisorSettings from './advisor-settings';
import type {AdvisoryReply} from '@/lib/agent-model';
import type {AgentAlert} from '@/lib/agent-policy';
import type {DailyFx} from '@/lib/ads-fx';
type Context={accountId:string;aiStatus?:{notice:string};businessDate:string;yesterday:string;checkinDue:boolean;today:{amountBani:number;rating:string;targetReached:boolean;gapBani:number}|null;yesterdayPaymentsBani:number|null;allowance:{allowanceBani:number|null;reason:string};control:{mode:string;canRun?:boolean;notice?:string;health?:string;lastCycleAt?:string|null;canEnable:boolean;maxPauseSeconds:number;blockers:string[]};alerts:AgentAlert[];aiConfigured:boolean;observation:{fetchedAt:string}|null;limitations:string[];fx?:{rate:DailyFx|null;notice:string|null}};
type Exchange={id:string;user_message:string;assistant_reply:AdvisoryReply|null;state:string;observation_at:string|null};
type StockWork={state:'active'|'stale'|'unavailable';observedAt:string|null;qualifiedParts:number|null;draftCount:number|null;notice:string|null};
async function api(path:string,method='GET',body?:unknown){
 const response=await fetch('/api/optimizer/'+path,{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(response.status===401){window.location.assign('/login');throw new Error('Sign in required.');}
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Agent unavailable.');return data;
}
const analysisRequest='Analyze the latest account report. Explain what you observed, the highest priority improvement, expected impact, risks and missing information. Do not change the account.';
export default function AdsAgent(){
 const [context,setContext]=useState<(Context&{stockWork?:StockWork})|null>(null),[history,setHistory]=useState<Exchange[]>([]),[message,setMessage]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[voice,setVoice]=useState(false),[controlReview,setControlReview]=useState(false),[amount,setAmount]=useState(''),[checkDate,setCheckDate]=useState(''),[confirmed,setConfirmed]=useState(false),[automatic,setAutomatic]=useState(false);
 const seenAlerts=useRef(new Set<string>()),lastCheckin=useRef(''),lastAnalysis=useRef(''),analysisPreference=useRef(''),inFlight=useRef(false);
 const [monitoringError,setMonitoringError]=useState('');
 const speak=useCallback((text:string)=>{
  if(!('speechSynthesis' in window)){setNotice('This browser cannot play spoken warnings. Text alerts remain available.');return;}
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-GB';utterance.onerror=()=>setNotice('Voice playback was blocked or failed. Read the visible warning.');window.speechSynthesis.speak(utterance);
 },[]);
 const refresh=useCallback(async()=>{
  try{const [next,chats]=await Promise.all([api('agent'),api('chat')]);setContext(next);setHistory(chats.exchanges);setMonitoringError('');}
  catch(error){setMonitoringError('Agent monitoring cannot refresh. Check the connection and do not rely on old warnings.');setNotice(error instanceof Error?error.message:'Agent unavailable.');}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);return()=>clearInterval(timer);},[refresh]);
 useEffect(()=>{
  if(!voice||document.hidden)return;
  if(monitoringError&&!seenAlerts.current.has('monitoring-error')){seenAlerts.current.add('monitoring-error');speak(monitoringError);}
  if(!monitoringError)seenAlerts.current.delete('monitoring-error');
  if(!context)return;
  for(const alert of context.alerts){if(!seenAlerts.current.has(alert.key)){seenAlerts.current.add(alert.key);speak(alert.message);}}
  if(context.checkinDue&&lastCheckin.current!==context.businessDate){lastCheckin.current=context.businessDate;speak('How was today? Please confirm your total customer payments, including cash, card and transfer. Your daily target is four thousand lei.');}
 },[context,voice,speak,monitoringError]);
 async function send(text:string){
  if(inFlight.current||!text.trim())return;
  inFlight.current=true;setBusy(true);setNotice('');
  try{const result=await api('chat','POST',{id:crypto.randomUUID(),message:text});setMessage('');await refresh();if(voice)speak(result.reply.reply);}
  catch(error){setNotice(error instanceof Error?error.message:'Chat failed.');}
  finally{inFlight.current=false;setBusy(false);}
 }
 useEffect(()=>{
  const observed=context?.observation?.fetchedAt;
  if(document.hidden)return;
  if(!automatic||!context?.aiConfigured||!observed||busy||inFlight.current||Date.now()-Date.parse(observed)>15*60000)return;
  if(lastAnalysis.current===observed||history.some(e=>e.observation_at===observed&&e.user_message===analysisRequest&&e.state==='completed'))return;
  lastAnalysis.current=observed;void send(analysisRequest);
 },[automatic,context,history,busy]);
 useEffect(()=>{const account=context?.accountId;if(!account||analysisPreference.current===account)return;analysisPreference.current=account;try{setAutomatic(localStorage.getItem('gsmweb:auto-analysis:'+account)!=='false');}catch{setAutomatic(true);}},[context?.accountId]);
 async function runControl(){
  if(inFlight.current||!context?.control.canRun)return;
  inFlight.current=true;setBusy(true);setNotice('Running the authorized stock/search control cycle. Waiting for confirmed results…');
  try{const r=await fetch('/api/ai-ads/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'tick'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'The control cycle could not complete.');await refresh();setNotice('Control cycle completed. Review publication history for confirmed actions, Google review results and any holds.');if(voice)speak('The control cycle completed. Review publication history for actual results.');}
  catch(e){setNotice(e instanceof Error?e.message:'The control cycle could not complete.');}finally{inFlight.current=false;setBusy(false);}
 }
 async function saveCheckin(){
  if(!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(amount)||!confirmed){setNotice('Enter customer payments in lei and confirm the total.');return;}
  const [whole,fraction='']=amount.replace(',','.').split('.'),amountBani=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  setBusy(true);try{await api('checkin','POST',{date:checkDate||context?.businessDate,amountBani,confirmed:true});setConfirmed(false);await refresh();setNotice('Customer payments confirmed. Advertising allowance uses the previous day only.');}
  catch(error){setNotice(error instanceof Error?error.message:'Check-in failed.');}finally{setBusy(false);}
 }
 return <section className="agent-panel" aria-labelledby="agent-heading"><div className="agent-heading"><div><div className="eyebrow">GSMWEB ADS AGENT</div><h2 id="agent-heading">Discuss your account</h2><p>{context?.control.notice||'Checking saved account-control permissions…'}</p></div><span className="badge">{!context?'CHECKING MODE':context.control.mode==='CONTROL'?'CONTROL MODE · Stock/search ads':context.control.mode==='PAUSED'?'CONTROL PAUSED':'ADVISE MODE'}</span></div>
  {notice&&<p role="status" className="agent-notice">{notice}</p>}
  <div className="agent-actions"><a className="primary" href="/ai-ads">Open stock monitoring and drafts</a><button className="secondary" onClick={()=>void refresh()}>Refresh monitoring</button>{context?.control.canRun&&<button className="primary" disabled={busy} onClick={()=>void runControl()}>{busy?'Working…':'Run control cycle'}</button>}<button className="secondary" onClick={()=>{if(!voice){if(!('speechSynthesis' in window)){setNotice('This browser cannot play spoken warnings. Text alerts remain available.');return;}speak('Voice warnings are enabled while this dashboard is open.');setVoice(true);}else{window.speechSynthesis?.cancel();setVoice(false);}}}>{voice?'Mute voice':'Enable voice warnings'}</button><button className="secondary" onClick={()=>setControlReview(v=>!v)}>Review live ad control</button></div>
  {context?.control.mode==='CONTROL'&&<p className="agent-small">Background control: {context.control.health==='current'?'recent cycle confirmed':'health needs verification'}.{context.control.lastCycleAt?` Last cycle ${new Date(context.control.lastCycleAt).toLocaleString()}.`:null} <a href="/ai-ads/opportunities">View actual Google actions and holds</a>.</p>}
  <div className="agent-review" role="status"><h3>Stock monitoring and draft preparation</h3><p>{!context?'Checking agent status…':monitoringError?'Current monitoring status is unconfirmed.':context.stockWork?.state==='active'?`${context.stockWork.qualifiedParts} stock-qualified parts · ${context.stockWork.draftCount} drafts prepared.`:context.stockWork?.notice||'A successful stock check is required.'}</p>{context?.stockWork?.observedAt&&<p>Last successful stock read: {new Date(context.stockWork.observedAt).toLocaleString()}.</p>}<p>Opening this dashboard starts read-only stock checks and draft preparation. Checks repeat while it stays open, with a new stock snapshot every five minutes. Live advertising changes require separate approval and verified controls.</p></div>
  <p className="agent-small">Voice is computer-generated by your browser. Keep this page open and allow audio. Closed or suspended pages cannot deliver reliable warnings.</p>
  {controlReview&&<div className="agent-review"><h3>Review live advertising control</h3><p>Daily allowance: 10% of yesterday’s confirmed customer payments, capped at 400 lei. Temporary campaign pauses require independent recovery.</p><p>Stock control and exact-action approvals have their own deployment and permission checks:</p><a className="primary" href="/ai-ads/control">Open Account control</a><p>Unrestricted changes to existing campaigns still require separate safeguards:</p><ul>{(context?.control.blockers??['Connect agent storage and reporting first.']).map(b=><li key={b}>{b}</li>)}</ul></div>}
  <div className="agent-goals"><div><small>Daily customer payment target</small><strong>4,000 lei</strong></div><div><small>Today’s allowed ad spend</small><strong>{context?.allowance.allowanceBani===null||!context?'Unconfirmed':`${(context.allowance.allowanceBani/100).toFixed(2)} lei`}</strong><small>Based on yesterday · allowance capped at 400 lei</small></div><div><small>Today’s confirmed payments</small><strong>{context?.today?`${(context.today.amountBani/100).toFixed(2)} lei`:'Awaiting your check-in'}</strong><small>{context?.today?context.today.targetReached?'Daily target reached':`${(context.today.gapBani/100).toFixed(2)} lei to goal`:'Owner-confirmed total; not CRM profit'}</small></div></div>
  {context?.fx?.rate&&<p className="agent-small">Owner-approved fixed exchange rate: 1 USD = {context.fx.rate.rate.toFixed(2)} RON. Lei spend alerts use this assumption; your bank may charge a different rate.</p>}
  {context?.fx?.notice&&<p role="status">{context.fx.notice}</p>}
  {!!context?.alerts.length&&<div className="agent-alerts" role="alert">{context.alerts.map(alert=><p key={alert.key}><strong>{alert.level==='critical'?'Urgent':'Attention'}:</strong> {context.fx?.rate&&alert.key!=='stale'?'Uses your fixed rate of 4.74 RON per USD. ':''}{alert.message}</p>)}</div>}
  <div className="agent-checkin"><h3>{context?.checkinDue?'How was today?':'Daily customer payments'}</h3><p>At 19:00 Bucharest time, I’ll ask for all customer payments, including cash, card and transfer. While the dashboard is open, the prompt appears automatically.</p><p>Below 500: very bad · 500–999.99: bad · 1,000–1,999.99: good · 2,000+: very good.</p><label>Day <select value={checkDate||context?.businessDate||''} onChange={e=>{setCheckDate(e.target.value);setConfirmed(false);}}>{context&&<><option value={context.businessDate}>Today ({context.businessDate})</option><option value={context.yesterday}>Yesterday ({context.yesterday})</option></>}</select></label><label> Customer payments (lei) <input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setConfirmed(false);}} placeholder="e.g. 4000"/></label><label className="agent-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm this total includes all customer payments for the selected day.</label><button className="secondary" disabled={busy||!confirmed||!context} onClick={saveCheckin}>Confirm daily payments</button><p className="agent-small">A correction is saved as a new record. Today’s check-in changes tomorrow’s allowance, never today’s.</p></div>
  <label className="agent-confirm"><input type="checkbox" checked={automatic} onChange={e=>{setAutomatic(e.target.checked);if(context?.accountId){try{localStorage.setItem('gsmweb:auto-analysis:'+context.accountId,String(e.target.checked));}catch{}}}} disabled={!context?.aiConfigured}/>Automatically analyze new reports while this dashboard is open</label>
  {!context?.aiConfigured&&<p>{context?.aiStatus?.notice||'Check AI connection settings below to enable real chat and automatic analysis.'}</p>}
  <AdvisorSettings onConfigured={()=>void refresh()}/>
  <div className="agent-chat" aria-live="polite">{history.length===0&&<p>Ask what is driving costs, how to improve search visibility, or what evidence is needed before changing a campaign.</p>}{history.map(exchange=><article key={exchange.id}><p><strong>You:</strong> {exchange.user_message}</p>{exchange.assistant_reply?<div><p><strong>GSMWEB advisor:</strong> {exchange.assistant_reply.reply}</p><details><summary>Evidence and recommendation · {exchange.assistant_reply.confidence} confidence</summary><ul>{exchange.assistant_reply.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul><p><strong>Recommendation:</strong> {exchange.assistant_reply.recommendation}</p><p><strong>Expected impact:</strong> {exchange.assistant_reply.expectedImpact}</p><p><strong>Risks:</strong> {exchange.assistant_reply.risks}</p><p><strong>Missing data:</strong> {exchange.assistant_reply.missingData.join('; ')||'None reported'}</p></details><button className="text-btn" onClick={()=>speak(exchange.assistant_reply!.reply)}>Read aloud</button></div>:<p>{exchange.state==='pending'?'Analysis in progress…':'This request failed. Send a new message to retry.'}</p>}</article>)}</div>
  <form onSubmit={e=>{e.preventDefault();void send(message);}}><label htmlFor="agent-message">Message your advisor</label><textarea id="agent-message" value={message} maxLength={4000} onChange={e=>setMessage(e.target.value)} placeholder="What would you improve first, and why?"/><div className="agent-actions"><button className="primary" disabled={busy||!context?.aiConfigured||!message.trim()}>{busy?'Analyzing…':'Send message'}</button><button type="button" className="secondary" disabled={busy||!context?.aiConfigured} onClick={()=>void send(analysisRequest)}>Analyze latest report</button></div></form>
  <p className="agent-small">Chat explains evidence and confirmed actions. The authorized background controller and Run control cycle action execute stock/search work; free-text messages do not grant extra permissions. Google’s reported spend can lag actual spend; no zero-risk or exact intraday billing guarantee is possible.</p>
 </section>;
}
