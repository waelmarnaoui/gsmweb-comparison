'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Unlock} from 'lucide-react';
export default function AdsCooldownReset({disabled=false}:{disabled?:boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[until,setUntil]=useState<string|null>(null);
 const requestId=useRef<string|null>(null),inFlight=useRef(false);
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/optimizer/cooldown',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),wait=Math.max(0,...Object.values(data.waits as Record<string,number>));setUntil(wait?new Date(Date.parse(data.checkedAt)+wait).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'}):null);}catch{/* Reset remains available if a status read fails. */}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function reset(){
  if(inFlight.current||disabled)return;
  if(!window.confirm('Clear the current app cooldowns for all Google Ads checks? Requests can run again until a new quota error activates the cooldown. Google may still reject them. Ads permissions and spending limits will not change.'))return;
  inFlight.current=true;setBusy(true);setNotice('');requestId.current??=crypto.randomUUID();
  try{
   const r=await fetch('/api/optimizer/cooldown',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'clear_current_cooldowns',confirmed:true,requestId:requestId.current})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Cooldown reset could not be confirmed.');setNotice(data.notice);setUntil(null);requestId.current=null;await refresh();
  }catch(error){setNotice(error instanceof Error?error.message:'Reset not confirmed. Refresh status before retrying.');}finally{inFlight.current=false;setBusy(false);}
 }
 return <div className="agent-review"><div className="agent-actions"><button type="button" className="secondary" disabled={disabled||busy} onClick={()=>void reset()}><Unlock size={16}/>{busy?'Clearing cooldowns...':'Clear current cooldown'}</button>{until&&<span>Current app hold: {until} Bucharest</span>}</div>{notice&&<p role="status">{notice}</p>}</div>;
}
