export const AD_PART_TYPES=['display','battery','charging-port'] as const;
export const COPY_RULES_VERSION='major-parts-15-dki-v1';
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
 try{const fallback=headlineFallback(text);return fallback.length>0&&Array.from(fallback).length<=30&&!restrictedCopy(text)&&!/[\u0000-\u001f]/.test(text);}catch{return false;}
}
export function safeKeyword(text:string){return !!text&&!restrictedCopy(text)&&!/[{}\u0000-\u001f]/.test(text)&&Array.from(text).length<=80&&text.split(/\s+/).length<=10;}
export function insertionPreview(headline:string,keyword:string){
 if(!validHeadline(headline)||!safeKeyword(keyword))throw new Error('Keyword insertion requires reviewed, unrestricted copy and keywords.');
 const inserted=headline.replace(/\{KeyWord:([^{}:]+)\}/g,keyword);
 return Array.from(inserted).length<=30?inserted:headlineFallback(headline);
}
