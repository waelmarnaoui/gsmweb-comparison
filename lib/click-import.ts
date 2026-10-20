import {createHash} from 'node:crypto';
import {IntegrationError} from './integration-error';
export type ClickImportStage='read'|'parse'|'compare'|'save'|'record';
export function clickImportFailure(error:unknown,stage:ClickImportStage){
 if(error instanceof IntegrationError)return error;
 const messages:Record<ClickImportStage,string>={read:'Google Sheets could not be read. Check the sheet connection and try again.',parse:'The spreadsheet returned an unsupported row format. Check the header row and timestamp cells.',compare:'Saved website clicks could not be compared. Check the attribution database connection.',save:'Website clicks could not be saved. Refresh before retrying; already saved clicks will not be duplicated.',record:'Website import status could not be saved. Attribution is paused; refresh before retrying.'};
 return new IntegrationError(messages[stage],503);
}
export type ExistingClick={source_key:string;clicked_at:string;gclid:string|null;session_id:string|null;channel?:string};
export function eventKey(sheet:string,values:Record<string,string>){
 const legacy=Object.fromEntries(Object.entries(values).filter(([key])=>key!=='channel'));
 return sheet+':'+(values.event_id||createHash('sha256').update(JSON.stringify(legacy)).digest('hex'));
}
export function clickImportRows(sheet:string,values:Record<string,string>[],existing:ExistingClick[]){
 const known=new Map(existing.map(c=>[c.source_key,c])),rows=new Map<string,ExistingClick&{campaign:string|null;page_url:string|null;channel?:string}>();
 const channels=new Map<string,Set<string>>();
 for(const v of values){if(v.channel){const base=eventKey(sheet,v);if(!channels.has(base))channels.set(base,new Set());channels.get(base)!.add(v.channel);}}
 for(const v of values){
  const base=eventKey(sheet,v),old=known.get(base);
  let key=v.event_id?base+':'+createHash('sha256').update(JSON.stringify([v.timestamp,v.gclid||'',v.session_id||''])).digest('hex'):base;
  // Some sheets reuse an ID/GCLID for repeated clicks. Never silently discard a later timestamp.
  const same=old&&Date.parse(old.clicked_at)===Date.parse(v.timestamp)&&(old.gclid||'')===(v.gclid||'')&&(old.session_id||'')===(v.session_id||'');
  if(!v.event_id&&v.channel){
   // Sheets displays whole seconds: distinct call and WhatsApp clicks may share every other field.
   key=base+':'+v.channel;
   if(same&&old.channel===v.channel)key=base;
   else if(same&&!old.channel){
    if((channels.get(base)?.size||0)>1)throw new IntegrationError('An existing unlabelled click has both call and WhatsApp rows at the same time. Review its channel before importing; the saved click was not changed.',409);
    key=base;
   }
  }else if(same)key=base;
  const row={source_key:key,clicked_at:v.timestamp,gclid:v.gclid||null,session_id:v.session_id||null,campaign:v.campaign||null,page_url:v.page_url||null};
  const channel=v.channel||rows.get(key)?.channel;
  if(channel&&rows.get(key)?.channel&&channel!==rows.get(key)!.channel)throw new IntegrationError('Website event has conflicting call and WhatsApp labels. The same event ID, timestamp, GCLID and session are labelled as both call and WhatsApp. Give each distinct click a unique event ID, then import again.',422);
  rows.set(key,{...row,...(channel?{channel}:{})});
 }
 return [...rows.values()];
}
