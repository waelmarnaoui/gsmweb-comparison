import {createHash} from 'node:crypto';
import {formatRomanianTimestamp} from './timestamps';
import {safePhone} from './crm-comparison';

type ExportRow={ready:boolean;gclid:string;phone:string;conversionTime:string;amount:number;paymentId:string};
export function conversionCsv(items:ExportRow[],name:string){
 const seen=new Set<string>();
 const rows=[['Google Click ID','Phone Number','Conversion Name','Conversion Time','Conversion Value','Conversion Currency','Order ID']];
 for(const c of items){
  if(!c.ready)continue;
  const phone=safePhone(c.phone);
  if(!name.trim()||!c.paymentId||seen.has(c.paymentId)||(!c.gclid&&!phone)||!Number.isFinite(c.amount)||c.amount<=0)throw new Error('Invalid or duplicate conversion export');
  seen.add(c.paymentId);
  rows.push([c.gclid,phone?createHash('sha256').update(phone).digest('hex'):'',name,formatRomanianTimestamp(c.conversionTime),c.amount.toFixed(2),'RON',c.paymentId]);
 }
 if(rows.length===1)throw new Error('No verified conversions are ready in the selected date range.');
 // Data Manager: headers first, with Europe/Bucharest selected in the import mapping.
 return rows.map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');
}

