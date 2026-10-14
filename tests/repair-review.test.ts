import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewRepairContacts} from '../lib/repair-review';
const now=Date.parse('2026-10-14T12:00:00Z'),call={id:'whatsapp',phone:'+40723358266',started_at:'2026-10-12T11:26:00Z',direction:'incoming'};
const repair={id:'one',clientId:'client',phone:'0723 358 266',entryDate:'2026-10-12T12:00:00Z',price:450,cost:150,customerRecords:1};
test('both repairs survive review and use the same global first contact without payments',()=>{
 const result=reviewRepairContacts([repair,{...repair,id:'two',cost:500}],[call],now);
 assert.equal(result.length,2);assert.ok(result.every(row=>row.matchingReason===''&&row.contactId==='whatsapp'));
});
test('every excluded repair has an explicit reason; earlier history is not reset by the date range',()=>{
 assert.match(reviewRepairContacts([repair],[],now)[0].matchingReason,/No recorded/);
 assert.match(reviewRepairContacts([{...repair,customerRecords:2}],[call],now)[0].matchingReason,/Multiple CRM/);
 assert.match(reviewRepairContacts([{...repair,price:null}],[call],now)[0].matchingReason,/price or repair cost/);
 assert.match(reviewRepairContacts([{...repair,entryDate:'2026-10-12T11:00:00Z'}],[call],now)[0].matchingReason,/before/);
 assert.match(reviewRepairContacts([repair],[{...call,id:'earlier',started_at:'2026-09-25T10:00:00Z'},call],now)[0].matchingReason,/14 days/);
 assert.match(reviewRepairContacts([repair],[{...call,direction:'outgoing'}],now)[0].matchingReason,/Only outgoing/);
});
