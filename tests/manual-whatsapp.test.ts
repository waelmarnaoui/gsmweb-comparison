import {test} from 'node:test';
import assert from 'node:assert/strict';
import {manualWhatsAppInput,clickChannel} from '../lib/manual-whatsapp';
import {parseClickRows} from '../lib/sheet-parser';
const now=Date.parse('2026-10-12T12:00:00Z');
test('21 and 22 October are accepted with current server time, while future messages remain rejected',()=>{
 const current=Date.parse('2026-10-22T16:00:00Z');
 for(const date of ['2026-10-21','2026-10-22'])assert.equal(manualWhatsAppInput({phone:'+447911123456',date,time:'09:42'},current).startedAt,date+'T06:42:00.000Z');
 assert.throws(()=>manualWhatsAppInput({phone:'+447911123456',date:'2026-10-23',time:'09:42'},current),/future/);
});
test('manual message normalizes phone and Bucharest minute',()=>{
 assert.deepEqual(manualWhatsAppInput({phone:'0722882726',date:'2026-10-10',time:'09:42'},now),{phone:'+40722882726',startedAt:'2026-10-10T06:42:00.000Z',precision:'minute'});
});
test('manual message accepts international phone and exact seconds',()=>{
 assert.equal(manualWhatsAppInput({phone:'+447911123456',date:'2026-10-10',time:'09:42:16'},now).phone,'+447911123456');
 assert.equal(manualWhatsAppInput({phone:'+40722882726',date:'2026-10-10',time:'09:42:16'},now).precision,'second');
});
test('manual entry rejects future, old, invalid dates and malformed input',()=>{
 for(const input of [null,{phone:'abc',date:'2026-10-10',time:'09:42'},{phone:'+40722882726',date:'2026-10-13',time:'09:42'},{phone:'+40722882726',date:'2026-09-23',time:'09:42'},{phone:'+40722882726',date:'2026-02-30',time:'09:42'}])assert.throws(()=>manualWhatsAppInput(input,now));
});
test('only explicit channel labels identify WhatsApp clicks',()=>{
 assert.equal(clickChannel('WhatsApp click'),'whatsapp');assert.equal(clickChannel('Call'),'call');assert.equal(clickChannel('https://gsmweb.site/whatsapp'),'unknown');
 const rows=parseClickRows([['timestamp','event_type'],['2026-10-10 09:41:10','whatsapp'],['2026-10-10 09:41:12','call'],['2026-10-10 09:41:14','unknown']]);
 assert.equal(rows[0].channel,'whatsapp');assert.equal(rows[1].channel,'call');assert.equal(rows[2].channel,undefined);
});
