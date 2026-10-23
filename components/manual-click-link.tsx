'use client';
import {useState} from 'react';
import {Link2,Search} from 'lucide-react';
import {formatRomanianTimestamp} from '@/lib/timestamps';
import './manual-click-link.css';
type Options={interactions:{id:string;started_at:string;direction:string}[];clicks:{id:string;clicked_at:string;gclid:string;campaign:string;page_url:string}[]};
export function ManualClickLink({callId,from,to,disabled,onLinked}:{callId:string;from:string;to:string;disabled:boolean;onLinked:()=>Promise<unknown>}){
 const [dates,setDates]=useState({from,to}),[options,setOptions]=useState<Options|null>(null),[interaction,setInteraction]=useState(''),[click,setClick]=useState('');
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function request(url:string,init?:RequestInit){const response=await fetch(url,{cache:'no-store',...init}),data=await response.json();if(!response.ok)throw new Error(data.error||'Website link unavailable.');return data;}
 async function find(){setBusy(true);setMessage('');setOptions(null);setClick('');setConfirmed(false);try{const data:Options=await request('/api/review/link?'+new URLSearchParams({callId,...dates}));setOptions(data);setInteraction(data.interactions.some(row=>row.id===callId)?callId:data.interactions[0]?.id||'');}catch(error){setMessage(error instanceof Error?error.message:'Could not load clicks.');}finally{setBusy(false);}}
 async function save(){setBusy(true);setMessage('');try{await request('/api/review/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId,interactionId:interaction,clickId:click,reason,confirmed})});setOptions(null);setMessage('Website click linked. Nothing sent to Google.');await onLinked();}catch(error){setMessage(error instanceof Error?error.message:'Link not saved.');}finally{setBusy(false);}}
 const selected=options?.clicks.find(row=>row.id===click),at=options?.interactions.find(row=>row.id===interaction)?.started_at;
 return <details className="manual-click-link"><summary>Link website click</summary><fieldset disabled={busy||disabled}>
 <label>Clicks from<input type="date" value={dates.from} onChange={e=>{setDates({...dates,from:e.target.value});setOptions(null);}}/></label>
 <label>Clicks to<input type="date" value={dates.to} onChange={e=>{setDates({...dates,to:e.target.value});setOptions(null);}}/></label>
 <button type="button" className="secondary" onClick={find}><Search size={16}/>Find clicks</button>
 {options&&<><label>Customer interaction<select aria-label="Customer interaction" value={interaction} onChange={e=>{setInteraction(e.target.value);setClick('');setConfirmed(false);}}>{options.interactions.map(row=><option key={row.id} value={row.id}>{formatRomanianTimestamp(row.started_at)} · {row.direction}{row.id===callId?' · First interaction':' · Follow-up'}</option>)}</select></label>
 <label>Website click<select aria-label="Website click" value={click} onChange={e=>{setClick(e.target.value);setConfirmed(false);}}><option value="">Select a click</option>{options.clicks.filter(row=>at&&Date.parse(row.clicked_at)<=Date.parse(at)).map(row=><option key={row.id} value={row.id}>{formatRomanianTimestamp(row.clicked_at)} · {row.campaign||'Website'} · {row.gclid||'No GCLID'}</option>)}</select></label>
 {selected&&<div className="manual-click-evidence"><small>{selected.page_url}</small><small>GCLID: {selected.gclid||'Not present'}</small><small>Conversion time: {formatRomanianTimestamp(selected.clicked_at)}</small></div>}
 <label>Evidence<textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} placeholder="Why this website click belongs to this customer"/></label>
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified this click belongs to this customer.</label>
 <button type="button" className="secondary" disabled={!click||!interaction||reason.trim().length<10||!confirmed} onClick={save}><Link2 size={16}/>Save link</button></>}
 </fieldset>{message&&<p role="status">{message}</p>}</details>;
}
