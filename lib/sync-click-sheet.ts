import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readClickSheet,clickSheetSource} from './sheets';
import {eventKey,clickImportRows,clickImportFailure,type ClickImportStage,type ExistingClick} from './click-import';
import {parseClickRows} from './sheet-parser';
import {IntegrationError} from './integration-error';
import {clickSyncReason,type ClickSyncState} from './click-sync-state';

export async function readClickSyncState(client:SupabaseClient,sheetId:string){
 const {data,error}=await client.from('ga_sheet_sync_state').select('sheet_id,synced_at,action').eq('sheet_id',sheetId).maybeSingle();
 if(error)throw new IntegrationError('Website import status could not be verified.',503);
 return data as ClickSyncState;
}
export async function syncClickSheet(client:SupabaseClient,force=false){
 const source=await clickSheetSource();let received=0,inserted=0,stage:ClickImportStage='compare';
 let state:ClickSyncState;
 try{state=await readClickSyncState(client,source.id);}catch(error){throw clickImportFailure(error,stage);}
 if(!force&&!clickSyncReason(state,source.id)&&Date.now()-Date.parse(state!.synced_at)<60000)
  return {inserted:0,received:0,cached:true};
 try{
  stage='read';const sheetRows=await readClickSheet(source);
  stage='parse';const values=parseClickRows(sheetRows);received=values.length;
  stage='compare';
  const keys=[...new Set(values.map(v=>eventKey(source.id,v)))],existing:ExistingClick[]=[];
  for(let i=0;i<keys.length;i+=100){
   const {data,error}=await client.from('ga_clicks').select('source_key,clicked_at,gclid,session_id').in('source_key',keys.slice(i,i+100));
   if(error)throw new IntegrationError('Existing website clicks could not be read.',503);existing.push(...(data||[]));
  }
  const rows=clickImportRows(source.id,values,existing);
  stage='save';
  for(let i=0;i<rows.length;i+=200){
   const batch=rows.slice(i,i+200);
   const {data,error}=await client.from('ga_clicks').upsert(batch.map(({channel,...row})=>row),{onConflict:'source_key',ignoreDuplicates:true}).select('id');
   if(error)throw new IntegrationError('Website click import failed. Partial imports will be retried safely.',503);inserted+=data?.length||0;
   const typed=batch.filter(row=>row.channel);
   if(typed.length){
    const saved=await client.from('ga_clicks').select('id,source_key').in('source_key',typed.map(row=>row.source_key));
    if(saved.error||saved.data?.length!==typed.length)throw new IntegrationError('Website click channels could not be verified. Attribution is paused.',503);
    const {error}=await client.rpc('ga_record_click_channels',{p_items:saved.data.map(click=>({click_id:click.id,channel:typed.find(row=>row.source_key===click.source_key)!.channel}))});
    if(error)throw new IntegrationError('Install the approved WhatsApp setup to import labelled call/WhatsApp clicks. Attribution is paused.',503);
   }
  }
  stage='record';const {error}=await client.rpc('ga_record_click_sync',{p_sheet:source.id,p_received:received,p_inserted:inserted,p_success:true});
  if(error)throw new IntegrationError('Website import completed, but its status could not be recorded. Attribution is paused.',503);
  return {inserted,received,cached:false};
 }catch(error){
  // Recording a failure must never replace the original actionable import error.
  try{await client.rpc('ga_record_click_sync',{p_sheet:source.id,p_received:received,p_inserted:inserted,p_success:false});}catch{}
  throw clickImportFailure(error,stage);
 }
}
