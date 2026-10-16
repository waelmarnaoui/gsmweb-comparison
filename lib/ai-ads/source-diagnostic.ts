import {IntegrationError} from '../integration-error';
export type InventoryDiagnostic={code:'connection'|'missing_table'|'missing_column'|'access_denied'|'timeout'|'invalid_data'|'unknown';table:string|null;action:string};
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
 return inventoryDiagnostic(null);
}
