import {z} from 'zod';
export const rangeSchema=z.object({from:z.iso.date(),to:z.iso.date()}).refine(r=>r.from<=r.to&&Date.parse(r.to)-Date.parse(r.from)<366*86400000,'Choose an ordered date range of at most 366 days.');
export type Range=z.infer<typeof rangeSchema>;
export type Metrics={clicks:number;impressions:number;cost:number;conversions:number;value:number};
export type Term=Metrics&{term:string;groupId:string;group:string;campaign:string;status:string};
export type Keyword=Metrics&{resource:string;text:string;matchType:string;status:string;groupId:string;group:string;campaign:string;quality:number|null;expectedCtr:string;relevance:string;landingPage:string};
export type Spend=Metrics&{id:string;name:string;status:string};
export type Report={account:string;currency:string;timeZone:string;range:Range;fetchedAt:string;terms:Term[];keywords:Keyword[];groups:{id:string;name:string;campaign:string}[];campaigns:Spend[];ads:Spend[]};
export const normal=(s:string)=>s.normalize('NFKC').trim().toLocaleLowerCase('ro-RO').replace(/\s+/g,' ');
export function ratios(m:Metrics){return {cpc:m.clicks?m.cost/m.clicks:null,cpa:m.conversions?m.cost/m.conversions:null,ctr:m.impressions?m.clicks/m.impressions:null,roas:m.cost?m.value/m.cost:null};}
export function termRank(a:Term,b:Term){return b.conversions-a.conversions||(ratios(b).roas??0)-(ratios(a).roas??0)||(ratios(a).cpa??Infinity)-(ratios(b).cpa??Infinity)||b.clicks-a.clicks||a.term.localeCompare(b.term);}
export function suggestions(report:Report){
 const seen=new Set<string>();return [...report.terms].sort(termRank).filter(t=>{
  const key=t.groupId+':'+normal(t.term);if(seen.has(key)||t.status==='EXCLUDED'||t.conversions<=0||!/(?:inlocuire|înlocuire|schimbare|reparat|reparaț|service)/i.test(t.term)||report.keywords.some(k=>k.groupId===t.groupId&&normal(k.text)===normal(t.term)&&k.matchType==='EXACT'))return false;
  seen.add(key);return true;
 }).slice(0,100);
}
export function advice(k:Keyword){
 const notes:string[]=[];
 if(k.conversions>0)notes.push('Converting: compare CPA and conversion value before reducing spend.');
 else if(k.clicks>=20&&k.cost>0)notes.push('Spend without reported conversions: check tracking, conversion delay and search intent before pausing.');
 else notes.push('Limited conversion evidence: gather more data before a budget decision.');
 if(k.expectedCtr==='BELOW_AVERAGE')notes.push('Improve headline relevance and align the ad with the keyword.');
 if(k.relevance==='BELOW_AVERAGE')notes.push('Use a tighter model/service ad group and matching ad copy.');
 if(k.landingPage==='BELOW_AVERAGE')notes.push('Improve the matching repair page, mobile speed and clarity of the offer.');
 if(k.quality===null)notes.push('Google has not supplied a current Quality Score.');
 return notes;
}
export const changeSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('create'),groupId:z.string().regex(/^\d{1,20}$/),matchType:z.enum(['EXACT','PHRASE','BROAD']),status:z.enum(['PAUSED','ENABLED']),terms:z.array(z.string().trim().min(1).max(80)).min(1).max(100)}),
 z.object({kind:z.enum(['pause','remove']),resources:z.array(z.string().regex(/^customers\/\d{10}\/adGroupCriteria\/\d{1,20}~\d{1,20}$/)).min(1).max(100)})
]);
export type Change=z.infer<typeof changeSchema>;
export function canonicalChange(input:unknown):Change{const v=changeSchema.parse(input);return v.kind==='create'?{...v,terms:[...new Set(v.terms.map(normal))].sort()}:{...v,resources:[...new Set(v.resources)].sort()};}
export function targets(change:Change){return change.kind==='create'?change.terms.map(t=>`${change.groupId}:${change.matchType}:${normal(t)}`):change.resources;}
export function previousRange(range:Range){const days=(Date.parse(range.to)-Date.parse(range.from))/86400000+1;return {from:new Date(Date.parse(range.from)-days*86400000).toISOString().slice(0,10),to:new Date(Date.parse(range.from)-86400000).toISOString().slice(0,10)};}
export function organicTrendRows(current:any[],prior:any[]){const before=new Map(prior.map(r=>[r.keys[0],r]));return current.map(r=>{const p=before.get(r.keys[0]);return {query:r.keys[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position,previousClicks:p?.clicks??null,previousImpressions:p?.impressions??null,clickChange:p?r.clicks-p.clicks:null,impressionChange:p?r.impressions-p.impressions:null,positionChange:p?p.position-r.position:null};}).sort((a,b)=>(b.clickChange??0)-(a.clickChange??0)||(b.impressionChange??0)-(a.impressionChange??0));}
const monthNames=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
export function monthlyTrend(monthly:any[]){const sorted=[...monthly].sort((a,b)=>Number(a.year)-Number(b.year)||monthNames.indexOf(a.month)-monthNames.indexOf(b.month)),a=sorted.at(-1),b=sorted.at(-2);const count=(v:any)=>v?.monthlySearches!==undefined&&Number.isFinite(Number(v.monthlySearches))?Number(v.monthlySearches):null,last=count(a),previous=count(b);return {sorted,last,change:last!==null&&previous!==null?last-previous:null};}
