'use client';
import {useEffect,useState} from 'react';
import type {AdsObservation} from '@/lib/ads-monitor';
import AdsAgent from '@/components/ads-agent';
import './agent.css';
type Report={mode:string;stale?:boolean;notice?:string;observation:AdsObservation|null;blockers?:string[]};
export default function Optimizer(){
 const [report,setReport]=useState<Report|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function api(path:string,method='GET'){
  const response=await fetch(path,{method,cache:'no-store'});
  if(response.status===401){window.location.assign('/login');throw new Error('Sign in required.');}
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Reporting unavailable.');return data;
 }
 async function refresh(){try{setReport(await api('/api/optimizer'));}catch(error){setNotice(error instanceof Error?error.message:'Reporting unavailable.');}}
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  if(params.get('error'))setNotice(params.get('error')!);
  else if(params.get('connected')==='google_ads_management')setNotice('Reporting account authorized. Collect a report to verify account access.');
  window.history.replaceState({},'',window.location.pathname);void refresh();
  const timer=setInterval(()=>{if(!document.hidden)void refresh();},30000);return()=>clearInterval(timer);
 },[]);
 async function run(action:()=>Promise<void>){setBusy(true);setNotice('');try{await action();}catch(error){setNotice(error instanceof Error?error.message:'Request failed.');}finally{setBusy(false);}}
 const observation=report?.observation;
 const percent=(value:number|null)=>value===null?'Unavailable / below reporting precision':`${(value*100).toFixed(1)}%`;
 return <div className="setup-page"><header className="setup-header"><a href="/" className="secondary">Dashboard</a><strong>GSMWeb</strong><a href="/connections" className="secondary">Connections</a></header>
  <main className="setup-main"><div className="eyebrow">GOOGLE ADS · MONITOR AND ADVISE</div><h1>Your GSMWEB agent</h1><p>Target: <strong>3 RON per click</strong>. Account control stays off until you explicitly grant it and deployment checks pass.</p><AdsAgent/>
  <div className="setup-actions"><button className="primary" disabled={busy} onClick={()=>run(async()=>{const result=await api('/api/integrations/google_ads_management/start','POST');window.location.assign(result.url);})}>Connect campaign reporting</button>
   <button className="secondary" disabled={busy} onClick={()=>run(async()=>{await api('/api/optimizer/collect','POST');await refresh();setNotice('Report collected.');})}>{busy?'Working…':'Collect report'}</button>
   <button className="secondary" disabled={busy} onClick={()=>run(refresh)}>Refresh saved report</button>
   <button className="secondary" disabled={busy} onClick={()=>run(async()=>{await api('/api/integrations/google_ads_management/disconnect','POST');setNotice('Campaign reporting disconnected. Saved reports are retained.');})}>Disconnect reporting</button>
  </div>
  {notice&&<p role="status">{notice}</p>}{report?.notice&&<p>{report.notice}</p>}
  <section className="setup-provider"><h2>Readiness</h2><p>Paid-customer CPA: unavailable · Contribution profit: unavailable</p><p>CRM payments need verified campaign attribution before optimization.</p><ul>{(report?.blockers??['Spend and visibility limits are not configured.','Live execution is disabled.']).map(reason=><li key={reason}>{reason}</li>)}</ul></section>
  {!report&&!notice&&<p>Loading saved report…</p>}
  {report&&!observation&&<p>No campaign report has been collected. Configure and authorize reporting, then collect the first report.</p>}
  {observation&&<><p>Account {observation.accountId} · {observation.currency} · {observation.timeZone}</p>
   <p>{observation.windowStart} to {observation.windowEnd} · Collected {new Date(observation.fetchedAt).toLocaleString()}{report?.stale?' · Stale: collect a new report':''}</p>
   <p>Seven completed account-calendar days. Recent results may still be revised by Google. Impression shares are estimates; no search placement is guaranteed.</p>
   {observation.currency!=='RON'&&<p role="alert">Account currency is {observation.currency}. The 3 RON target cannot be compared without an agreed exchange-rate policy.</p>}
   {observation.campaigns.length===0&&<p>No Search campaign activity was returned for this window. This does not prove there are no configured campaigns.</p>}
   <div className="table-scroll"><table><caption>Search campaign performance in account currency</caption><thead><tr><th>Campaign</th><th>Strategy</th><th>Clicks</th><th>Spend</th><th>Cost / click</th><th>Search share</th><th>Top share</th><th>Absolute top share</th><th>Lost: budget</th><th>Lost: rank</th></tr></thead><tbody>
   {observation.campaigns.map(c=><tr key={c.id}><td>{c.name}<small>{c.status}</small></td><td>{c.strategy}</td><td>{c.clicks}</td><td>{(Number(c.costMicros)/1e6).toFixed(2)} {observation.currency}</td><td>{c.clicks?(Number(c.costMicros)/1e6/c.clicks).toFixed(2):'No clicks'}</td><td>{percent(c.searchShare)}</td><td>{percent(c.topShare)}</td><td>{percent(c.absoluteTopShare)}</td><td>{percent(c.budgetLostShare)}</td><td>{percent(c.rankLostShare)}</td></tr>)}
   </tbody></table></div></>}
  </main></div>;
}
