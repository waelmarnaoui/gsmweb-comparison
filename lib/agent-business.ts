export function businessRange(from:string,to:string){
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const days=(Date.parse(to)-Date.parse(from))/86400000;
 if(!valid(from)||!valid(to)||days<0||days>92)throw new Error('Choose a valid date range of at most 93 days.');
 return {from,to};
}
export function paymentTotals(rows:{id:string;paidDate:string;amount:unknown;paymentMethod:string;active:boolean}[],from:string,to:string){
 businessRange(from,to);const seen=new Set<string>(),daily=new Map<string,{date:string;receivedBani:number;refundBani:number;netBani:number;payments:number}>();
 for(const r of rows){if(!r.active)continue;if(seen.has(r.id))throw new Error('Duplicate payment identity; totals unavailable.');seen.add(r.id);
  const date=String(r.paidDate).slice(0,10);if(date<from||date>to)throw new Error('Payment date outside requested range.');businessRange(date,date);
  const text=String(r.amount);if(!/^-?\d{1,8}(?:\.\d{1,2})?$/.test(text))throw new Error('Payment amount cannot be verified.');
  const [whole,fraction='']=text.replace('-','').split('.'),amount=(Number(whole)*100+Number(fraction.padEnd(2,'0')))*(text.startsWith('-')?-1:1);
  const d=daily.get(date)??{date,receivedBani:0,refundBani:0,netBani:0,payments:0};d.receivedBani+=Math.max(0,amount);d.refundBani+=Math.max(0,-amount);d.netBani+=amount;d.payments++;daily.set(date,d);
 }
 return {currency:'RON',source:'CRM PaymentTransaction active records; paidDate is a business calendar date',from,to,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),totalNetBani:[...daily.values()].reduce((n,d)=>n+d.netBani,0),notice:'Customer payments are not Ads-attributed revenue or profit. Missing days mean no active payment rows were returned, not proof the shop had no customers.'};
}
export function cleanPage(value:unknown){try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)?u.origin+u.pathname:'unknown';}catch{return 'unknown';}}
export function websiteTotals(rows:{id:string;clicked_at:string;gclid:string|null;page_url:string|null;session_id:string|null}[],from:string,to:string){
 const pages=new Map<string,number>(),seen=new Set<string>(),sessions=new Set<string>();let adLinked=0;
 for(const r of rows){if(seen.has(r.id))throw new Error('Duplicate website event identity.');seen.add(r.id);if(r.gclid)adLinked++;if(r.session_id)sessions.add(r.session_id);const page=cleanPage(r.page_url);pages.set(page,(pages.get(page)??0)+1);}
 return {from,to,trackedEvents:seen.size,eventsWithAdClickIdentifier:adLinked,recordedSessions:sessions.size,pages:[...pages].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([page,events])=>({page,events})),notice:'Imported website click events, not all page views or all Google Ads clicks. Multiple events can belong to one visitor. No customer phones, cookies, URLs with query strings or click identifiers are exposed.'};
}
