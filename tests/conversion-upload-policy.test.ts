import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bucharestToday,websiteLinkedConversion} from '../lib/conversion-upload-policy';
test('today follows Bucharest calendar boundaries, including winter offset',()=>{
 assert.equal(bucharestToday(new Date('2026-10-21T21:30:00Z')),'2026-10-22');
 assert.equal(bucharestToday(new Date('2026-10-25T22:30:00Z')),'2026-10-26');
});
test('a phone or WhatsApp identity never replaces a website click match',()=>{
 assert.equal(websiteLinkedConversion({timeBasis:'website_click'}),true);
 for(const timeBasis of [undefined,'first_crm_match','first_paid_match'])assert.equal(websiteLinkedConversion({timeBasis}),false);
});
