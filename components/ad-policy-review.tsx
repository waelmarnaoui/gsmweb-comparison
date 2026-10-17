'use client';
import {useEffect,useRef,useState} from 'react';
import type {AdPolicyReport} from '@/lib/ads-policy-reader';
export default function AdPolicyReview(){
 const [report,setReport]=useState<AdPolicyReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(true);
 const inFlight=useRef(false);
 async function load(method='GET'){
  if(inFlight.current)return;inFlight.current=true;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/ai-ads/policy',{method,cache:'no-store'});
   if(response.status===401){window.location.assign('/login');return;}
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Google policy results are unavailable.');setReport(result.report);setStale(result.stale);
  }catch(cause){setError(cause instanceof Error?cause.message:'Google policy results are unavailable.');setStale(true);}finally{setBusy(false);inFlight.current=false;}
 }
 useEffect(()=>{void load('GET');},[]);
 return <section className="setup-provider"><h2>Google’s actual ad-review results</h2><p>Read approval status and policy topics for existing responsive search ads. This does not submit new variants or change ads.</p><button className="secondary" disabled={busy} onClick={()=>void load('POST')}>{busy?'Reading policy results…':'Read Google ad-review results'}</button>
 {error&&<p role="alert">{error}</p>}
 {!report&&!busy&&!error&&<p>No Google policy result has been collected yet. Internal drafts are not submitted ads.</p>}
 {report&&<><p>{report.ads.length} existing ads · Collected {new Date(report.fetchedAt).toLocaleString()}{stale?' · Unconfirmed or stale; read a fresh result':''}.</p><p>Approval applies to each specific existing ad. It is not clearance for new drafts, proof of policy exemption, or evidence that a variant is profitable.</p>
 {report.ads.slice(0,100).map(ad=><details key={ad.resourceName}><summary>Ad {ad.adId}: {ad.approvalStatus} · {ad.reviewStatus} · {ad.status}</summary><p>Campaign {ad.campaignId} · Ad group {ad.adGroupId}</p><ul>{ad.headlines.map((line,index)=><li key={`headline-${index}`}>{line}</li>)}{ad.descriptions.map((line,index)=><li key={`description-${index}`}>{line}</li>)}</ul><h3>Google policy topics</h3>{ad.topics.length?<ul>{ad.topics.map((topic,index)=><li key={index}>{topic.topic}: {topic.type}</li>)}</ul>:<p>No policy topics were returned. Missing or pending review status is not treated as approval.</p>}</details>)}
 {report.ads.length===0&&<p>Google returned no non-removed responsive search ads. This does not establish that the account has no other ad formats.</p>}{report.ads.length>100&&<p>Showing the first 100 ads; the full read is retained in the audit record.</p>}</>}
 </section>;
}
