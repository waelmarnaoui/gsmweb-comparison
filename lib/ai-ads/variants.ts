import {digest,type InventoryPart} from './inventory';
import {advertisingPartLabel,validHeadline,headlineFallback,restrictedCopy,modelPartHeadline} from './copy-rules';
export const MAX_COPY_VARIANTS=3;
export type CopyVariant={id:string;label:string;headlines:string[];descriptions:string[];inventoryFingerprint:string;googleReview:'NOT_SUBMITTED';pinnedHeadlines:{text:string;field:'HEADLINE_1'}[];pinnedDescriptions:{text:string;field:'DESCRIPTION_1'}[];};
const fit=(text:string,max:number)=>Array.from(text).length<=max?text:null;
export function prepareCopyVariants(part:InventoryPart):CopyVariant[]{
 if(!part.eligible||!part.models.length)throw new Error('Verified stock and compatibility are required.');
 const kind=advertisingPartLabel(part.partType);if(!kind)throw new Error('Only displays, batteries and charging ports may generate ads.');
 const model=part.models[0];
 // The complete default headline is inside the official insertion syntax.
 const modelHeadline=modelPartHeadline(kind,model);
 const dynamic=[`{KeyWord:${modelHeadline??kind}}`,'{KeyWord:GSMWEB Drumul Taberei}',`{KeyWord:${kind} Sector 6}`];
 const installation=['Cu Montaj In Magazin',`Montaj ${kind}`];
 const common=[fit(`${kind} ${model}`,30),`${kind} La GSMWEB`,`${kind} In Sector 6`,`${kind} Drumul Taberei`,'Drumul Taberei Nr 138','GSMWEB Drumul Taberei','Discuta Cu Echipa GSMWEB','Contacteaza GSMWEB','GSMWEB In Sector 6','Detalii La GSMWEB','Viziteaza GSMWEB','GSMWEB Bucuresti','Verifica Modelul Cu Echipa','Drumul Taberei Sector 6'];
 const disclosure='Piesa se furnizeaza numai cu montaj in magazin. Nu se vinde separat.';
 const modelDescription=fit(`${kind} pentru ${model}, cu montaj in magazin la GSMWEB.`,90)??`${kind} pentru telefon, cu montaj in magazin la GSMWEB. Verifica modelul cu echipa.`;
 const descriptions=[disclosure,modelDescription,'GSMWEB, Drumul Taberei 138, Sector 6. Disponibilitatea se confirma in magazin.','Contacteaza GSMWEB pentru compatibilitate, disponibilitate si detalii despre montaj.'];
 if(descriptions.some(text=>restrictedCopy(text)||/[{}]/.test(text)||Array.from(text).length>90))throw new Error('Recorded model text requires copy review before drafting.');
 function headlines(priority:(string|null)[]){
  const seen=new Set<string>();const selected=[...dynamic,...installation,...priority,...common].filter((text):text is string=>!!text&&validHeadline(text)).filter(text=>{const key=headlineFallback(text).toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,15);
  if(selected.length!==15||selected.filter(text=>/\bmontaj\b/i.test(text)).length!==2)throw new Error('Fifteen distinct valid headlines and two installation disclosures are required.');return selected;
 }
 const sets=[
  {label:'Recorded model',headlines:headlines([fit(`${kind} ${model}`,30)]),descriptions},
  {label:'Store visit',headlines:headlines(['Drumul Taberei Nr 138','GSMWEB In Sector 6','Viziteaza GSMWEB']),descriptions:[descriptions[0],descriptions[2],descriptions[1],descriptions[3]]},
  {label:'Recorded part type',headlines:headlines([`${kind} La GSMWEB`,`${kind} Drumul Taberei`,'Discuta Cu Echipa GSMWEB']),descriptions:[descriptions[0],descriptions[3],descriptions[1],descriptions[2]]}
 ];
 return sets.slice(0,MAX_COPY_VARIANTS).map(copy=>{
  const assets={...copy,pinnedHeadlines:[{text:installation[0],field:'HEADLINE_1' as const}],pinnedDescriptions:[{text:disclosure,field:'DESCRIPTION_1' as const}]};
  return {...assets,id:digest({copy:assets,fingerprint:part.fingerprint}),inventoryFingerprint:part.fingerprint,googleReview:'NOT_SUBMITTED' as const};
 });
}
export type ReviewFeedback={approvalStatus:string;reviewStatus:string;topics:{topic:string;type:string}[]};
export function nextCopyStep(input:{feedback:ReviewFeedback|null;attempts:number;internalHighRisk:boolean;stockCurrent:boolean;scopeApproved:boolean}){
 const result=(action:string,reason:string)=>({action,reason});
 if(input.internalHighRisk)return result('STOP_POLICY','The internal review blocks this offer. Copy changes cannot establish permission to advertise it.');
 if(!input.stockCurrent)return result('STOP_STOCK','Current stock evidence is required.');
 if(!input.scopeApproved)return result('WAIT_FOR_OWNER','The testing scope requires owner approval.');
 if(!Number.isSafeInteger(input.attempts)||input.attempts<0||input.attempts>MAX_COPY_VARIANTS)return result('STOP_REVIEW','Invalid attempt history.');
 if(!input.feedback)return result('WAIT_FOR_GOOGLE','No actual Google review result is linked to this variant.');
 const f=input.feedback;
 if(f.topics.some(t=>/TECHNICAL.?SUPPORT|HARDWARE.?REPAIR|MISREPRESENTATION|UNACCEPTABLE.?BUSINESS|COUNTERFEIT|CIRCUMVENT/i.test(t.topic)))return result('STOP_POLICY','A business, trust or restricted-service issue requires review, not alternate wording.');
 if(f.reviewStatus!=='REVIEWED')return result('WAIT_FOR_GOOGLE','Google has not completed its review. API format validation is not approval.');
 if(f.approvalStatus==='APPROVED'&&f.topics.every(t=>t.type==='DESCRIPTIVE'))return result('REVIEW_ELIGIBLE','Google approved this particular reviewed ad. This does not enable spending or establish profitability.');
 if(input.attempts>=MAX_COPY_VARIANTS)return result('STOP_REVIEW','The three-variant limit has been reached. Request a human review.');
 const editorial=new Set(['EDITORIAL','EDITORIAL_REQUIREMENTS','CAPITALIZATION','PUNCTUATION_AND_SYMBOLS','SPACING']);
 if(f.approvalStatus==='DISAPPROVED'&&f.topics.length>0&&f.topics.every(t=>editorial.has(t.topic.toUpperCase())))return result('PREPARE_CORRECTION','Prepare a factual editorial correction within the approved scope. It is not submitted automatically.');
 return result('STOP_REVIEW','Unknown, limited or non-editorial Google feedback requires review before another attempt.');
}
