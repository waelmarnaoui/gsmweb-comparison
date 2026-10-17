import {digest,inventorySafeguard,type InventoryPart} from './inventory';
import {generateRepairDraft,type RepairDraft} from './policy';
import {COPY_RULES_VERSION,validHeadline,safeKeyword} from './copy-rules';
import {campaignOpen,type Opportunity,type SearchReport} from './search-growth';
export type PublicationPlan={key:string;account:string;campaignId:string;groupName:string;model:string;partType:string;productId:string;stock:InventoryPart;draft:RepairDraft;keywords:string[];manualCpcMicros:string|null;copyRulesVersion:string;createdAt:string;correction?:{parentId:string;attempt:1;topics:string[]}};
export function publicationStockProblem(plan:PublicationPlan,part:InventoryPart|null,now=Date.now()){
 if(!part||!part.eligible||part.id!==plan.productId||part.sourceProject!==plan.stock.sourceProject||part.partType!==plan.partType||!part.models.includes(plan.model))return 'stock_unavailable';
 const age=now-Date.parse(part.observedAt);if(!Number.isFinite(age)||age< -60000||age>=300000)return 'stock_stale';
 if(part.quality!==plan.stock.quality||['REVIEW','REVIEW_PAUSE'].includes(inventorySafeguard(plan.stock,part).action))return 'stock_details_changed';
 return null;
}
export function publicationSpendProblem(context:{accountId:string;businessDate:string;allowance:{ready:boolean;allowanceBani:number|null};ronObservation:{accountId:string;currency:string;fetchedAt:string;today?:{date:string;costMicros:string}}|null},account:string,now=Date.now()){
 if(context.accountId!==account||!context.allowance.ready||!context.allowance.allowanceBani)return 'daily_allowance_unavailable';
 const r=context.ronObservation,age=now-Date.parse(r?.fetchedAt??'');
 if(!r||r.accountId!==account||r.currency!=='RON'||!r.today||r.today.date!==context.businessDate||!Number.isFinite(age)||age< -60000||age>300000||!/^\d+$/.test(r.today.costMicros))return 'spend_unverified';
 if(BigInt(r.today.costMicros)>=BigInt(context.allowance.allowanceBani)*10000n)return 'daily_allowance_reached';return null;
}
export function makePublicationPlan(o:Opportunity,part:InventoryPart,report:SearchReport,strategy:string,now=Date.now()):PublicationPlan{
 const age=now-Date.parse(report.fetchedAt),campaign=report.campaigns.find(c=>c.id===o.campaignId);
 if(!report.complete||!report.termsCollected||!Number.isFinite(age)||age< -60000||age>300000||!campaign||!campaignOpen(campaign,report.timeZone,now))throw new Error('search_or_schedule_unverified');
 if(!/^\d{10}$/.test(report.accountId)||!/^\d{1,20}$/.test(o.campaignId)||part.id!==o.productId||part.partType!==o.partType||!part.models.includes(o.model)||!part.eligible||part.available===null||part.available<part.minimumStock)throw new Error('stock_unavailable');
 if(!report.terms.some(t=>t.campaignId===o.campaignId&&t.adGroupId===o.adGroupId&&o.observedTerms.includes(t.term)&&t.impressions>0))throw new Error('search_evidence_missing');
 const draft=generateRepairDraft({...part,models:[o.model]},'https://gsmweb.site/',now);
 if(draft.headlines.length!==15||!draft.headlines.every(validHeadline)||draft.descriptions.length!==4||!draft.pinnedHeadlines?.some(h=>h.field==='HEADLINE_1'&&h.text==='Cu Montaj In Magazin')||!draft.pinnedDescriptions?.some(d=>d.field==='DESCRIPTION_1'&&/numai cu montaj.*Nu se vinde separat/.test(d.text)))throw new Error('truthful_disclosure_missing');
 const key=digest({account:report.accountId,campaign:o.campaignId,model:o.model,partType:part.partType});
 const family=/\biphone\b/i.test(o.model)?'iPhone':'Phone',category={battery:'Batteries',display:'Displays','charging-port':'Charging Ports'}[part.partType!];if(!category)throw new Error('part_type_unsupported');
 const keywords=[...new Set(draft.keywords.filter(k=>k.matchType==='EXACT'&&safeKeyword(k.text)).map(k=>k.text))].slice(0,2);if(!keywords.length)throw new Error('keywords_missing');
 const plan:PublicationPlan={key,account:report.accountId,campaignId:o.campaignId,groupName:`${family} ${category} | ${o.model} | GSMWEB-AI-${key.slice(0,12)}`.slice(0,255),model:o.model,partType:part.partType!,productId:part.id,stock:part,draft,keywords,manualCpcMicros:strategy==='MANUAL_CPC'?(report.currency==='USD'?'632911':report.currency==='RON'?'3000000':null):null,copyRulesVersion:COPY_RULES_VERSION,createdAt:new Date(now).toISOString()};
 if(strategy==='MANUAL_CPC'&&!plan.manualCpcMicros)throw new Error('bid_currency_unsupported');
 const problem=publicationStockProblem(plan,part,now);if(problem)throw new Error(problem);return plan;
}
export type PublicationFeedback={groupResource:string;adResource:string;groupStatus:string;adStatus:string;approval:string;review:string;topics:{topic:string;type:string}[]};
export function googleCleared(f:PublicationFeedback){return f.adStatus==='ENABLED'&&f.approval==='APPROVED'&&f.review==='REVIEWED'&&f.topics.length===0;}
export function creationOperations(p:PublicationPlan){
 const group=`customers/${p.account}/adGroups/-1`;
 return [{adGroupOperation:{create:{resourceName:group,campaign:`customers/${p.account}/campaigns/${p.campaignId}`,name:p.groupName,status:'PAUSED',type:'SEARCH_STANDARD',...(p.manualCpcMicros?{cpcBidMicros:p.manualCpcMicros}:{})}}},
 ...p.keywords.map(text=>({adGroupCriterionOperation:{create:{adGroup:group,status:'ENABLED',keyword:{text,matchType:'EXACT'}}}})),
 {adGroupAdOperation:{create:{adGroup:group,status:'ENABLED',ad:{finalUrls:[p.draft.landingUrl],responsiveSearchAd:{headlines:p.draft.headlines.map(text=>({text,...(p.draft.pinnedHeadlines?.find(h=>h.text===text)?{pinnedField:'HEADLINE_1'}:{})})),descriptions:p.draft.descriptions.map(text=>({text,...(p.draft.pinnedDescriptions?.find(d=>d.text===text)?{pinnedField:'DESCRIPTION_1'}:{})}))}}}}}];
}

export function localPublicationScope(positive:string,scopes:{type:string;name?:string;country?:string;street?:string;city?:string;radius?:number;units?:string}[]){
 const normalized=(v:string)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return positive==='PRESENCE'&&scopes.length>0&&scopes.every(s=>{
  if(s.type==='LOCATION')return s.country==='RO'&&/\bsector(?:ul)? 6\b|drumul taberei/.test(normalized(s.name??''));
  if(s.type==='PROXIMITY'){const radius=s.units==='KILOMETERS'?s.radius:s.units==='MILES'?(s.radius??NaN)*1.609344:NaN;return Number.isFinite(radius)&&radius!>0&&radius!<=3&&/drumul taberei/.test(normalized(s.street??''))&&/\b138\b/.test(s.street??'')&&/bucuresti|bucharest/.test(normalized(s.city??''));}
  return false;
 });
}
