import {createHash} from 'node:crypto';
import {validationPayload} from './google-ads-events';
export type AdsRow=Parameters<typeof validationPayload>[0][number];
export type ManifestEntry={paymentId:string;fingerprint:string};
export function reviewedManifest(rows:AdsRow[]){
 if(!rows.some(row=>row.ready))return [];
 const payload=validationPayload(rows);
 return payload.events.map(event=>{
  const row=rows.find(row=>row.paymentId===event.transactionId)!;
  return {paymentId:event.transactionId,fingerprint:createHash('sha256').update(JSON.stringify({destination:payload.destinations,event,consentId:row.consent?.id})).digest('hex')};
 });
}
export function parseManifest(body:unknown):ManifestEntry[]{
 if(!body||typeof body!=='object'||!('confirmed' in body)||body.confirmed!==true||!('items' in body)||!Array.isArray(body.items)||!body.items.length||body.items.length>2000)throw new Error('Confirm the reviewed upload first.');
 const seen=new Set<string>();
 return body.items.map((entry:unknown)=>{
  if(!entry||typeof entry!=='object'||!('paymentId' in entry)||typeof entry.paymentId!=='string'||!entry.paymentId||entry.paymentId.length>250||!('fingerprint' in entry)||typeof entry.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(entry.fingerprint)||seen.has(entry.paymentId))throw new Error('Invalid reviewed conversions.');
  seen.add(entry.paymentId);return {paymentId:entry.paymentId,fingerprint:entry.fingerprint};
 });
}
export function selectReviewed(rows:AdsRow[],manifest:ManifestEntry[]){
 const current=reviewedManifest(rows),map=new Map(current.map(entry=>[entry.paymentId,entry.fingerprint]));
 return manifest.map(entry=>{
  if(map.get(entry.paymentId)!==entry.fingerprint)throw new Error('Conversion data or consent changed. Refresh and review again.');
  return rows.find(row=>row.ready&&row.paymentId===entry.paymentId)!;
 });
}
