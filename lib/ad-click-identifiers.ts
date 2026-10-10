export type BraidIdentifiers={gbraid:string;wbraid:string};
export function extractBraidIdentifiers(pageUrl:unknown,matchedGclid:string):BraidIdentifiers{
 const empty={gbraid:'',wbraid:''};
 if(typeof pageUrl!=='string'||!pageUrl.trim()||!matchedGclid)return empty;
 let url:URL;try{url=new URL(pageUrl);}catch{return empty;}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return empty;
 const gclids=url.searchParams.getAll('gclid');
 // Never enrich a matched click with identifiers from a conflicting ad URL.
 if(gclids.some(value=>value!==matchedGclid))return empty;
 function identifier(name:string){
  const values=[...new Set(url.searchParams.getAll(name))];
  return values.length===1&&/^[A-Za-z0-9_-]{1,512}$/.test(values[0])?values[0]:'';
 }
 return {gbraid:identifier('gbraid'),wbraid:identifier('wbraid')};
}

