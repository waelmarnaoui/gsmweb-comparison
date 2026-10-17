'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import AgentComposer from './agent-composer';
import {ADS_WEB_ONLY} from '@/lib/ads-web-mode';
import {RefreshCw,Square,Volume2} from 'lucide-react';
import type {ChatAttachment} from '@/lib/chat-attachments';

import type {AdvisoryReply} from '@/lib/agent-model';
import type {AgentAlert} from '@/lib/agent-policy';
import type {DailyFx} from '@/lib/ads-fx';
type Context={chatActionsEnabled?:boolean;accountId:string;aiStatus?:{notice:string};businessDate:string;yesterday:string;checkinDue:boolean;today:{amountBani:number;rating:string;targetReached:boolean;gapBani:number}|null;yesterdayPaymentsBani:number|null;allowance:{allowanceBani:number|null;reason:string};control:{mode:string;canRun?:boolean;notice?:string;health?:string;lastCycleAt?:string|null;canEnable:boolean;maxPauseSeconds:number;blockers:string[]};alerts:AgentAlert[];aiConfigured:boolean;observation:{fetchedAt:string}|null;limitations:string[];fx?:{rate:DailyFx|null;notice:string|null}};
type Exchange={id:string;user_message:string;assistant_reply:AdvisoryReply|null;state:string;observation_at:string|null};
type StockWork={state:'active'|'stale'|'unavailable';observedAt:string|null;qualifiedParts:number|null;draftCount:number|null;notice:string|null};
async function api(path:string,method='GET',body?:unknown){
 const response=await fetch('/api/optimizer/'+path,{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(response.status===401){window.location.assign('/login');throw new Error('Sign in required.');}
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Agent unavailable.');return data;
}
const analysisRequest='Analyze the latest account report. Explain what you observed, the highest priority improvement, expected impact, risks and missing information. Do not change the account.';
export default function AdsAgent(){
 const [context,setContext]=useState<(Context&{stockWork?:StockWork})|null>(null),[history,setHistory]=useState<Exchange[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[amount,setAmount]=useState(''),[checkDate,setCheckDate]=useState(''),[confirmed,setConfirmed]=useState(false),[automatic,setAutomatic]=useState(false);
 const [voiceActive,setVoiceActive]=useState(false);
 const chatEnd=useRef<HTMLDivElement>(null);
 useEffect(()=>{chatEnd.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[history.length,history.at(-1)?.state]);
 const lastAnalysis=useRef(''),analysisPreference=useRef(''),inFlight=useRef(false);
 const [monitoringError,setMonitoringError]=useState('');
 const refreshing=useRef(false);
 const speak=useCallback((text:string)=>{
  if(!('speechSynthesis' in window)){setNotice('This browser cannot play spoken warnings. Text alerts remain available.');return;}
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-GB';utterance.onerror=()=>setNotice('Voice playback was blocked or failed. Read the visible warning.');window.speechSynthesis.speak(utterance);
 },[]);
 const refresh=useCallback(async()=>{
  if(refreshing.current)return;
  refreshing.current=true;
  try{await Promise.all([api('agent').then(next=>setContext(next)),...(inFlight.current?[]:[api('chat').then(chats=>{if(!inFlight.current)setHistory(chats.exchanges);})])]);setMonitoringError('');}
  catch(error){setMonitoringError('Agent monitoring cannot refresh. Check the connection and do not rely on old warnings.');setNotice(error instanceof Error?error.message:'Agent unavailable.');}
  finally{refreshing.current=false;}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function send(text:string,attachments:ChatAttachment[]=[],readOnly=false):Promise<string|null>{
  if(inFlight.current||!text.trim())return null;
  inFlight.current=true;setBusy(true);setNotice('');const id=crypto.randomUUID();
  setHistory(previous=>[...previous,{id,user_message:text+(attachments.length?'\n[Attached: '+attachments.map(file=>file.name).join(', ')+']':''),assistant_reply:null,state:'pending',observation_at:null}]);
  try{const result=await api('chat','POST',{id,message:text,attachments,readOnly});setHistory(previous=>previous.map(exchange=>exchange.id===id?{...exchange,assistant_reply:result.reply,state:'completed'}:exchange));void refresh();return result.reply.reply;}
  catch(error){setHistory(previous=>previous.map(exchange=>exchange.id===id?{...exchange,state:'failed'}:exchange));setNotice(error instanceof Error?error.message:'Chat failed.');try{const chats=await api('chat');setHistory(chats.exchanges);}catch{/* Keep the visible failure if history is unavailable. */}return null;}
  finally{inFlight.current=false;setBusy(false);}
 }
 useEffect(()=>{
  const observed=context?.observation?.fetchedAt;
  if(ADS_WEB_ONLY||document.hidden)return;
  if(voiceActive||!automatic||!context?.aiConfigured||!observed||busy||inFlight.current||Date.now()-Date.parse(observed)>15*60000)return;
  if(lastAnalysis.current===observed||history.some(e=>e.observation_at===observed&&e.user_message===analysisRequest&&e.state==='completed'))return;
  lastAnalysis.current=observed;void send(analysisRequest);
 },[automatic,context,history,busy,voiceActive]);
 useEffect(()=>{if(ADS_WEB_ONLY){setAutomatic(false);return;}const account=context?.accountId;if(!account||analysisPreference.current===account)return;analysisPreference.current=account;try{setAutomatic(localStorage.getItem('gsmweb:auto-analysis:'+account)!=='false');}catch{setAutomatic(true);}},[context?.accountId]);
 async function runControl(){
  if(inFlight.current||!context?.control.canRun)return;
  inFlight.current=true;setBusy(true);setNotice('Collecting a manual report on the web server. No Ads changes will run.');
  try{const r=await fetch('/api/ai-ads/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'tick'})});const d=await r.json();if(!r.ok)throw new Error(d.error||'The control cycle could not complete.');await refresh();setNotice('Manual report collected. Existing ads were not changed.');}
  catch(e){setNotice(e instanceof Error?e.message:'The control cycle could not complete.');}finally{inFlight.current=false;setBusy(false);}
 }
 async function saveCheckin(){
  if(!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(amount)||!confirmed){setNotice('Enter customer payments in lei and confirm the total.');return;}
  const [whole,fraction='']=amount.replace(',','.').split('.'),amountBani=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  setBusy(true);try{await api('checkin','POST',{date:checkDate||context?.businessDate,amountBani,confirmed:true});setConfirmed(false);await refresh();setNotice('Customer payments confirmed. Advertising allowance uses the previous day only.');}
  catch(error){setNotice(error instanceof Error?error.message:'Check-in failed.');}finally{setBusy(false);}
 }
 return <section className="agent-panel" aria-labelledby="agent-heading"><div className="agent-heading"><div><h2 id="agent-heading">Your marketing agent</h2><p className="agent-small">{context?.stockWork?.state==='active'?`${context.stockWork.qualifiedParts} stock-qualified parts · ${context.stockWork.draftCount} prepared drafts`:context?.stockWork?.notice||'Checking business connections'}</p></div><span className="badge">{!context?'Connecting':context.chatActionsEnabled?'Connected tools':context.control.mode==='CONTROL'?'Stock/search control':'Advice mode'}</span></div>
 {notice&&<p role="status" className="agent-notice">{notice}</p>}{monitoringError&&<p role="alert" className="agent-notice">{monitoringError}</p>}
 {!!context?.alerts.length&&<details className="agent-settings-fold" open={context.alerts.some(alert=>alert.level==='critical')}><summary>Account alerts ({context.alerts.length})</summary>{context.alerts.map(alert=><p key={alert.key}>{alert.message}</p>)}</details>}
 <div className="agent-chat" role="log" aria-label="Marketing conversation" aria-live="polite">{history.length===0&&<div className="empty-state">What would you like to work on today?</div>}{history.map(exchange=><article key={exchange.id}><p className="user-message">{exchange.user_message}</p>{exchange.assistant_reply?<div><p><strong>{exchange.state==='failed'?'Request stopped':'GSMWeb agent'}</strong></p><p>{exchange.assistant_reply.reply}</p><div className="agent-controls"><button type="button" className="workspace-icon" disabled={voiceActive} title="Read reply aloud" aria-label="Read reply aloud" onClick={()=>speak(exchange.assistant_reply!.reply)}><Volume2 size={16}/></button><button type="button" className="workspace-icon" disabled={voiceActive} title="Stop speaking" aria-label="Stop speaking" onClick={()=>window.speechSynthesis?.cancel()}><Square size={15}/></button><details><summary>Evidence · {exchange.assistant_reply.confidence} confidence</summary><ul>{exchange.assistant_reply.evidence.map((item,index)=><li key={index}>{item}</li>)}</ul><p><strong>Recommendation:</strong> {exchange.assistant_reply.recommendation}</p><p><strong>Expected impact:</strong> {exchange.assistant_reply.expectedImpact}</p><p><strong>Risks:</strong> {exchange.assistant_reply.risks}</p><p><strong>Missing data:</strong> {exchange.assistant_reply.missingData.join('; ')||'None reported'}</p></details></div></div>:<p className="agent-pending">{exchange.state==='pending'?'Working with connected tools. Waiting for a confirmed response.':'Request not completed. Check activity before retrying account actions.'}</p>}</article>)}
 <div ref={chatEnd}/></div>
 <div className="agent-quick-prompts"><button disabled={busy||voiceActive||!context?.aiConfigured} onClick={()=>void send(analysisRequest)}>Analyze performance</button><button disabled={busy||voiceActive||!context?.aiConfigured} onClick={()=>void send('Check the actual status and policy review of our created ads. Do not change the account.')}>Check my ads</button><button disabled={busy||voiceActive||!context?.aiConfigured} onClick={()=>void send('Prepare a factual ad draft from current verified stock. Do not publish or change settings.')}>Prepare an ad draft</button></div>
 <AgentComposer busy={busy} enabled={!!context?.aiConfigured} onSend={send} onVoiceChange={setVoiceActive}/>
 {!context?.aiConfigured&&<p className="agent-small">{context?.aiStatus?.notice||'AI connection required.'} <a href="/optimizer/settings">Open settings</a></p>}
 <details className="agent-page-tools"><summary>Daily check-in & account controls</summary>
 <div className="agent-goals"><div><small>Daily customer payment target</small><strong>4,000 RON</strong></div><div><small>Allowed ad spend today</small><strong>{context?.allowance.allowanceBani===null||!context?'Unconfirmed':`${(context.allowance.allowanceBani/100).toFixed(2)} RON`}</strong></div><div><small>Confirmed payments today</small><strong>{context?.today?`${(context.today.amountBani/100).toFixed(2)} RON`:'Awaiting check-in'}</strong></div></div>
   <div className="agent-checkin"><h3>{context?.checkinDue?'How was today?':'Daily customer payments'}</h3><p>Total customer payments for the selected day, including cash, card and transfer.</p><p>Below 500: very bad · 500–999.99: bad · 1,000–1,999.99: good · 2,000+: very good.</p><label>Day <select value={checkDate||context?.businessDate||''} onChange={e=>{setCheckDate(e.target.value);setConfirmed(false);}}>{context&&<><option value={context.businessDate}>Today ({context.businessDate})</option><option value={context.yesterday}>Yesterday ({context.yesterday})</option></>}</select></label><label> Customer payments (lei) <input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setConfirmed(false);}} placeholder="e.g. 4000"/></label><label className="agent-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm this total includes all customer payments for the selected day.</label><button className="secondary" disabled={busy||!confirmed||!context} onClick={saveCheckin}>Confirm daily payments</button><p className="agent-small">A correction is saved as a new record. Today’s check-in changes tomorrow’s allowance, never today’s.</p></div>

 <div className="agent-controls"><button className="secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={15}/>Refresh saved data</button>{context?.control.canRun&&<button className="secondary" disabled={busy} onClick={()=>void runControl()}>Collect Google report</button>}<a className="secondary" href="/ai-ads/control">Account controls</a><a className="secondary" href="/optimizer/settings">Settings & activity</a></div>
 <label className="agent-confirm"><input type="checkbox" checked={automatic} disabled={ADS_WEB_ONLY||!context?.aiConfigured} onChange={event=>{setAutomatic(event.target.checked);if(context?.accountId)try{localStorage.setItem('gsmweb:auto-analysis:'+context.accountId,String(event.target.checked));}catch{}}}/>Analyze fresh reports automatically while open</label>
 </details>
 </section>;
}
