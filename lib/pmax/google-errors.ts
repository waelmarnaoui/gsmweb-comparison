import {safeGoogleCodes} from '../ads-control/google';
// Retain schema/error identifiers only; Google messages may contain submitted data.
export function pmaxGoogleDiagnostics(body:unknown){
 const result=safeGoogleCodes(body),data=body as any;
 const add=(value:string)=>{if(!result.includes(value)&&result.length<16)result.push(value);};
 const field=(value:unknown)=>typeof value==='string'&&value.length<=180&&/^[a-zA-Z][a-zA-Z0-9_.\[\]]*$/.test(value)?value:null;
 for(const detail of Array.isArray(data?.error?.details)?data.error.details.slice(0,10):[]){
  for(const error of Array.isArray(detail?.errors)?detail.errors.slice(0,10):[]){
   for(const value of Object.values(error?.errorCode??{}))if(typeof value==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(value))add(value);
   const elements=error?.location?.fieldPathElements;
   if(Array.isArray(elements)){
    const path=elements.slice(0,12).map((e:any)=>{const name=field(e?.fieldName);return name?name+(Number.isInteger(e?.index)&&e.index>=0?'['+e.index+']':''):'';}).filter(Boolean).join('.');
    if(path)add('FIELD:'+path.slice(0,180));
   }
  }
  for(const violation of Array.isArray(detail?.fieldViolations)?detail.fieldViolations.slice(0,5):[]){const name=field(violation?.field);if(name)add('FIELD:'+name);}
 }
 const message=data?.error?.message;
 if(typeof message==='string'){
  // REST unknown-field errors often have no GoogleAdsFailure error codes.
  const match=/Unknown name "([A-Za-z][A-Za-z0-9_]{0,79})"/.exec(message);
  if(match)add('UNKNOWN_FIELD:'+match[1]);
 }
 return result;
}
