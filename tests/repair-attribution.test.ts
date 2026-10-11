import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeRepairs,repairProfit,crmVisitTime} from '../lib/repair-attribution';
import {reviewDay,isReviewDay} from '../lib/review-day';
const repair={id:'r1',clientId:'client',repairCode:'GSM1',phoneModel:'Phone',entryDate:'2026-10-11T10:00:00Z',status:'RECEIVED',customerPrice:'450.00',repairCost:'150.00'};
const candidate={callId:'missed',phone:'+40722882726',calledAt:'2026-10-10T06:42:16Z',clientId:'client',repair};
const now=Date.parse('2026-10-11T12:00:00Z');
test('repair eligibility does not need a payment or completed status and preserves signed profit',()=>{
 for(const status of ['RECEIVED','COMPLETED','DELIVERED','CANCELLED'])assert.equal(attributeRepairs([{...candidate,repair:{...repair,status}}],'crm',now)[0].profit,300);
 assert.equal(repairProfit({...repair,repairCost:500}),-50);
 assert.equal(attributeRepairs([{...candidate,repair:{...repair,repairCost:500}}],'crm',now)[0].profit,-50);
 assert.equal(repairProfit({...repair,repairCost:450}),0);
 assert.equal(repairProfit({...repair,repairCost:undefined}),null);
 assert.equal(attributeRepairs([{...candidate,repair:{...repair,repairCost:undefined}}],'crm',now).length,0);
});
test('one stable conversion per repair and no attribution before call, after two weeks, or ambiguous client',()=>{
 assert.equal(attributeRepairs([candidate,candidate],'crm',now).length,1);
 assert.equal(attributeRepairs([candidate],'crm',now)[0].id,'crm:repair:r1');
 assert.equal(attributeRepairs([{...candidate,calledAt:'2026-09-24T10:00:00Z'}],'crm',now).length,0);
 assert.equal(attributeRepairs([{...candidate,calledAt:'2026-10-11T11:00:00Z'}],'crm',now).length,0);
 assert.equal(attributeRepairs([{...candidate,phone:'unknown'}],'crm',now).length,0);
 assert.equal(attributeRepairs([candidate,{...candidate,clientId:'other',callId:'other'}],'crm',now).length,0);
 assert.equal(attributeRepairs([candidate,{...candidate,callId:'other'}],'crm',now).length,0);
 assert.equal(attributeRepairs([{...candidate,phone:'+447911123456'}],'crm',now).length,1);
});
test('daily review uses Bucharest dates including daylight-saving boundaries',()=>{
 assert.equal(crmVisitTime('2026-10-11T10:00:00'),Date.parse('2026-10-11T10:00:00Z'));
 assert.equal(crmVisitTime('2026-10-11T10:00:00+03:00'),Date.parse('2026-10-11T07:00:00Z'));
 assert.equal(reviewDay('2026-10-11').start,'2026-10-10T21:00:00.000Z');
 assert.equal(isReviewDay('2026-10-10T21:30:00Z','2026-10-11'),true);
 assert.equal(isReviewDay('2026-10-11T22:00:00Z','2026-10-11'),false);
 assert.equal(reviewDay('2026-10-25').end,'2026-10-25T21:59:59.999Z');
 assert.throws(()=>reviewDay('2026-02-30'));
});
