import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inventoryDiagnostic,safeInventoryFailure,InventorySourceError} from '../lib/ai-ads/source-diagnostic';
test('inventory diagnostics distinguish schema, access and timeout without raw provider messages',()=>{
 assert.equal(inventoryDiagnostic('PGRST205','InventoryLot').code,'missing_table');assert.equal(inventoryDiagnostic('42703','InventoryProduct').code,'missing_column');assert.equal(inventoryDiagnostic('42501','InventoryLot').code,'access_denied');assert.equal(inventoryDiagnostic(null,'DeviceModel',true).code,'timeout');
 assert.equal(inventoryDiagnostic('PGRST205','private secret table').table,null);
 const diagnostic=safeInventoryFailure(new Error('private credential data'));assert.ok(!JSON.stringify(diagnostic).includes('private credential'));
 const known=inventoryDiagnostic('42703','InventoryLot');assert.deepEqual(safeInventoryFailure(new InventorySourceError(known)),known);
});
