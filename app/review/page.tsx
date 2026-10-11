'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,RefreshCw,Save,Send,ShieldCheck,Download,Link2,Database,Wand2} from 'lucide-react';
import {CONSENT_SCRIPT,CONSENT_SCRIPT_VERSION,CONSENT_STATUSES,type ConsentStatus} from '@/lib/client-consent';
import type {conversionDashboard} from '@/lib/conversion-dashboard';
import type {ManifestEntry} from '@/lib/ads-review';
import type {UploadRecord} from '@/lib/ads-ledger';
import {parseTimestamp,formatRomanianTimestamp} from '@/lib/timestamps';
import type {readCrmDay} from '@/lib/crm-reader';

type Item=Awaited<ReturnType<typeof conversionDashboard>>['items'][number];
type Choices={measurement:ConsentStatus;personalization:ConsentStatus;obtainedAt:string};
const localTime=(value:string)=>formatRomanianTimestamp(value).replace(' ','T');
type Sources={clicks:{id:string;clicked_at:string;gclid:string;campaign:string;page_url:string}[];calls:{id:string;phone:string;started_at:string;direction:string;duration_seconds:number;firstInteraction:boolean}[];crm:Awaited<ReturnType<typeof readCrmDay>>;crmError:string};
export default function Review(){
 const [items,setItems]=useState<Item[]>([]),[choices,setChoices]=useState<Record<string,Choices>>({});
 const [manifest,setManifest]=useState<ManifestEntry[]>([]),[history,setHistory]=useState<UploadRecord[]>([]),[configured,setConfigured]=useState(false);
 const [adsAuthorized,setAdsAuthorized]=useState(false);
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [from,setFrom]=useState('2026-09-24'),[to,setTo]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const [daily,setDaily]=useState(true),[sources,setSources]=useState<Sources>({clicks:[],calls:[],crm:[],crmError:''}),[tab,setTab]=useState<'clicks'|'calls'|'crm'>('clicks');
 const query='?'+new URLSearchParams({from:daily?to:from,to,...(daily?{activityDay:to}:{})}).toString();
 const dirty=items.some(item=>{const choice=choices[item.callId];return !item.consent||!choice||choice.measurement!==item.consent.ad_user_data||choice.personalization!==item.consent.ad_personalization||choice.obtainedAt!==localTime(item.consent.obtained_at);});
 const batches=[...new Map(history.map(row=>[row.batch_id,row])).values()];
 async function json(url:string,init?:RequestInit){const response=await fetch(url,{cache:'no-store',...init}),data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;}
 async function refresh(){
  setBusy(true);setNotice('');setConfirmed(false);setManifest([]);setConfigured(false);setAdsAuthorized(false);setItems([]);
  try{
   const data=await json('/api/conversions'+query,{method:'POST'}),eligible:Item[]=data.items.filter((item:Item)=>item.callId&&item.paymentId);
   setItems(eligible);setChoices(Object.fromEntries(eligible.map(item=>[item.callId,{measurement:item.consent?.ad_user_data||'granted',personalization:item.consent?.ad_personalization||'not_asked',obtainedAt:item.consent?localTime(item.consent.obtained_at):localTime(new Date().toISOString())}])));
   setSources(await json('/api/review/sources?'+new URLSearchParams({day:to})));
   const review=await json('/api/ads/review'+query);setConfigured(review.configured);setHistory(review.history);
   const connection=await json('/api/ads/connection');setAdsAuthorized(connection.authorized);
   const visible=new Set(eligible.map(item=>item.paymentId));setManifest(review.manifest.filter((entry:ManifestEntry)=>visible.has(entry.paymentId)));
  }catch(e){setNotice(e instanceof Error?e.message:'Review unavailable');}finally{setBusy(false);}
 }
 useEffect(()=>{refresh();},[]);
 async function run(action:'import'|'clicks'|'crm'|'all'){
  setBusy(true);setNotice('');setManifest([]);setConfirmed(false);
  try{await json('/api/review/actions'+query,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});await refresh();setNotice(action==='import'?'Website clicks imported.':action==='clicks'?'Website clicks compared with call history.':action==='crm'?'Calls compared with CRM repair records.':'Import and matching completed.');}
  catch(error){setNotice(error instanceof Error?error.message:'Matching failed');}finally{setBusy(false);}
 }
 async function save(){
  setBusy(true);setNotice('');setManifest([]);
  try{
   for(const callId of Object.keys(choices)){const choice=choices[callId];await json('/api/consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callId,adUserData:choice.measurement,adPersonalization:choice.personalization,confirmed,scriptVersion:CONSENT_SCRIPT_VERSION,obtainedAt:parseTimestamp(choice.obtainedAt.replace('T',' '))})});}
   await refresh();setNotice('Consent choices recorded. Review the saved choices before sending.');
  }catch(e){setNotice((e instanceof Error?e.message:'Save failed')+' No Google upload was attempted. Refresh to check any choices already recorded.');}finally{setBusy(false);}
 }
 async function send(){
  setBusy(true);setNotice('');const reviewed=[...manifest];setManifest([]);setConfirmed(false);
  try{const data=await json('/api/ads/send'+query,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,items:reviewed})});await refresh();setNotice(data.message);}
  catch(e){setNotice((e instanceof Error?e.message:'Upload failed')+' Refresh the review before trying again. Reserved payments will not be resent.');}finally{setBusy(false);}
 }
 async function validate(){setBusy(true);setNotice('');try{const data=await json('/api/ads/validate'+query,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,items:manifest})});setNotice(data.message);}catch(e){setNotice(e instanceof Error?e.message:'Google validation failed');}finally{setBusy(false);}}
 async function checkStatus(){setBusy(true);setNotice('');try{const data=await json('/api/ads/status',{method:'POST'});await refresh();setNotice(data.message);}catch(e){setNotice(e instanceof Error?e.message:'Status check failed');}finally{setBusy(false);}}
 function choose(callId:string,field:keyof Choices,value:string){setChoices(previous=>({...previous,[callId]:{...previous[callId],[field]:value}}));setConfirmed(false);}
 function date(field:'from'|'to',value:string){if(field==='from')setFrom(value);else setTo(value);setManifest([]);setConfirmed(false);setItems([]);setChoices({});setSources({clicks:[],calls:[],crm:[],crmError:''});}
 return <div className="setup-page consent-review"><header className="setup-header"><a href="/"><ArrowLeft size={16}/>Dashboard</a><a href="/ads">Google Ads connection</a></header><main className="setup-main">
 <div className="section-heading"><h1>Conversion upload review</h1><button className="secondary" disabled={busy} onClick={refresh}><RefreshCw size={16}/>Refresh</button></div>
 <div className="review-filters">{!daily&&<label>From<input type="date" value={from} disabled={busy} onChange={e=>date('from',e.target.value)}/></label>}<label>{daily?'Review day':'To'}<input type="date" value={to} disabled={busy} onChange={e=>date('to',e.target.value)}/></label><label><input type="checkbox" checked={daily} disabled={busy} onChange={e=>{setDaily(e.target.checked);setManifest([]);setConfirmed(false);}}/>Daily repair entries</label><span>Google Ads 205-043-4247 · Goal 7835048106</span></div>
 <div className="review-actions"><button className="secondary" disabled={busy} onClick={()=>run('import')}><Download size={16}/>Import website clicks</button><button className="secondary" disabled={busy} onClick={()=>run('clicks')}><Link2 size={16}/>Match clicks to calls</button><button className="secondary" disabled={busy} onClick={()=>run('crm')}><Database size={16}/>Match calls to CRM</button><button className="primary" disabled={busy} onClick={()=>run('all')}><Wand2 size={16}/>Match all</button></div>
 <section className="review-sources"><div className="review-actions" role="tablist" aria-label="Daily source records">{(['clicks','calls','crm'] as const).map(key=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?'primary':'secondary'} onClick={()=>setTab(key)}>{key==='clicks'?'Website clicks':key==='calls'?'Call history':'CRM repair entries'} ({sources[key].length})</button>)}</div>{sources.crmError&&<p role="alert">{sources.crmError}</p>}
 <div className="table-scroll"><table><thead><tr><th>{tab==='clicks'?'CLICK / CAMPAIGN':tab==='calls'?'PHONE':'CLIENT / REPAIR'}</th><th>BUCHAREST TIME</th><th>{tab==='clicks'?'GCLID':tab==='calls'?'INTERACTION':'STATUS / PROFIT'}</th></tr></thead><tbody>
 {tab==='clicks'&&sources.clicks.map(row=><tr key={row.id}><td data-label="Campaign">{row.campaign||'Website click'}<small>{row.page_url}</small></td><td data-label="Time">{formatRomanianTimestamp(row.clicked_at)}</td><td data-label="GCLID">{row.gclid||'No GCLID'}</td></tr>)}
 {tab==='calls'&&sources.calls.map(row=><tr key={row.id}><td data-label="Phone">{row.phone}</td><td data-label="Time">{formatRomanianTimestamp(row.started_at)}</td><td data-label="Interaction">{row.direction}<small>{row.firstInteraction?'First customer interaction':'Follow-up / not eligible'} · {row.duration_seconds}s</small></td></tr>)}
 {tab==='crm'&&sources.crm.map(row=><tr key={row.id}><td data-label="Client / repair"><b>{row.customer}</b><small>{row.phone} · {row.repair}</small></td><td data-label="Time">{formatRomanianTimestamp(row.time)}</td><td data-label="Status / profit">{row.status}<small>{row.profit===null?'Profit missing':row.profit.toLocaleString('ro-RO')+' RON'}</small></td></tr>)}
 </tbody></table></div>{!sources[tab].length&&<p>No {tab==='crm'?'CRM repair entries':tab==='calls'?'calls':'website clicks'} for this day.</p>}</section>
 {notice&&<p role="status" className="review-notice">{notice}</p>}{!configured&&<p role="alert">Google upload tracking needs database setup. No upload can start until it is installed.</p>}
 {!busy&&!adsAuthorized&&<p role="alert">Google Ads account is not connected in this app. <a href="/ads">Connect Google Ads</a></p>}
 <details><summary>Verbal consent statement</summary><p>{CONSENT_SCRIPT}</p><a href="https://business.safety.google/privacy/" target="_blank" rel="noreferrer">Google customer-data information</a></details>
 <div className="table-scroll"><table><thead><tr><th>CLIENT</th><th>PROFIT</th><th>MEASUREMENT CONSENT</th><th>PERSONALIZATION</th><th>CONSENT OBTAINED (BUCHAREST)</th><th>UPLOAD STATUS</th></tr></thead><tbody>
 {items.map(item=>{const record=history.find(row=>row.payment_id===item.paymentId);return <tr key={item.id}>
 <td data-label="Client"><b>{item.customer}</b><small>{item.phone} · {item.repair}</small><small>{item.gclid?'Website click + CRM':'Phone + CRM'}</small></td><td data-label="Profit">{item.amount.toLocaleString('ro-RO')} RON<small>{item.conversionTime?formatRomanianTimestamp(item.conversionTime):'Match time pending'}</small><small>{item.recordBasis?'Repair profit':'Payment profit'} · Recorded payments: {item.paymentAmount.toLocaleString('ro-RO')} RON</small></td>
 <td data-label="Measurement consent"><select disabled={busy} aria-label={'Measurement consent for '+item.customer} value={choices[item.callId]?.measurement||'granted'} onChange={e=>choose(item.callId,'measurement',e.target.value)}>{CONSENT_STATUSES.map(status=><option key={status} value={status}>{status.replace('_',' ')}</option>)}</select></td>
 <td data-label="Personalization"><select disabled={busy} aria-label={'Personalization consent for '+item.customer} value={choices[item.callId]?.personalization||'not_asked'} onChange={e=>choose(item.callId,'personalization',e.target.value)}>{CONSENT_STATUSES.map(status=><option key={status} value={status}>{status.replace('_',' ')}</option>)}</select></td>
 <td data-label="Consent obtained (Bucharest)"><input disabled={busy} type="datetime-local" step="1" aria-label={'Consent obtained for '+item.customer} value={choices[item.callId]?.obtainedAt||''} onChange={e=>choose(item.callId,'obtainedAt',e.target.value)}/></td>
 <td data-label="Upload status">{record?record.state:item.consent?item.reason||'Ready':'Unsaved consent proposal'}</td></tr>;})}
 </tbody></table></div>{!items.length&&!busy&&<p>No financially verified conversions in this date range.</p>}
 <p className="review-attestation"><label><input disabled={busy} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have explained the purposes to each client and verified their actual choices. Every client marked granted explicitly agreed.</label></p>
 <div className="review-actions"><button className="secondary" onClick={save} disabled={busy||!confirmed||!items.length||Object.values(choices).some(choice=>!choice.obtainedAt)}><Save size={16}/>Record consent choices</button><button className="secondary" disabled={busy||dirty||!confirmed||!adsAuthorized||!manifest.length} onClick={validate}><ShieldCheck size={16}/>Validate only</button><button className="primary" disabled={busy||dirty||!confirmed||!configured||!adsAuthorized||!manifest.length} onClick={send}><Send size={16}/>Send {manifest.length||''} to Google</button></div>
 <section className="upload-history"><div className="section-heading"><h2>Upload history</h2><button className="secondary" disabled={busy} onClick={checkStatus}><RefreshCw size={16}/>Check Google status</button></div>
 {batches.slice(0,30).map(batch=><div className="upload-history-row" key={batch.batch_id}><b>{batch.state}</b><span>{history.filter(row=>row.batch_id===batch.batch_id).length} conversions</span><small>{formatRomanianTimestamp(batch.created_at)}</small>{batch.warning&&<small>Google warnings received</small>}{batch.error_codes.length>0&&<small>{batch.error_codes.join(', ')}</small>}</div>)}{!batches.length&&<p>No uploads recorded.</p>}</section>
 </main></div>;
}
