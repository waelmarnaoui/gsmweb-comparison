import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {conversionCsv,googleAdsCsv,GOOGLE_ADS_CSV_HEADERS} from '../lib/conversion-csv';
const c={ready:true,gclid:'click',phone:'0733919087',conversionTime:'2026-09-24T15:05:24Z',amount:120,paymentId:'crm:p'};
test('combined file supports clicks and phone-only rows with exact Romanian timestamp',()=>{
 const csv=conversionCsv([c,{...c,gclid:'',paymentId:'crm:p2'}],'GSMWeb CRM');
 assert.ok(csv.startsWith('"Google Click ID","Phone Number"'));
 assert.ok(csv.includes('2026-09-24 18:05:24'));
 assert.ok(csv.includes(createHash('sha256').update('+40733919087').digest('hex')));
 assert.ok(!csv.includes('0733919087'));
 assert.equal(parse(csv).length,3);
});
test('combined export rejects duplicate payments and excludes blocked rows',()=>{
 assert.throws(()=>conversionCsv([c,c],'GSMWeb CRM'));
 assert.equal(parse(conversionCsv([c,{...c,ready:false}],'GSMWeb CRM')).length,2);
});
test('Google conversion value is profit; bookkeeping does not enter the import schema',()=>{
 const csv=conversionCsv([{...c,amount:300,paymentAmount:450,allocatedCost:150,chargedAmount:450,timeBasis:'website_click'}],'Verified Payments');
 const [headers,cells]=parse(csv);
 assert.deepEqual(headers,GOOGLE_ADS_CSV_HEADERS);
 assert.equal(cells[4],'300.00');assert.equal(cells[8],'crm:p');
 assert.ok(!headers.includes('Recorded Payment'));
});
test('mixed click and phone rows keep nine fields including empty braid cells',()=>{
 const csv=conversionCsv([c,{...c,gclid:'',paymentId:'crm:p2'},{...c,gbraid:'braid',wbraid:'web-braid',paymentId:'crm:p3'}],'GSMWeb CRM');
 const rows=parse(csv);
 assert.ok(csv.endsWith('\r\n'));
 assert.equal(rows.length,4);
 assert.ok(rows.every((row:string[])=>row.length===9&&row[8]));
 assert.equal(rows[2][0],'');assert.equal(rows[2][6],'');assert.equal(rows[2][7],'');
 assert.equal(rows[3][6],'braid');assert.equal(rows[3][7],'web-braid');
});
test('commas and quotes round-trip through the CSV parser',()=>{
 const name='GSMWeb, "Reparatii" Bucuresti';
 const rows=parse(conversionCsv([{...c,paymentId:'crm:p,"quoted"'}],name));
 assert.equal(rows[1][2],name);assert.equal(rows[1][8],'crm:p,"quoted"');
 assert.equal(rows[1].length,9);
});
test('malformed widths, multiline fields, empty batches and missing IDs fail closed',()=>{
 assert.throws(()=>googleAdsCsv([['short']]));
 assert.throws(()=>googleAdsCsv([Array(9).fill('')]));
 assert.throws(()=>conversionCsv([c],'GSMWeb\nextra row'));
 assert.throws(()=>conversionCsv([],'GSMWeb'));
 assert.throws(()=>conversionCsv([{...c,ready:false}],'GSMWeb'));
});
