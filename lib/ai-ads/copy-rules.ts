export const AD_PART_TYPES=['display','battery','charging-port'] as const;
export const COPY_RULES_VERSION='major-parts-15-replacement-exact-v4';
export type AdPartType=typeof AD_PART_TYPES[number];
export function advertisingPartType(value:unknown):AdPartType|null{
 const normalized=typeof value==='string'?value.trim().toLowerCase():'';return AD_PART_TYPES.includes(normalized as AdPartType)?normalized as AdPartType:null;
}
export function advertisingPartLabel(value:unknown){
 const type=advertisingPartType(value);return type?{display:'Display',battery:'Baterie','charging-port':'Port Incarcare'}[type]:null;
}
export function restrictedCopy(text:string){
 const normalized=text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
 return /\bservice\s+gsm\b|\breparati[a-z]*\b/.test(normalized);
}
export function headlineFallback(text:string){
 const rendered=text.replace(/\{KeyWord:([^{}:]+)\}/g,'$1');
 if(/[{}]/.test(rendered))throw new Error('Invalid keyword-insertion syntax.');
 return rendered;
}
export function validHeadline(text:string){
 try{if(/[{}]/.test(text)&&!/^\{KeyWord:[^{}:]+\}$/.test(text))return false;const fallback=headlineFallback(text);return fallback.length>0&&Array.from(fallback).length<=30&&!restrictedCopy(text)&&!/[\u0000-\u001f]/.test(text);}catch{return false;}
}
export function modelPartHeadline(kind:string,model:string){
 const normalized=model.replace(/\s+/g,' ').trim();
 if(!normalized||/[{}\u0000-\u001f]/.test(model))return null;
 // Only remove redundant manufacturer/family prefixes, never a model number or suffix.
 const models=[normalized,normalized.replace(/^Apple\s+(?=iPhone\b)/i,''),normalized.replace(/^Samsung\s+(?=Galaxy\b)/i,''),normalized.replace(/^Samsung\s+Galaxy\s+/i,''),normalized.replace(/^(?:Apple\s+)?iPhone\s+/i,'')];
 for(const name of models){const headline=`${kind} ${name}`;if(validHeadline(headline))return headline;}
 return null;
}
export function safeKeyword(text:string){return !!text&&!restrictedCopy(text)&&!/[{}\u0000-\u001f]/.test(text)&&Array.from(text).length<=80&&text.split(/\s+/).length<=10;}
export function replacementKeyword(text:string){
 const words=text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
 return safeKeyword(text)&&/\b(inlocuire|schimbare)\b/.test(words)&&!(/\b(vand|vanzare|cumpar|cumparare|depozit)\b/.test(words));
}
export function insertionPreview(headline:string,keyword:string){
 if(!validHeadline(headline)||!safeKeyword(keyword))throw new Error('Keyword insertion requires reviewed, unrestricted copy and keywords.');
 const inserted=headline.replace(/\{KeyWord:([^{}:]+)\}/g,keyword);
 return Array.from(inserted).length<=30?inserted:headlineFallback(headline);
}
