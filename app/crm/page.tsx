'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,RefreshCw,Database} from 'lucide-react';
import type {compareCrmCall} from '@/lib/crm-comparison';
type Comparison=ReturnType<typeof compareCrmCall>;
export default function CrmComparison(){
 const [items,setItems]=useState<Comparison[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[limited,setLimited]=useState(false);
 async function refresh(){setLoading(true);setError('');try{const response=await fetch('/api/crm/comparison',{cache:'no-store'});if(response.status===401){window.location.assign('/login');return;}const data=await response.json();if(!response.ok)throw new Error(data.error||'CRM comparison failed');setItems(data.items);setLimited(data.limited);}catch(e){setItems([]);setError(e instanceof Error?e.message:'CRM unavailable');}finally{setLoading(false);}}
 useEffect(()=>{refresh();},[]);
 const shown=items.filter(c=>`${c.phone} ${c.customer?.name||''}`.toLowerCase().includes(query.toLowerCase()));
 return <div className="main" style={{marginLeft:0}}><header><a href="/"><ArrowLeft size={16}/> Dashboard</a><a href="/connections">Connections</a></header><main>
  <div className="heading"><div><div className="eyebrow">GSMWEB CRM</div><h1>Client comparison</h1><p>Recorded customer payments · RON</p></div><button className="secondary" disabled={loading} onClick={refresh}><RefreshCw size={16}/>{loading?'Checking CRM':'Refresh'}</button></div>
  {error&&<p role="alert">{error}</p>}
  {limited&&<p>Showing the latest 500 calls since 24 September 2026.</p>}
  <div className="section-heading"><h2><Database size={18}/> {items.filter(c=>c.status==='found').length} calls linked to clients</h2><label className="search"><input aria-label="Search clients or phones" placeholder="Search client or phone" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  <div className="table-scroll"><table><thead><tr><th>CALL / CLIENT</th><th>CLIENT STATUS</th><th>REPAIRS</th><th>RECORDED PAYMENT HISTORY</th></tr></thead><tbody>{shown.map(c=><tr key={c.callId}>
   <td><b>{c.phone}</b><small>{c.customer?.name||'No unique client'}</small><small>{new Date(c.calledAt).toLocaleString('en-GB',{timeZone:'Europe/Bucharest'})}</small></td>
   <td>{c.status==='found'?'Client found':c.status==='ambiguous'?'Multiple clients':'Not found'}{c.customer&&<small>{c.customer.id}</small>}{c.candidateCustomers.map(x=><small key={x.id}>{x.name}</small>)}</td>
   <td>{c.repairs.length?c.repairs.map(r=><small key={r.id}>{r.repairCode} · {r.phoneModel} · {r.status}</small>):'No repairs'}</td>
   <td><b>{c.status==='found'?`${c.recordedTotal.toLocaleString('ro-RO')} RON`:'—'}</b><small>Client history, not attributed revenue</small>{c.payments.map(p=><small key={p.id}>{p.paidDate.slice(0,10)} · {p.paymentMethod} · {p.amount.toLocaleString('ro-RO')} RON · {p.kind}</small>)}</td>
  </tr>)}</tbody></table>{!loading&&!error&&!shown.length&&<div className="empty">No calls found.</div>}</div>
 </main></div>;
}

