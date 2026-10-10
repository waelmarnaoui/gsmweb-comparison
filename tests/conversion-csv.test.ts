import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {conversionCsv} from '../lib/conversion-csv';
const c={ready:true,gclid:'click',phone:'0733919087',conversionTime:'2026-09-24T15:05:24Z',amount:120,paymentId:'crm:p'};
test('combined file supports clicks and phone-only rows with exact Romanian timestamp',()=>{
 const csv=conversionCsv([c,{...c,gclid:'',paymentId:'crm:p2'}],'GSMWeb CRM');
 assert.ok(csv.startsWith('"Google Click ID","Phone Number"'));
 assert.ok(csv.includes('2026-09-24 18:05:24'));
 assert.ok(csv.includes(createHash('sha256').update('+40733919087').digest('hex')));
 assert.ok(!csv.includes('0733919087'));
 assert.equal(csv.split('\r\n').length,3);
});
test('combined export rejects duplicate payments and excludes blocked rows',()=>{
 assert.throws(()=>conversionCsv([c,c],'GSMWeb CRM'));
 assert.equal(conversionCsv([c,{...c,ready:false}],'GSMWeb CRM').split('\r\n').length,2);
});
test('Google conversion value is profit and gross payment stays a separate bookkeeping column',()=>{
 const csv=conversionCsv([{...c,amount:300,paymentAmount:450,allocatedCost:150,chargedAmount:450,timeBasis:'website_click'}],'Verified Payments');
 const cells=csv.split('\r\n')[1].split(',').map(value=>value.slice(1,-1));
 assert.equal(cells[4],'300.00');assert.equal(cells[7],'450.00');assert.equal(cells[8],'150.00');assert.equal(cells[9],'450.00');assert.equal(cells[10],'website_click');
});

