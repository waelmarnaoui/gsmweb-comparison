import {digest,type InventoryPart} from './inventory';
import {generateRepairDraft,type RepairDraft} from './policy';
export type Schedule={day:string;start:number;end:number};
export type SearchCampaign={id:string;name:string;status:string;startDate:string|null;endDate:string|null;schedule:Schedule[]};
export type SearchTerm={campaignId:string;adGroupId:string;term:string;impressions:number;clicks:number;costMicros:string};
export type SearchReport={accountId:string;currency:string;timeZone:string;fetchedAt:string;windowStart:string;windowEnd:string;campaigns:SearchCampaign[];terms:SearchTerm[];privacyFiltered:number;complete:true;termsCollected:boolean};
export type Opportunity={id:string;campaignId:string;campaignName:string;adGroupId:string;productId:string;model:string;partType:string;observedTerms:string[];clicks:number;impressions:number;costMicros:string;stock:number;inventoryFingerprint:string;draft:RepairDraft;state:'policy_blocked';explanation:string};
export function normalizeSearch(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/([a-z])([0-9])/g,'$1 $2').replace(/([0-9])([a-z])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
export function safeSearchTerm(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=200&&!/[\u0000-\u001f@{}]|https?:|www\.|(?:\+?\d[\s.-]?){8,}/i.test(value);}
export function campaignOpen(c:SearchCampaign,timeZone:string,now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'long',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now),get=(k:string)=>parts.find(p=>p.type===k)!.value;
 const date=`${get('year')}-${get('month')}-${get('day')}`,minute=Number(get('hour'))*60+Number(get('minute'));
 const local=`${date} ${get('hour')}:${get('minute')}:${get('second')}`;
 if(c.status!=='ENABLED'||c.startDate&&local<c.startDate||c.endDate&&local>c.endDate)return false;
 // Google campaigns with no ad-schedule criteria are configured for all hours.
 return !c.schedule.length||c.schedule.some(s=>s.day===get('weekday').toUpperCase()&&minute>=s.start&&minute<s.end);
}
function intent(term:string){
 const found:string[]=[];
 if(/\b(display|disolay|ecran|lcd|oled)\b/.test(term))found.push('display');
 if(/\b(baterie|acumulator|battery)\b/.test(term))found.push('battery');
 if(/\b(port|mufa|conector) (?:de )?incarcare\b/.test(term))found.push('charging-port');
 return found.length===1?found[0]:null;
}
export function searchStockMatch(term:string,parts:InventoryPart[]){
 if(!safeSearchTerm(term))return null;const normalized=normalizeSearch(term),kind=intent(normalized);
 if(!kind||/\b(gratis|manual|tutorial|schema|diy|ghid|si|sau|vs)\b/.test(normalized))return null;
 const candidates=parts.filter(p=>p.eligible&&p.partType===kind&&p.category==='PART').flatMap(part=>part.models.flatMap(model=>{
  const m=normalizeSearch(model),brand=normalizeSearch(part.brand??'');
  const aliases=[m,...(brand&&m.startsWith(brand+' ')?[m.slice(brand.length+1)]:[])];
  if(m.length<3||!aliases.some(a=>a.length>=3&&(` ${normalized} `).includes(` ${a} `)))return [];
  // Never match an iPhone 15 Pro search to the Pro Max or vice versa, even if
  // only the shorter variant is stocked. Unknown model aliases are not invented.
  const qualifiers=normalized.split(' ').filter(t=>['pro','max','plus','mini','ultra','lite','fe','se','fold','flip','edge'].includes(t));
  if(qualifiers.some(q=>!m.split(' ').includes(q)))return [];
  if([...normalized.matchAll(/\b([45]) g\b/g)].some(q=>!m.includes(q[0])))return [];
  return [{part,model,length:m.length}];
 }));
 candidates.sort((a,b)=>b.length-a.length||(b.part.available??0)-(a.part.available??0)||a.part.id.localeCompare(b.part.id));
 if(candidates[0]&&candidates.some(c=>!(` ${normalizeSearch(candidates[0].model)} `).includes(` ${normalizeSearch(c.model)} `)))return null;
 return candidates[0]??null;
}
export function prepareSearchOpportunities(report:SearchReport,parts:InventoryPart[],now=Date.now()){
 const age=now-Date.parse(report.fetchedAt);if(!report.complete||!Number.isFinite(age)||age< -60000||age>900000)throw new Error('Search report is incomplete or stale.');
 const current=parts.filter(p=>{const age=now-Date.parse(p.observedAt);return Number.isFinite(age)&&age>=-60000&&age<300000;});
 const campaigns=new Map(report.campaigns.map(c=>[c.id,c])),found=new Map<string,Opportunity>();
 for(const term of report.terms){
  const campaign=campaigns.get(term.campaignId);if(!campaign||!campaignOpen(campaign,report.timeZone,now)||term.impressions<1)continue;
  const match=searchStockMatch(term.term,current);if(!match)continue;
  const id=digest({account:report.accountId,campaign:campaign.id,adGroup:term.adGroupId,product:match.part.id,model:match.model,type:match.part.partType}),existing=found.get(id);
  if(existing){existing.observedTerms=[...new Set([...existing.observedTerms,term.term])].slice(0,10);existing.clicks+=term.clicks;existing.impressions+=term.impressions;existing.costMicros=String(BigInt(existing.costMicros)+BigInt(term.costMicros));continue;}
  const draft=generateRepairDraft({...match.part,models:[match.model]},'https://gsmweb.site/',now);
  found.set(id,{id,campaignId:campaign.id,campaignName:campaign.name,adGroupId:term.adGroupId,productId:match.part.id,model:match.model,partType:match.part.partType!,observedTerms:[term.term],clicks:term.clicks,impressions:term.impressions,costMicros:term.costMicros,stock:match.part.available!,inventoryFingerprint:match.part.fingerprint,draft,state:'policy_blocked',explanation:'Google reported this model-specific search and verified compatible stock is available. This is observed intent, not proof of profitability. New consumer-repair publication remains policy-blocked.'});
 }
 return [...found.values()].sort((a,b)=>b.clicks-a.clicks||b.impressions-a.impressions||a.id.localeCompare(b.id)).slice(0,50);
}
