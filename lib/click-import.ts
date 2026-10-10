import {createHash} from 'node:crypto';
export type ExistingClick={source_key:string;clicked_at:string;gclid:string|null;session_id:string|null};
export function eventKey(sheet:string,values:Record<string,string>){
 return sheet+':'+(values.event_id||createHash('sha256').update(JSON.stringify(values)).digest('hex'));
}
export function clickImportRows(sheet:string,values:Record<string,string>[],existing:ExistingClick[]){
 const known=new Map(existing.map(c=>[c.source_key,c])),rows=new Map<string,ExistingClick&{campaign:string|null;page_url:string|null}>();
 for(const v of values){
  const base=eventKey(sheet,v),old=known.get(base);
  let key=v.event_id?base+':'+createHash('sha256').update(JSON.stringify([v.timestamp,v.gclid||'',v.session_id||''])).digest('hex'):base;
  // Some sheets reuse an ID/GCLID for repeated clicks. Never silently discard a later timestamp.
  if(old&&Date.parse(old.clicked_at)===Date.parse(v.timestamp)&&(old.gclid||'')===(v.gclid||'')&&(old.session_id||'')===(v.session_id||''))key=base;
  const row={source_key:key,clicked_at:v.timestamp,gclid:v.gclid||null,session_id:v.session_id||null,campaign:v.campaign||null,page_url:v.page_url||null};
  rows.set(key,row);
 }
 return [...rows.values()];
}
