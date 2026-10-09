import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseClickRows} from '../lib/sheet-parser';
test('maps headers and preserves explicit timestamp offsets',()=>{
 const rows=parseClickRows([['Event ID','Timestamp','GCLID'],['a','2026-10-10T12:00:00+03:00','g']]);
 assert.equal(rows[0].event_id,'a');assert.equal(rows[0].timestamp,'2026-10-10T09:00:00.000Z');assert.equal(rows[0].gclid,'g');
});
test('does not guess ambiguous local timestamps',()=>assert.throws(()=>parseClickRows([['timestamp'],['10/10/2026 12:00:00']]),/timezone/));
test('requires timestamp header and ignores blank rows',()=>{
 assert.throws(()=>parseClickRows([['gclid'],['g']]),/timestamp/);
 assert.deepEqual(parseClickRows([['timestamp'],['']]),[]);
});
