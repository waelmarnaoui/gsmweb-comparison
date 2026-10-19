import {z} from 'zod';
import {BULK_FAMILIES,BULK_SERVICES,BULK_COPY_VERSION,type BulkFamily,type BulkService} from './catalog';
import {validHeadline,headlineFallback,replacementKeyword,restrictedCopy} from '../ai-ads/copy-rules';
import type {SearchReport} from '../ai-ads/search-growth';
import {safeSearchTerm} from '../ai-ads/search-terms';
export const bulkSelectionSchema=z.object({service:z.enum(BULK_SERVICES.map(s=>s.id)),family:z.enum(BULK_FAMILIES.map(f=>f.id)),models:z.array(z.string().max(80)).min(1).max(50),includeSuggestions:z.boolean().default(false)}).strict();
export type BulkSelection=z.infer<typeof bulkSelectionSchema>;
export type BulkKeyword={text:string;matchType:'EXACT';model:string;source:'google_search'|'suggestion';clicks:number;impressions:number};
export type BulkAd={label:string;headlines:string[];descriptions:string[]};
export type BulkDraft={version:string;selection:BulkSelection;groupName:string;ads:BulkAd[];keywords:BulkKeyword[];uncoveredModels:string[];landingUrl:string;keywordWindow:{start:string;end:string;collectedAt:string}|null};
const norm=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/([a-z])(\d)/g,'$1 $2').replace(/(\d)([a-z])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const variants=new Set(['pro','max','plus','mini','ultra','lite','fe','se','neo','fusion']);
function aliases(model:string){return [...new Set([model,model.replace(/^Samsung Galaxy /,''),model.replace(/^Samsung /,''),model.replace(/^Motorola /,''),model.replace(/^Huawei /,''),model.replace(/^Xiaomi /,'')].map(norm))].filter(a=>a.length>=3&&/[a-z]/.test(a));}
const modelIndex=BULK_FAMILIES.flatMap(f=>f.models).map(name=>({name,normalized:norm(name),aliases:aliases(name)})).sort((a,b)=>b.normalized.length-a.normalized.length);
export function observedModel(term:string){
 if(!safeSearchTerm(term)||/\b(si|sau|versus|vs)\b/.test(norm(term)))return null;
 const t=norm(term),qualifiers=t.split(' ').filter(w=>variants.has(w)),found=modelIndex.filter(model=>model.aliases.some(a=>(` ${t} `).includes(` ${a} `))&&qualifiers.every(w=>model.normalized.split(' ').includes(w)));
 if(found[0]&&found.some(m=>!(` ${found[0].normalized} `).includes(` ${m.normalized} `)))return null;
 return found[0]?.name??null;
}
export function serviceIntent(term:string):BulkService|null{
 const t=norm(term);if(/\b(gratis|tutorial|manual|diy|folie|husa|tempered)\b/.test(t))return null;
 const glass=/\b(sticla|geam)\b/.test(t),kinds:BulkService[]=[];
 if(/\b(baterie|battery|acumulator)\b/.test(t))kinds.push('battery');
 if(glass)kinds.push('glass');else if(/\b(display|ecran|lcd|oled)\b/.test(t))kinds.push('display');
 if(/\b(camera|camere)\b/.test(t))kinds.push('camera');
 if(/\b(port|mufa|conector) (?:de )?incarcare\b/.test(t))kinds.push('charging');
 return kinds.length===1?kinds[0]:null;
}
export function bulkModelHeadline(part:string,model:string){
 const candidates=[model,model.replace(/^Samsung /,''),model.replace(/^Samsung Galaxy /,''),model.replace(/^iPhone /,''),model.replace(/^Motorola /,''),model.replace(/^Huawei /,''),model.replace(/^Xiaomi /,'')];
 return candidates.map(m=>`${part} ${m}`).find(validHeadline)??null;
}
export function prepareBulkDraft(raw:BulkSelection,report:SearchReport|null):BulkDraft{
 const selection=bulkSelectionSchema.parse(raw),family=BULK_FAMILIES.find(f=>f.id===selection.family)!,service=BULK_SERVICES.find(s=>s.id===selection.service)!;
 if(new Set(selection.models).size!==selection.models.length||selection.models.some(m=>!(family.models as readonly string[]).includes(m)))throw new Error('Select only models from this phone family.');
 selection.models=[...selection.models].sort((a,b)=>(family.models as readonly string[]).indexOf(a)-(family.models as readonly string[]).indexOf(b));
 const terms=new Map<string,BulkKeyword>();
 if(report?.complete&&report.termsCollected){for(const row of report.terms){
  if(serviceIntent(row.term)!==selection.service||!replacementKeyword(row.term)||row.impressions<1)continue;
  const model=observedModel(row.term);if(!model||!selection.models.includes(model))continue;
  const key=norm(row.term),old=terms.get(key);if(old){old.clicks+=row.clicks;old.impressions+=row.impressions;}else terms.set(key,{text:row.term,model,matchType:'EXACT',source:'google_search',clicks:row.clicks,impressions:row.impressions});
 }}
 const keywords=[...terms.values()].sort((a,b)=>b.clicks-a.clicks||b.impressions-a.impressions||a.text.localeCompare(b.text)).slice(0,100);
 if(selection.includeSuggestions){for(const model of selection.models){if(keywords.some(k=>k.model===model))continue;for(const verb of ['inlocuire','schimbare']){const text=`${verb} ${service.keyword} ${model}`;if(replacementKeyword(text)&&keywords.length<100)keywords.push({text,model,matchType:'EXACT',source:'suggestion',clicks:0,impressions:0});}}}
 const covered=selection.models.filter(m=>keywords.some(k=>k.model===m));
 // All ads in a family group share all keywords. If a keyword is too long for
 // insertion, a model-specific default could show the wrong model. Use the
 // family default in that case; retain the full exact term in the group.
 const modelLines=keywords.every(k=>Array.from(k.text).length<=30)?covered.map(m=>bulkModelHeadline(`Inlocuire ${service.part}`,m)).filter((h):h is string=>!!h):[];
 const familyFallback=[`Inlocuire ${service.part} ${family.label}`,`Schimbare ${service.part} GSMWEB`,`Inlocuire ${service.part}`].find(validHeadline)!;
 const disclosure=selection.service==='glass'?'Schimbam doar sticla daca panoul si functia tactila permit pastrarea displayului.':'Piesa se furnizeaza numai cu montaj in magazin. Nu se vinde separat.';
 const specific=selection.service==='glass'?'Alternativa la display complet. Costul si eligibilitatea se confirma dupa verificare.':selection.service==='camera'?'Inlocuire modul camera, dupa verificarea modelului si a compatibilitatii.':`${service.part} pentru ${family.label}. Confirma modelul si disponibilitatea cu echipa.`;
 const descriptions=[disclosure,specific,'GSMWEB, Drumul Taberei 138, Sector 6. Discuta cu echipa despre telefonul tau.','Solicita detalii despre montaj si compatibilitate. Oferta se confirma in magazin.'];
 const ads=[0,1,2].map(i=>{
  const dynamic=[...new Set([modelLines[i%Math.max(1,modelLines.length)]??familyFallback,...modelLines.filter((_,n)=>n%3===i)].slice(0,8))].map(h=>`{KeyWord:${h}}`);
  const serviceLines={battery:['Telefonul Se Descarca?','Inlocuire Baterie Telefon'],display:['Display Spart?','Inlocuire Ecran Telefon'],camera:['Fotografii Cu Probleme?','Inlocuire Modul Camera'],charging:['Probleme La Incarcare?','Verificare Port Incarcare'],glass:['Doar Sticla Displayului','Pastreaza Panoul Functional']}[selection.service];
  const lines=[...dynamic,'Cu Montaj In Magazin',['Detalii Despre Piesa','Vizita La GSMWEB','Montaj Pentru Telefon'][i],...serviceLines,`${service.part} La GSMWEB`,`${service.part} Sector 6`,...['Drumul Taberei Nr 138','Discuta Cu Echipa GSMWEB','Contacteaza GSMWEB','GSMWEB Bucuresti','Verifica Modelul Cu Echipa','Viziteaza GSMWEB','Detalii Despre Montaj','Programare In Magazin','Verifica Compatibilitatea','GSMWEB Drumul Taberei','Detalii In Magazin','Pentru Telefonul Tau']];
  const seen=new Set<string>(),headlines=lines.filter(validHeadline).filter(h=>{const key=headlineFallback(h).toLowerCase();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,15);
  if(headlines.length!==15||descriptions.some(d=>Array.from(d).length>90||restrictedCopy(d)))throw new Error('Copy requires review before saving.');
  return {label:['Model keywords','Local store','Replacement & installation'][i],headlines,descriptions:[descriptions[0],...descriptions.slice(1).slice(i),...descriptions.slice(1).slice(0,i)]};
 });
 return {version:BULK_COPY_VERSION,selection,groupName:`AI ${family.label} ${service.suffix}`,ads,keywords,uncoveredModels:selection.models.filter(m=>!covered.includes(m)),landingUrl:'https://gsmweb.site/',keywordWindow:report?{start:report.windowStart,end:report.windowEnd,collectedAt:report.fetchedAt}:null};
}
export function assertBulkDraft(draft:BulkDraft){
 if(draft.version!==BULK_COPY_VERSION||draft.ads.length<1||draft.ads.length>3||!draft.keywords.length||draft.keywords.length>100||draft.landingUrl!=='https://gsmweb.site/')throw new Error('Review current ads and keywords before publishing.');
 if(draft.keywords.some(k=>k.matchType!=='EXACT'||!replacementKeyword(k.text)||!draft.selection.models.includes(k.model)))throw new Error('Every EXACT keyword must include inlocuire or schimbare. Product-only keywords are not allowed.');
 if(draft.ads.some(a=>a.headlines.length!==15||!a.headlines.every(validHeadline)||!a.headlines.includes('Cu Montaj In Magazin')||a.descriptions.length!==4||a.descriptions.some(d=>Array.from(d).length>90||restrictedCopy(d))))throw new Error('Invalid ad assets.');
}
export function bulkCreateOperations(account:string,campaignId:string,draft:BulkDraft,strategy:string,cpcMicros:string|null=null){
 assertBulkDraft(draft);if(!/^\d{10}$/.test(account)||!/^\d{1,20}$/.test(campaignId))throw new Error('Invalid Google destination.');
 if(strategy==='MANUAL_CPC'&&(!cpcMicros||!/^\d{1,9}$/.test(cpcMicros)||Number(cpcMicros)<10000||Number(cpcMicros)>100000000))throw new Error('Enter an approved maximum CPC in account currency for this manual-bidding campaign.');
 const group=`customers/${account}/adGroups/-1`;
 return [{adGroupOperation:{create:{resourceName:group,campaign:`customers/${account}/campaigns/${campaignId}`,name:draft.groupName,status:'PAUSED',type:'SEARCH_STANDARD',...(strategy==='MANUAL_CPC'?{cpcBidMicros:cpcMicros}:{})}}},
 ...draft.keywords.map(k=>({adGroupCriterionOperation:{create:{adGroup:group,status:'ENABLED',keyword:{text:k.text,matchType:'EXACT'}}}})),
 ...draft.ads.map(ad=>({adGroupAdOperation:{create:{adGroup:group,status:'ENABLED',ad:{finalUrls:[draft.landingUrl],responsiveSearchAd:{headlines:ad.headlines.map(text=>({text,...(text==='Cu Montaj In Magazin'?{pinnedField:'HEADLINE_1'}:{})})),descriptions:ad.descriptions.map((text,i)=>({text,...(i===0?{pinnedField:'DESCRIPTION_1'}:{})}))}}}}}))];
}
