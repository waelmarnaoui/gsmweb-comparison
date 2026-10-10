import test from 'node:test';
import assert from 'node:assert/strict';
import {allocatePaymentCosts} from '../lib/payment-profit';
import {compareCrmCall,type CrmData} from '../lib/crm-comparison';
const call={id:'call',phone:'+40712345678',started_at:'2026-10-10T06:00:00Z'};
const data:CrmData={customers:[{id:'client',phone:call.phone,name:'Test Client',firstVisit:'2026-10-10',lastVisit:'2026-10-10'}],repairs:[{id:'repair',clientId:'client',repairCode:'R',phoneModel:'Phone',entryDate:'2026-10-10T07:00:00Z',status:'DELIVERED',customerPrice:'450.00',repairCost:'150.00'}],repairSettlements:[{id:'settlement',repairId:'repair'}],sales:[],saleSettlements:[],payments:[{id:'cash',repairSettlementId:'settlement',saleSettlementId:null,amount:'450.00',paidDate:'2026-10-10',paymentMethod:'CASH',active:true}]};
test('actual 450 payment minus 150 repair cost produces 300 gross profit',()=>{
 const row=compareCrmCall(call,data);assert.equal(row.recordedTotal,450);assert.equal(row.payments[0].profit,300);assert.equal(row.payments[0].chargedAmount,450);assert.equal(row.payments[0].allocatedCost,150);
});
test('split cash/card allocates cost once and ignores inactive transactions',()=>{
 const p=data.payments[0],row=compareCrmCall(call,{...data,payments:[{...p,amount:'150.00'},{...p,id:'card',paymentMethod:'CARD',amount:'300.00'},{...p,id:'inactive',amount:'900.00',active:false}]});
 assert.equal(row.payments.reduce((n,p)=>n+p.profit!,0),300);assert.equal(row.payments.reduce((n,p)=>n+p.allocatedCost!,0),150);
 assert.equal(row.payments[0].profit,100);assert.equal(row.payments[1].profit,200);
});
test('partial payments never fabricate full invoice revenue and missing costs are unknown',()=>{
 const row=compareCrmCall(call,{...data,payments:[{...data.payments[0],amount:'100.00'}]});assert.equal(row.recordedTotal,100);assert.equal(row.payments[0].profit,-50);
 const missing=compareCrmCall(call,{...data,repairs:[{...data.repairs[0],repairCost:undefined}]});assert.equal(missing.payments[0].profit,null);
});
test('accessory quantity multiplies product cost and customer charge',()=>{
 const row=compareCrmCall(call,{...data,repairs:[],repairSettlements:[],sales:[{id:'sale',clientId:'client',productName:'Case',saleDate:'2026-10-10T07:00:00Z',quantity:3,salePrice:'50.00',productCost:'20.00'}],saleSettlements:[{id:'ss',saleId:'sale'}],payments:[{...data.payments[0],repairSettlementId:null,saleSettlementId:'ss',amount:'150.00'}]});
 assert.equal(row.payments[0].profit,90);assert.equal(row.payments[0].chargedAmount,150);assert.equal(row.payments[0].allocatedCost,60);
});
test('cost-cent rounding is exact and independent of input order',()=>{
 const payments=[{id:'b',amount:1},{id:'a',amount:1},{id:'c',amount:1}],a=allocatePaymentCosts(payments,0.01),b=allocatePaymentCosts([...payments].reverse(),0.01);
 assert.equal([...a.values()].reduce((n,p)=>n+Math.round(p.allocatedCost*100),0),1);for(const [id,value] of a)assert.deepEqual(value,b.get(id));assert.equal(a.get('a')!.allocatedCost,0.01);
});

