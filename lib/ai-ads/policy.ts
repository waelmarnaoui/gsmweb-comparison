import {digest,type InventoryPart} from './inventory';
import {prepareCopyVariants,type CopyVariant} from './variants';
import {advertisingPartLabel,safeKeyword} from './copy-rules';
export const POLICY_VERSION='gsmweb-repair-2026-10-16';
export const POLICY_CHECKED_AT='2026-10-16T11:08:48.000Z';
export const policySources=[
 {id:'consumer_repair',title:'Third-party consumer technical support',url:'https://support.google.com/adspolicy/answer/13527027?hl=en'},
 {id:'misrepresentation',title:'Misrepresentation',url:'https://support.google.com/adspolicy/answer/6020955?hl=en'},
 {id:'destination',title:'Destination requirements',url:'https://support.google.com/adspolicy/answer/6368661?hl=en'},
 {id:'editorial',title:'Editorial',url:'https://support.google.com/adspolicy/answer/6021546?hl=en'},
 {id:'trademark',title:'Trademarks',url:'https://support.google.com/adspolicy/answer/6118?hl=en'},
 {id:'consumer_law',title:'EU consumer guarantees: applicability requires market review',url:'https://europa.eu/youreurope/business/selling-in-eu/consumer-contracts-guarantees/consumer-guarantees/index_en.htm'}
];
export type PolicyIssue={code:string;risk:'low'|'medium'|'high';explanation:string;correction:string;source:string};
export type RepairDraft={id:string;productId:string;inventoryFingerprint:string;offerType:'in_store_consumer_phone_repair';state:'internal_blocked';headlines:string[];descriptions:string[];variants?:CopyVariant[];keywords:{text:string;matchType:'EXACT'|'PHRASE';basis:string}[];negativeSuggestions:{text:string;needsApproval:true}[];landingUrl:string|null;repairPriceBani:null;stockAtGeneration:number|null;partPriceAtGenerationBani:number|null;policy:{version:string;checkedAt:string;reviewExpiresAt:string;risk:'high';publishAllowed:false;issues:PolicyIssue[];sources:typeof policySources};createdAt:string;contentHash:string;searchVolume:null;competition:null};
function compact(text:string){return text.replace(/\s+/g,' ').trim();}
export function generateRepairDraft(part:InventoryPart,landingUrl:string|null,now=Date.now()):RepairDraft{
 if(!part.eligible)throw new Error('Only stock-qualified inventory can generate an internal draft.');
 const issues:PolicyIssue[]=[{code:'third_party_consumer_repair',risk:'high',explanation:'The stated offer is third-party consumer phone hardware repair, explicitly included in Google’s restricted technical-support policy. A physical shop does not establish an exception.',correction:'Do not publish. Obtain policy clarification from Google for the actual business offer; do not disguise repair services as parts sales.',source:policySources[0].url}];
 const variants=prepareCopyVariants(part),headlines=variants[0].headlines,descriptions=variants[0].descriptions,kind=advertisingPartLabel(part.partType)!;
 const raw=part.models.slice(0,8).flatMap(model=>[
  {text:compact(`inlocuire ${kind.toLowerCase()} ${model}`),matchType:'EXACT' as const,basis:'canonical part type and verified compatible model from the inventory database'},
  {text:compact(`schimbare ${kind.toLowerCase()} ${model}`),matchType:'PHRASE' as const,basis:'canonical part type and verified compatible model from the inventory database'},
  {text:compact(`${kind.toLowerCase()} ${model}`),matchType:'EXACT' as const,basis:'canonical part type and verified compatible model from the inventory database'},
  {text:compact(`montaj ${kind.toLowerCase()} ${model}`),matchType:'PHRASE' as const,basis:'canonical part type and verified compatible model from the inventory database'}
 ]);
 const keywords=raw.filter(k=>safeKeyword(k.text)).filter((k,i,all)=>all.findIndex(x=>x.text===k.text&&x.matchType===k.matchType)===i);
 if(!keywords.length)issues.push({code:'keyword_length',risk:'high',explanation:'Verified inventory terms do not fit supported keyword limits.',correction:'Review verified model and part labels before creating keywords.',source:policySources[3].url});
 if(!landingUrl)issues.push({code:'landing_unverified',risk:'high',explanation:'No verified repair-service landing page is configured.',correction:'Provide an accurate public service page, seller identity, address, terms and contact details for review.',source:policySources[2].url});
 else issues.push({code:'destination_review_required',risk:'high',explanation:'The owner supplied a candidate business destination. Its presence does not establish policy clearance or verify each advertised service and claim.',correction:'Review the actual destination, seller details, advertised repair scope and customer terms before submission.',source:policySources[2].url});
 issues.push({code:'seller_and_claims_review',risk:'medium',explanation:'Seller identity, service capacity, images, parts condition, trademarks and service terms have not been independently verified.',correction:'Review the real service and destination. Do not promise a repair price, completion time, warranty, manufacturer affiliation or original parts without evidence.',source:policySources[1].url});
 issues.push({code:'keyword_insertion_scope',risk:'medium',explanation:'Keyword insertion uses the triggering ad-group keyword, not arbitrary search text. Unreviewed existing keywords could insert copy the owner restricted.',correction:'Use only the reviewed model-specific keywords and audit the whole target ad group before submission. Dynamic fallback and inserted text must fit the headline limit.',source:'https://support.google.com/google-ads/answer/6371157?hl=en'});
 const reviewed=Date.parse(POLICY_CHECKED_AT),expires=reviewed+7*86400000;
 if(now>expires||now<reviewed-60000)issues.push({code:'policy_review_stale',risk:'high',explanation:'The official-source policy review is outside its validity window.',correction:'Review current official policies and update the versioned source record; timestamps must not refresh automatically without a review.',source:policySources[0].url});
 const body={productId:part.id,inventoryFingerprint:part.fingerprint,offerType:'in_store_consumer_phone_repair' as const,state:'internal_blocked' as const,headlines,descriptions,keywords,negativeSuggestions:['manual','tutorial','DIY'].map(text=>({text,needsApproval:true as const})),landingUrl,repairPriceBani:null,stockAtGeneration:part.available,partPriceAtGenerationBani:part.partPriceBani,
  variants,policy:{version:POLICY_VERSION,checkedAt:new Date(now).toISOString(),reviewExpiresAt:new Date(expires).toISOString(),risk:'high' as const,publishAllowed:false as const,issues,sources:policySources},searchVolume:null,competition:null};
 const contentHash=digest({...body,policy:{...body.policy,checkedAt:POLICY_CHECKED_AT}});
 return {...body,id:digest({source:part.sourceProject,product:part.id,contentHash}),createdAt:new Date(now).toISOString(),contentHash};
}
export function assertPublicationAllowed(input:{globalPaused:boolean;approvedHash:string|null;draft:RepairDraft;current:InventoryPart|null;now?:number}){
 const now=input.now??Date.now();
 if(input.globalPaused)throw new Error('Automation is paused.');
 if(input.draft.offerType==='in_store_consumer_phone_repair')throw new Error('Publication blocked by the third-party consumer repair policy. Approval cannot override this restriction.');
 if(!input.approvedHash||input.approvedHash!==input.draft.contentHash)throw new Error('Exact draft approval is required.');
 if(!input.current?.eligible||input.current.fingerprint!==input.draft.inventoryFingerprint||now-Date.parse(input.current.observedAt)>300000)throw new Error('Inventory changed or is stale.');
}
