import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePaymentAttribution,type PaymentCandidate} from '../lib/payment-attribution';
const c:PaymentCandidate={matchId:'m',callAt:'2026-10-09T13:00:00Z',clientId:'client',paymentId:'p',amount:120.5,paidDate:'2026-10-10',visitAt:'2026-10-10T12:00:00Z',gclid:'g'};
const now=Date.parse('2026-10-11T12:00:00Z');
test('uses latest confirmed call and Romanian end of payment day',()=>{const rows=preparePaymentAttribution([c,{...c,matchId:'old',callAt:'2026-10-08T12:00:00Z'}],'project',now);assert.equal(rows.length,1);assert.equal(rows[0].match_id,'m');assert.equal(rows[0].paid_at,'2026-10-10T20:59:59.000Z');assert.equal(rows[0].payment_transaction_id,'project:p');});
test('excludes old visits, visits before call, ties and future payment dates',()=>{assert.equal(preparePaymentAttribution([{...c,visitAt:'2026-10-24T13:00:01Z'}],'p',now).length,0);assert.equal(preparePaymentAttribution([{...c,visitAt:'2026-10-08T13:00:00Z'}],'p',now).length,0);assert.equal(preparePaymentAttribution([c,{...c,matchId:'other'}],'p',now).length,0);assert.equal(preparePaymentAttribution([c],'p',Date.parse('2026-10-10T10:00:00Z')).length,0);});

