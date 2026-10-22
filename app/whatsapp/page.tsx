'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,MessageCircle,Plus,RefreshCw} from 'lucide-react';
import {formatRomanianTimestamp} from '@/lib/timestamps';
type Entry={call_id:string;phone:string;time_precision:string;firstInteraction:boolean;ga_calls:{started_at:string}};
export default function WhatsApp(){
 const [phone,setPhone]=useState(''),[date,setDate]=useState(''),[time,setTime]=useState(''),[entries,setEntries]=useState<Entry[]>([]),[configured,setConfigured]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[filter,setFilter]=useState('');
 const phoneInput=useRef<HTMLInputElement>(null);
 async function json(url:string,init?:RequestInit){const response=await fetch(url,{cache:'no-store',...init}),data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;}
 async function load(){const data=await json('/api/whatsapp');setEntries(data.entries);setConfigured(data.configured);if(data.serverNow){const day=formatRomanianTimestamp(data.serverNow).slice(0,10);setDate(previous=>previous||day);setFilter(previous=>previous||day);}}
 useEffect(()=>{load().catch(error=>setNotice(error.message));},[]);
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setNotice('');try{const result=await json('/api/whatsapp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,date,time})});await load();setNotice(result.saved?'First WhatsApp message saved.':'This number already has a saved first message. Its original time was kept.');setPhone('');setTime('');}catch(error){setNotice(error instanceof Error?error.message:'Entry could not be saved');}finally{setBusy(false);requestAnimationFrame(()=>phoneInput.current?.focus());}}
 return <div className="setup-page consent-review"><header className="setup-header"><a href="/"><ArrowLeft size={16}/>Dashboard</a><a href="/review">Conversion review</a></header><main className="setup-main">
 <div className="section-heading"><h1><MessageCircle size={24}/>WhatsApp leads</h1><button className="secondary" disabled={busy} onClick={()=>load().catch(error=>setNotice(error.message))}><RefreshCw size={16}/>Refresh</button></div>
 {!configured&&<p role="alert">Manual WhatsApp entries need the approved database setup.</p>}
 <form className="whatsapp-entry" onSubmit={save}><label>Client phone<input ref={phoneInput} autoFocus type="tel" autoComplete="off" placeholder="07... or +country code" value={phone} disabled={busy} required onChange={event=>setPhone(event.target.value)}/></label><label>First message date<input type="date" min="2026-09-24" value={date} disabled={busy} required onChange={event=>{setDate(event.target.value);setFilter(event.target.value);}}/></label><label>First message time · Bucharest<input type="time" step="1" value={time} disabled={busy} required onChange={event=>setTime(event.target.value)}/></label><button className="primary" disabled={busy||!configured||!phone.trim()||!time||!date}><Plus size={16}/>Save lead</button></form>
 {notice&&<p className="review-notice" role="status">{notice}</p>}
 <div className="section-heading"><h2>Saved first messages</h2><label>Day<input type="date" value={filter} onChange={event=>setFilter(event.target.value)}/></label></div>
 <div className="table-scroll"><table><thead><tr><th>PHONE</th><th>FIRST MESSAGE</th><th>PRECISION</th><th>INTERACTION</th></tr></thead><tbody>{entries.filter(entry=>formatRomanianTimestamp(entry.ga_calls.started_at).slice(0,10)===filter).map(entry=><tr key={entry.call_id}><td data-label="Phone">{entry.phone}</td><td data-label="First message">{formatRomanianTimestamp(entry.ga_calls.started_at)}</td><td data-label="Precision">{entry.time_precision}</td><td data-label="Interaction">{entry.firstInteraction?'First contact':'Earlier call or message already recorded'}</td></tr>)}</tbody></table></div>
 {!entries.some(entry=>formatRomanianTimestamp(entry.ga_calls.started_at).slice(0,10)===filter)&&<p>No WhatsApp leads for this day.</p>}
 <a className="primary" href="/review">Review and match conversions</a>
 </main></div>;
}
