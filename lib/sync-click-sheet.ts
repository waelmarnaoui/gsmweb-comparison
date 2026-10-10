import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {readClickSheet,clickSheetSource} from './sheets';
import {eventKey,clickImportRows,type ExistingClick} from './click-import';
import {parseClickRows} from './sheet-parser';
import {IntegrationError} from './integration-error';
import {clickSyncReason,type ClickSyncState} from './click-sync-state';

export async function readClickSyncState(client:SupabaseClient,sheetId:string){
 const {data,error}=await client.from('ga_sheet_sync_state').select('sheet_id,synced_at,action').eq('sheet_id',sheetId).maybeSingle();
 if(error)throw new IntegrationError('Website import status could not be verified.',503);
 return data as ClickSyncState;
}
export async function syncClickSheet(client:SupabaseClient,force=false){
 const source=await clickSheetSource();let received=0,inserted=0;
 const state=await readClickSyncState(client,source.id);
 if(!force&&!clickSyncReason(state,source.id)&&Date.now()-Date.parse(state!.synced_at)<60000)
  return {inserted:0,received:0,cached:true};
 try{
  const values=parseClickRows(await readClickSheet(source));received=values.length;
  const keys=[...new Set(values.map(v=>eventKey(source.id,v)))],existing:ExistingClick[]=[];
  for(let i=0;i<keys.length;i+=100){
   const {data,error}=await client.from('ga_clicks').select('source_key,clicked_at,gclid,session_id').in('source_key',keys.slice(i,i+100));
   if(error)throw new IntegrationError('Existing website clicks could not be read.',503);existing.push(...(data||[]));
  }
  const rows=clickImportRows(source.id,values,existing);
  for(let i=0;i<rows.length;i+=200){
   const {data,error}=await client.from('ga_clicks').upsert(rows.slice(i,i+200),{onConflict:'source_key',ignoreDuplicates:true}).select('id');
   if(error)throw new IntegrationError('Website click import failed. Partial imports will be retried safely.',503);inserted+=data?.length||0;
  }
  const {error}=await client.rpc('ga_record_click_sync',{p_sheet:source.id,p_received:received,p_inserted:inserted,p_success:true});
  if(error)throw new IntegrationError('Website import completed, but its status could not be recorded. Attribution is paused.',503);
  return {inserted,received,cached:false};
 }catch(error){
  await client.rpc('ga_record_click_sync',{p_sheet:source.id,p_received:received,p_inserted:inserted,p_success:false});
  throw error;
 }
}
