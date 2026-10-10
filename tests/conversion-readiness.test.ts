import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversionBlocker,type Draft} from '../lib/conversion-readiness';
const draft:Draft={id:'d',match_id:'m',payment_transaction_id:'p',amount:'120.50',currency:'RON',paid_at:'2026-10-09T16:00:00Z',gclid:'g',status:'prepared'};
const click={gclid:'g',clicked_at:'2026-10-09T15:00:00Z'},payment={id:'p',amount:120.5,paidDate:'2026-10-09'},now=Date.parse('2026-10-10T10:00:00Z');
test('prepared conversion needs matching active payment and click',()=>assert.equal(conversionBlocker(draft,click,payment,'Repair paid',now),''));
test('blocks missing payment and changed amount',()=>{assert.match(conversionBlocker(draft,click,undefined,'Paid',now),/payment not found/);assert.match(conversionBlocker(draft,click,{...payment,amount:1},'Paid',now),/changed/);});
test('blocks missing name, mismatched GCLID and future or old timestamps',()=>{assert.match(conversionBlocker(draft,click,payment,'',now),/name/);assert.match(conversionBlocker(draft,{...click,gclid:'other'},payment,'Paid',now),/GCLID/);assert.match(conversionBlocker({...draft,paid_at:'2027-01-01T16:00:00Z'},click,payment,'Paid',now),/time/);assert.match(conversionBlocker(draft,click,payment,'Paid',now+100*86400000),/90-day/);});

