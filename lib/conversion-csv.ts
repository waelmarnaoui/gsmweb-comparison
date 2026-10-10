import {createHash} from 'node:crypto';
import {stringify} from 'csv-stringify/sync';
import {parse} from 'csv-parse/sync';
import {formatRomanianTimestamp} from './timestamps';
import {safePhone} from './crm-comparison';

type ExportRow={ready:boolean;gclid:string;phone:string;conversionTime:string;amount:number;paymentId:string;gbraid?:string;wbraid?:string;paymentAmount?:number;chargedAmount?:number|null;allocatedCost?:number|null;timeBasis?:string};
// Keep this schema stable after configuring the Data Manager field mapping.
export const GOOGLE_ADS_CSV_HEADERS=['Google Click ID','Phone Number','Conversion Name','Conversion Time','Conversion Value','Conversion Currency','GBRAID','WBRAID','Order ID'] as const;
export function googleAdsCsv(records:string[][]){
 if(!records.length)throw new Error('No verified conversions are ready in the selected date range.');
 if(records.some(row=>row.length!==GOOGLE_ADS_CSV_HEADERS.length||row.some(value=>typeof value!=='string'||/[\r\n\u0000]/.test(value))||!row.at(-1)))throw new Error('Invalid Google Ads CSV record');
 const csv=stringify([GOOGLE_ADS_CSV_HEADERS,...records],{quoted:true,quoted_empty:true,record_delimiter:'\r\n'});
 const decoded=parse(csv,{relax_column_count:false,skip_empty_lines:false}) as string[][];
 if(decoded.length!==records.length+1||decoded.some(row=>row.length!==GOOGLE_ADS_CSV_HEADERS.length))throw new Error('Google Ads CSV validation failed');
 return csv;
}
export function conversionCsv(items:ExportRow[],name:string){
 const seen=new Set<string>();
 const rows:string[][]=[];
 for(const c of items){
  if(!c.ready)continue;
  const phone=safePhone(c.phone);
  if(!name.trim()||!c.paymentId||seen.has(c.paymentId)||(!c.gclid&&!phone)||!Number.isFinite(c.amount)||c.amount<=0)throw new Error('Invalid or duplicate conversion export');
  seen.add(c.paymentId);
  const braid=(value:string|undefined)=>c.gclid&&value&&/^[A-Za-z0-9_-]{1,512}$/.test(value)?value:'';
  rows.push([c.gclid,phone?createHash('sha256').update(phone).digest('hex'):'',name,formatRomanianTimestamp(c.conversionTime),c.amount.toFixed(2),'RON',braid(c.gbraid),braid(c.wbraid),c.paymentId]);
 }
 // Data Manager: headers first, with Europe/Bucharest selected in the import mapping.
 return googleAdsCsv(rows);
}
