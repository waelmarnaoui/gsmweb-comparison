export type ClickSyncState={sheet_id:string;synced_at:string;action:string}|null;
export function clickSyncReason(state:ClickSyncState,sheetId:string,now=Date.now()){
 if(!state||state.sheet_id!==sheetId)return 'Website clicks have not been successfully refreshed for the selected spreadsheet';
 if(state.action!=='SYNC_SUCCESS')return 'The latest website click import failed; refresh the source before exporting';
 const age=now-Date.parse(state.synced_at);
 if(!Number.isFinite(age)||age<0||age>30*60000)return 'Website click data is older than 30 minutes; refresh the source before exporting';
 return '';
}
