import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePaymentAttribution,type PaymentCandidate} from '../lib/payment-attribution';
const c:PaymentCandidate={matchId:'m',callAt:'2026-10-09T13:00:00Z',clientId:'client',paymentId:'p',amount:120.5,paidDate:'2026-10-10',visitAt:'2026-10-10T12:00:00Z',gclid:'g',conversionTime:'2026-10-09T12:59:00Z'};
const now=Date.parse('2026-10-11T12:00:00Z');
test('phone-only requires explicit mode and a saved first match time, never a fabricated click ID',()=>{const phone={...c,gclid:'',conversionTime:'2026-10-10T12:30:00Z'};assert.equal(preparePaymentAttribution([phone],'project',now).length,0);const rows=preparePaymentAttribution([phone],'project',now,true);assert.equal(rows.length,1);assert.equal(rows[0].gclid,'');assert.equal(rows[0].paid_at,'2026-10-10T12:30:00.000Z');assert.equal(preparePaymentAttribution([phone,{...phone,matchId:'tie'}],'project',now,true).length,0);assert.equal(preparePaymentAttribution([{...phone,conversionTime:''}],'project',now,true).length,0);});
test('uses latest confirmed call and the exact saved website click time',()=>{const rows=preparePaymentAttribution([c,{...c,matchId:'old',callAt:'2026-10-08T12:00:00Z',conversionTime:'2026-10-08T11:59:00Z'}],'project',now);assert.equal(rows.length,1);assert.equal(rows[0].match_id,'m');assert.equal(rows[0].paid_at,'2026-10-09T12:59:00.000Z');assert.equal(rows[0].payment_transaction_id,'project:p');});
test('excludes old visits, visits before call, ties and future payment dates',()=>{assert.equal(preparePaymentAttribution([{...c,visitAt:'2026-10-24T13:00:01Z'}],'p',now).length,0);assert.equal(preparePaymentAttribution([{...c,visitAt:'2026-10-08T13:00:00Z'}],'p',now).length,0);assert.equal(preparePaymentAttribution([c,{...c,matchId:'other'}],'p',now).length,0);assert.equal(preparePaymentAttribution([c],'p',Date.parse('2026-10-10T10:00:00Z')).length,0);});
test('today is eligible immediately after the actual visit and payment are recorded',()=>{
 assert.equal(preparePaymentAttribution([c],'project',Date.parse('2026-10-10T12:05:00Z')).length,1);
 assert.equal(preparePaymentAttribution([{...c,paidDate:'2026-10-11'}],'project',Date.parse('2026-10-10T12:05:00Z')).length,0);
 assert.equal(preparePaymentAttribution([{...c,paidDate:'2026-10-08'}],'project',now).length,0);
 assert.equal(preparePaymentAttribution([{...c,conversionTime:'2026-10-09T13:01:00Z'}],'project',now).length,0);
});

