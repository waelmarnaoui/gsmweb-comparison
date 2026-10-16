'use client';
import {useEffect,useState} from 'react';
import type {ControlCampaign} from '@/lib/ads-control/google';
export default function LaptopRecovery({campaigns,ready,createCode}:{campaigns:Pick<ControlCampaign,'resourceName'|'name'>[];ready:boolean;createCode:(id:string)=>Promise<{setupCode:string;expiresInMinutes:number}>}){
 const [campaign,setCampaign]=useState(''),[code,setCode]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!code)return;const timeout=setTimeout(()=>{setCode('');setNotice('Setup code expired. Generate another if the laptop is not paired.');},600000);return()=>clearTimeout(timeout);},[code]);
 async function pair(){setBusy(true);setNotice('');setCode('');try{const result=await createCode(campaign.split('/').pop()!);setCode(result.setupCode);}catch(e){setNotice(e instanceof Error?e.message:'Laptop setup is unavailable.');}finally{setBusy(false);}}
 return <section className="agent-review"><h2>Laptop recovery agent</h2><p>{ready?'The recovery agent passed its latest independent check.':'Pair this laptop and start its background recovery agent.'} The laptop runs recovery and stock/report checks in the background. Both health checks appear in this dashboard, and they continue when the tab closes.</p>
  <p>The laptop must stay awake, signed in and connected. Sleep, a closed lid, power loss or a network outage can prevent recovery. A server can replace the laptop later.</p>
  <label>Campaign for the recovery access check <select value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">Load live campaigns above, then select one</option>{campaigns.map(c=><option key={c.resourceName} value={c.resourceName}>{c.name}</option>)}</select></label><p>This setup check validates access without changing the selected campaign.</p>
  <button className="secondary" disabled={busy||!campaign} onClick={()=>void pair()}>{busy?'Preparing secure setup…':'Create one-time laptop setup code'}</button>
  {notice&&<p role="status">{notice}</p>}
  {code&&<div role="status"><label>One-time setup code <input readOnly value={code} autoComplete="off" spellCheck={false} onFocus={e=>e.currentTarget.select()}/></label><p>Run the laptop installer supplied with this release and paste this code into its setup prompt. It expires in ten minutes and works once. Treat it like a password; do not send it in chat. It authorizes encrypted delivery of the worker’s server credentials to this laptop.</p><button className="secondary" onClick={()=>{setCode('');setNotice('Code hidden. It will still expire after ten minutes.');}}>Hide setup code</button></div>}
 </section>;
}
