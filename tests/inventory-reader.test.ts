import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReceivedInventory,type InventoryPageReader} from '../lib/ai-ads/inventory-reader';
const lots=[{id:'lot1',productId:'part2',quantityAvailable:3},{id:'lot2',productId:'part1',quantityAvailable:0}];
const products=[{id:'part1',modelId:'m1'},{id:'part2',modelId:'m2'},{id:'unreceived-catalog-template',modelId:'m3'}];
const models=[{id:'m1'},{id:'m2'},{id:'m3'}];
test('receipt-first reader follows short capped pages and does not scan the unreceived catalogue',async()=>{
 const calls:{table:string;ids?:string[]}[]=[];
 const reader:InventoryPageReader=async(table,_columns,offset,ids)=>{
  calls.push({table,ids});let rows=table==='InventoryLot'?lots:table==='InventoryProduct'?products:models;
  if(ids)rows=rows.filter(row=>ids.includes(row.id));
  return {rows:rows.slice(offset,offset+1),total:rows.length}; // Simulate a server cap below requested 500.
 };
 const result=await readReceivedInventory(reader);assert.equal(result.lots.length,2);assert.equal(result.lots[1].quantityAvailable,0);assert.equal(result.products.length,2);assert.equal(result.models.length,2);assert.ok(!result.products.some(row=>row.id==='unreceived-catalog-template'));assert.ok(calls.filter(call=>call.table==='InventoryProduct').every(call=>call.ids?.length===2));
});
test('empty receipts do not trigger full product/model catalogue reads',async()=>{
 let calls=0;const result=await readReceivedInventory(async(table)=>{calls++;assert.equal(table,'InventoryLot');return {rows:[],total:0};});assert.equal(calls,1);assert.equal(result.products.length,0);assert.equal(result.scope,'received_stock_including_depleted_lots');
});
test('missing counts, pagination gaps and changing counts fail closed',async()=>{
 await assert.rejects(readReceivedInventory(async()=>({rows:lots,total:null})),error=>error instanceof Error&&error.message.includes('count'));
 await assert.rejects(readReceivedInventory(async()=>({rows:[],total:2})),error=>error instanceof Error&&error.message.includes('inconsistent'));
 let page=0;await assert.rejects(readReceivedInventory(async()=>({rows:[lots[page++%2]],total:page===1?2:3})),error=>error instanceof Error&&error.message.includes('changed'));
});
test('unreadable referenced products and duplicate page rows are rejected',async()=>{
 await assert.rejects(readReceivedInventory(async(table)=>table==='InventoryLot'?{rows:lots,total:2}:{rows:[],total:0}),/Not all received-stock products/);
 await assert.rejects(readReceivedInventory(async()=>({rows:[lots[0],lots[0]],total:2})),/Duplicate/);
});
