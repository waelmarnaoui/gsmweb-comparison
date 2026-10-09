import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareCrmCall,type CrmData} from '../lib/crm-comparison';
const call={id:'call',phone:'+40722123456',started_at:'2026-10-09T15:00:00Z'};
const data:CrmData={customers:[{id:'c',name:'Client',phone:'0722 123 456',firstVisit:'2025-01-01',lastVisit:'2026-10-09'}],repairs:[{id:'r',clientId:'c',repairCode:'R1',phoneModel:'Phone',entryDate:'2026-10-09',status:'DELIVERED'}],sales:[],repairSettlements:[{id:'s',repairId:'r'}],saleSettlements:[],payments:[{id:'p',repairSettlementId:'s',saleSettlementId:null,amount:'120.50',paidDate:'2026-10-09',paymentMethod:'CASH',active:true}]};
test('links normalized phone through repair settlement to real payment',()=>{const row=compareCrmCall(call,data);assert.equal(row.status,'found');assert.equal(row.recordedTotal,120.5);assert.equal(row.customer?.id,'c');});
test('excludes inactive, duplicate, unrelated and invalid parent payments',()=>{const p=data.payments[0];const row=compareCrmCall(call,{...data,payments:[p,p,{...p,id:'inactive',active:false},{...p,id:'other',repairSettlementId:'other'},{...p,id:'invalid',saleSettlementId:'sale'}]});assert.equal(row.recordedTotal,120.5);});
test('does not select between normalized duplicate clients',()=>{const row=compareCrmCall(call,{...data,customers:[...data.customers,{...data.customers[0],id:'duplicate',phone:'0040722123456'}]});assert.equal(row.status,'ambiguous');assert.equal(row.recordedTotal,0);});
test('does not associate missing or invalid phone numbers',()=>{assert.equal(compareCrmCall({...call,phone:'private'},data).status,'not_found');});

