import {IntegrationError} from '../integration-error';
export type InventoryDiagnostic={code:'connection'|'missing_table'|'missing_column'|'access_denied'|'timeout'|'invalid_data'|'unknown'|'source_limit'|'source_changed'|'duplicate_identity'|'orphan_lots'|'snapshot_limit'|'invalid_configuration';table:string|null;action:string};
export class InventorySourceError extends IntegrationError{
 constructor(public readonly diagnostic:InventoryDiagnostic){super(diagnostic.action,503);}
}
const allowedTables=new Set(['InventoryProduct','InventoryLot','DeviceModel']);
export function inventoryDiagnostic(code:unknown,table:unknown=null,timedOut=false):InventoryDiagnostic{
 const safeTable=typeof table==='string'&&allowedTables.has(table)?table:null;
 if(timedOut)return {code:'timeout',table:safeTable,action:'The inventory read exceeded its deadline. Check the stock project availability and retry.'};
 if(code==='PGRST205'||code==='42P01')return {code:'missing_table',table:safeTable,action:`The expected ${safeTable??'inventory'} table is not exposed by the saved project. Verify the live schema and Data API exposure.`};
 if(code==='42703'||code==='PGRST204')return {code:'missing_column',table:safeTable,action:`The expected fields in ${safeTable??'inventory'} do not match the live schema. Review the adapter against the deployed stock application.`};
 if(code==='42501'||code==='PGRST301'||code==='PGRST302')return {code:'access_denied',table:safeTable,action:'The saved server connection cannot read the stock tables. Verify its project, server credential and read permissions without exposing the key.'};
 return {code:'unknown',table:safeTable,action:'Inventory could not be verified. Review the saved CRM connection, source schema and server read permissions.'};
}
export function safeInventoryFailure(error:unknown):InventoryDiagnostic{
 if(error instanceof InventorySourceError)return error.diagnostic;
 const message=error instanceof Error?error.message:'';
 if(message==='Snapshot size limit.')return {code:'snapshot_limit',table:null,action:'The received-stock snapshot exceeds the 6 MB storage limit. No partial snapshot was stored.'};
 if(message==='Invalid inventory configuration.')return {code:'invalid_configuration',table:null,action:'The inventory project or monitoring configuration is invalid. Verify the server adapter configuration.'};
 if(message.startsWith('Duplicate inventory identities;'))return {code:'duplicate_identity',table:null,action:'Duplicate inventory identities were found. No stock quantities were combined.'};
 if(message.startsWith('Inventory changed during collection or contains orphan lots.'))return {code:'orphan_lots',table:'InventoryLot',action:'Lots reference products outside the complete read. Retry and verify source permissions.'};
 if(message==='Stock read is stale.'||message==='Incomplete or inconsistent stock source.')return {code:'source_changed',table:null,action:'Stock evidence changed or expired during collection. Retry a complete read.'};
 return inventoryDiagnostic(null);
}
