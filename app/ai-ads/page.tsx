'use client';
import {useState} from 'react';
import type {InventoryPart} from '@/lib/ai-ads/inventory';
type Inventory={parts:InventoryPart[];sourceProject:string;consistency:string};
export default function AiAdsManager(){
 const [inventory,setInventory]=useState<Inventory|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function refresh(){
  setBusy(true);setError('');setInventory(null);
  try{
   const response=await fetch('/api/ai-ads/inventory',{cache:'no-store'});
   if(response.status===401){window.location.assign('/login');return;}
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Inventory unavailable.');setInventory(result);
  }catch(cause){setError(cause instanceof Error?cause.message:'Inventory unavailable.');}finally{setBusy(false);}
 }
 return <div className="setup-page"><header className="setup-header"><a href="/" className="secondary">Dashboard</a><strong>GSMWEB</strong><a href="/optimizer" className="secondary">Ads monitoring</a></header>
 <main className="setup-main"><h1>AI Ads Manager</h1><p>Inventory audit for phone repairs in your store.</p>
 <section className="setup-card"><h2>Publishing is blocked</h2><p>Google’s third-party consumer technical-support policy includes offline hardware repair. Stock availability does not establish advertising eligibility. Policy clarification is required before publication.</p><a href="https://support.google.com/adspolicy/answer/13527027?hl=en" target="_blank" rel="noreferrer">Read the official policy</a></section>
 <p>Available stock already excludes parts allocated to saved repairs. Part prices are not repair quotes. Unknown or mixed VAT cost bases cannot support profit calculations.</p>
 <button className="primary" disabled={busy} onClick={()=>void refresh()}>{busy?'Reading inventory…':'Refresh inventory'}</button>
 {error&&<p role="alert">{error}</p>}
 {!inventory&&!busy&&!error&&<p>Refresh to verify the saved inventory connection. No stock has been read in this session.</p>}
 {inventory&&<><p>{inventory.parts.filter(p=>p.eligible).length} stock-qualified parts out of {inventory.parts.length}. Stock qualification does not permit publishing.</p><p>Source: {inventory.sourceProject}. This is a point-in-time read; it does not reserve stock.</p>
 <div className="table-scroll"><table><caption>Stock and verified compatibility</caption><thead><tr><th>Part</th><th>Models recorded</th><th>Available</th><th>Minimum</th><th>Inventory checks</th></tr></thead><tbody>{inventory.parts.map(part=><tr key={part.id}><td>{part.name}<small>{part.sku}</small></td><td>{part.models.join(', ')||'Unknown'}</td><td>{part.available??'Unknown'}</td><td>{part.minimumStock}</td><td>{part.eligible?'Stock qualified':part.reasons.join(', ')}</td></tr>)}</tbody></table></div></>}
 </main></div>;
}
