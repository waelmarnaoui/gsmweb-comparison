import {digest,type InventoryPart} from './inventory';
import {advertisingPartLabel,validHeadline,headlineFallback,restrictedCopy} from './copy-rules';
export const MAX_COPY_VARIANTS=3;
export type CopyVariant={id:string;label:string;headlines:string[];descriptions:string[];inventoryFingerprint:string;googleReview:'NOT_SUBMITTED';};
const fit=(text:string,max:number)=>Array.from(text).length<=max?text:null;
export function prepareCopyVariants(part:InventoryPart):CopyVariant[]{
 if(!part.eligible||!part.models.length)throw new Error('Verified stock and compatibility are required.');
 const kind=advertisingPartLabel(part.partType);if(!kind)throw new Error('Only displays, batteries and charging ports may generate ads.');
 const model=part.models[0],dynamic=[`{KeyWord:Inlocuire ${kind}}`,`GSMWEB {KeyWord:${kind}}`,`{KeyWord:${kind}} Sector 6`];
 const common=[fit(`${kind} ${model}`,30),fit(`Inlocuire ${model}`,30),`Montaj ${kind}`,`${kind} Pentru Telefon`,`${kind} La GSMWEB`,`${kind} In Sector 6`,`${kind} Drumul Taberei`,`Verificare ${kind}`,'Inlocuire In Magazin','Evaluare La GSMWEB','Drumul Taberei Nr 138','GSMWEB Drumul Taberei','Montaj In Sector 6','Discuta Cu Echipa GSMWEB','Solicita Evaluare','Contacteaza GSMWEB','GSMWEB In Sector 6','Piese Pentru Inlocuire'];
 const description=fit(`Inlocuire ${kind.toLowerCase()} pentru ${model}. Evaluare in magazin la GSMWEB.`,90)??`Inlocuire ${kind.toLowerCase()} pentru telefon. Solicita o evaluare in magazin la GSMWEB.`;
 const descriptions=[description,'Disponibilitatea pieselor se confirma in magazin. Drumul Taberei 138, Sector 6.','Contacteaza GSMWEB pentru verificarea piesei necesare si detalii despre montaj.','Inlocuire si montaj in magazin. Contacteaza-ne pentru o evaluare a telefonului.'];
 if(descriptions.some(text=>restrictedCopy(text)||/[{}]/.test(text)||Array.from(text).length>90))throw new Error('Recorded model text requires copy review before drafting.');
 function headlines(priority:(string|null)[]){
  const seen=new Set<string>();const selected=[...dynamic,...priority,...common].filter((text):text is string=>!!text&&validHeadline(text)).filter(text=>{const key=headlineFallback(text).toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,15);
  if(selected.length!==15)throw new Error('Fifteen distinct valid headlines could not be prepared.');return selected;
 }
 const sets=[
  {label:'Recorded model',headlines:headlines([fit(`${kind} ${model}`,30),fit(`Inlocuire ${model}`,30)]),descriptions},
  {label:'Store visit',headlines:headlines(['Drumul Taberei Nr 138','GSMWEB In Sector 6','Montaj In Drumul Taberei']),descriptions:[descriptions[1],descriptions[0],descriptions[2],descriptions[3]]},
  {label:'Recorded part type',headlines:headlines([`Montaj ${kind}`,`Verificare ${kind}`,'Discuta Despre Inlocuire']),descriptions:[descriptions[2],descriptions[0],descriptions[1],descriptions[3]]}
 ];
 return sets.slice(0,MAX_COPY_VARIANTS).map(copy=>({...copy,id:digest({copy,fingerprint:part.fingerprint}),inventoryFingerprint:part.fingerprint,googleReview:'NOT_SUBMITTED'}));
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
