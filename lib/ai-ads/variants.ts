import {digest,type InventoryPart} from './inventory';
export const MAX_COPY_VARIANTS=3;
export type CopyVariant={id:string;label:string;headlines:string[];descriptions:string[];inventoryFingerprint:string;googleReview:'NOT_SUBMITTED';};
const fit=(text:string,max:number)=>Array.from(text).length<=max?text:null;
export function prepareCopyVariants(part:InventoryPart):CopyVariant[]{
 if(!part.eligible||!part.models.length)throw new Error('Verified stock and compatibility are required.');
 const model=fit(`Service ${part.models[0]}`,30)??'Service telefoane',kind=fit(`Reparatii ${part.partType}`,30)??'Reparatii telefoane';
 const modelDescription=fit(`Model din inventar: ${part.models[0]}. Solicita o evaluare in magazin.`,90)??'Contacteaza GSMWEB pentru evaluarea telefonului in magazin.';
 const sets=[
  {label:'Recorded model',headlines:[model,kind,'GSMWEB'],descriptions:[modelDescription,'Reparatii de telefoane in magazin. Disponibilitatea pieselor se confirma.']},
  {label:'Store visit',headlines:['Service in magazin',model,'GSMWEB'],descriptions:['Contacteaza GSMWEB pentru evaluarea telefonului in magazin.',modelDescription]},
  {label:'Recorded part type',headlines:[kind,'Evaluare in magazin','GSMWEB'],descriptions:['Solicita o evaluare pentru reparatia telefonului in magazin.','Disponibilitatea pieselor se confirma in magazin. Contacteaza GSMWEB.']}
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
