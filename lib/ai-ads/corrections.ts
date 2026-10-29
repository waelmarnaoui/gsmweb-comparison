import {digest,type InventoryPart} from './inventory';
import {headlineFallback,validHeadline,restrictedCopy} from './copy-rules';
import {publicationStockProblem,type PublicationPlan,type PublicationFeedback} from './publishing';
// One factual normalization per ad, never open-ended policy-word experimentation.
const editorial=new Set(['CAPITALIZATION','PUNCTUATION_AND_SYMBOLS','SPACING']);
export function correctionAllowed(f:PublicationFeedback|null){
 return !!f&&f.groupStatus==='PAUSED'&&f.adStatus==='ENABLED'&&f.approval==='DISAPPROVED'&&f.review==='REVIEWED'&&f.topics.length>0&&f.topics.every(t=>editorial.has(t.topic.toUpperCase())&&t.type==='PROHIBITED');
}
export function makeEditorialCorrection(parent:PublicationPlan,f:PublicationFeedback,part:InventoryPart,now=Date.now()):PublicationPlan|null{
 if(parent.correction||!correctionAllowed(f)||publicationStockProblem(parent,part,now))return null;
 const topics=f.topics.map(t=>t.topic.toUpperCase()),spacing=topics.includes('SPACING'),caps=topics.includes('CAPITALIZATION'),punct=topics.includes('PUNCTUATION_AND_SYMBOLS');
 function plain(value:string){let text=value;if(spacing)text=text.replace(/\s+/g,' ').trim();if(punct)text=text.replace(/[!！?？]+/g,'.').replace(/([.,;:])\1+/g,'$1').replace(/[★☆✓✔]/g,'').replace(/\s+/g,' ').trim();if(caps)text=text.charAt(0).toUpperCase()+text.slice(1).toLowerCase();return text;}
 const fix=(v:string)=>v.startsWith('{KeyWord:')?'{KeyWord:'+plain(headlineFallback(v))+'}':plain(v);
 const headlines=parent.draft.headlines.map(fix),descriptions=parent.draft.descriptions.map(plain);
 if(headlines.length!==15||!headlines.every(validHeadline)||new Set(headlines.map(h=>headlineFallback(h).toLowerCase())).size!==15||descriptions.length!==4||descriptions.some(d=>!d||Array.from(d).length>90||restrictedCopy(d)))return null;
 if(JSON.stringify([headlines,descriptions])===JSON.stringify([parent.draft.headlines,parent.draft.descriptions]))return null;
 const pinnedHeadlines=parent.draft.pinnedHeadlines?.map(p=>({...p,text:fix(p.text)})),pinnedDescriptions=parent.draft.pinnedDescriptions?.map(p=>({...p,text:plain(p.text)}));
 if(!pinnedHeadlines?.some(p=>p.field==='HEADLINE_1'&&/cu montaj in magazin/i.test(p.text))||!pinnedDescriptions?.some(p=>p.field==='DESCRIPTION_1'&&/numai cu montaj.*nu se vinde separat/i.test(p.text)))return null;
 const key=digest({parent:parent.key,headlines,descriptions,rule:'editorial-normalization-v1'}),stamp=new Date(now).toISOString();
 const draft={...parent.draft,id:key,headlines,descriptions,pinnedHeadlines,pinnedDescriptions,variants:undefined,inventoryFingerprint:part.fingerprint,stockAtGeneration:part.available,partPriceAtGenerationBani:part.partPriceBani,createdAt:stamp,contentHash:digest({headlines,descriptions,pinnedHeadlines,pinnedDescriptions})};
 return {...parent,key,initialStatus:'ENABLED',groupName:parent.groupName.replace(/ \| GSMWEB-AI-.*/,'')+' | GSMWEB-AI-'+key.slice(0,12)+'-C1',stock:part,draft,createdAt:stamp,correction:{parentId:parent.key,attempt:1,topics}};
}

export function correctionParentMatches(child:PublicationPlan,parent:{id:string;account_id:string;plan:PublicationPlan;group_resource:string|null;ad_resource:string|null;pending_operation:string|null;state:string;error_code:string|null},f:PublicationFeedback|null){
 return !!child.correction&&child.correction.parentId===parent.id&&parent.id===parent.plan.key&&parent.account_id===child.account&&parent.plan.account===child.account&&!parent.plan.correction&&parent.plan.campaignId===child.campaignId&&parent.plan.productId===child.productId&&parent.plan.model===child.model&&parent.plan.partType===child.partType&&!parent.pending_operation&&['submitted','paused'].includes(parent.state)&&parent.error_code!=='owner_paused_group'&&!!f&&f.groupResource===parent.group_resource&&f.adResource===parent.ad_resource&&correctionAllowed(f);
}
