import test from 'node:test';
import assert from 'node:assert/strict';
import {extractBraidIdentifiers} from '../lib/ad-click-identifiers';
import {conversionCsv} from '../lib/conversion-csv';
test('extracts exact braid values from saved matched click URLs',()=>{
 assert.deepEqual(extractBraidIdentifiers('https://gsmweb.site/?gad_source=1&gbraid=0AAAAbC-DeF&gclid=Click_1','Click_1'),{gbraid:'0AAAAbC-DeF',wbraid:''});
 assert.deepEqual(extractBraidIdentifiers('https://gsmweb.site/?wbraid=Wb_2&gclid=Click_1','Click_1'),{gbraid:'',wbraid:'Wb_2'});
});
test('rejects conflicting, malformed, missing and ambiguous identifiers',()=>{
 for(const url of [null,'invalid','javascript:alert(1)','https://gsmweb.site/?gclid=Other&gbraid=abc','https://gsmweb.site/?gclid=Click_1&gclid=Other&gbraid=abc','https://gsmweb.site/?gbraid=abc&gbraid=def','https://gsmweb.site/?gbraid=a%20b'])assert.deepEqual(extractBraidIdentifiers(url,'Click_1'),{gbraid:'',wbraid:''});
 assert.deepEqual(extractBraidIdentifiers('https://gsmweb.site/?gbraid=abc',''),{gbraid:'',wbraid:''});
});
test('exports braid columns only for click-linked conversions without changing timestamps',()=>{
 const base={ready:true,gclid:'Click_1',phone:'+40712345678',conversionTime:'2026-10-09T15:05:24Z',amount:450,paymentId:'crm:payment'};
 const csv=conversionCsv([{...base,gbraid:'Gb_1'},{...base,gclid:'',gbraid:'NotLinked',paymentId:'crm:phone'}],'Verified Payments');
 assert.ok(csv.split('\r\n')[0].endsWith('"GBRAID","WBRAID"'));
 assert.ok(csv.includes('"2026-10-09 18:05:24"'));
 assert.ok(csv.split('\r\n')[1].endsWith('"Gb_1",""'));
 assert.ok(csv.split('\r\n')[2].endsWith('"",""'));
 assert.ok(!csv.includes('NotLinked'));
});

