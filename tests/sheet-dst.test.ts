import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseClickRows,SheetTimeResolutionRequired} from '../lib/sheet-parser';
import {sheetTimeKey} from '../lib/sheet-time-resolution';
import {formatRomanianTimestamp} from '../lib/timestamps';
test('summer and winter website times automatically use the correct offset',()=>{
 const values=parseClickRows([['timestamp'],['2026-10-24 12:00:00'],['2026-10-26 12:00:00']]);
 assert.equal(values[0].timestamp,'2026-10-24T09:00:00.000Z');assert.equal(values[1].timestamp,'2026-10-26T10:00:00.000Z');
 assert.equal(formatRomanianTimestamp(values[1].timestamp),'2026-10-26 12:00:00');
});
test('repeated hour reports exact rows and both instants, never returns a partial import',()=>{
 const rows=[['timestamp','channel'],['2026-10-26 10:00:00','call'],['25/10/2026 03:30:00','whatsapp']];
 assert.throws(()=>parseClickRows(rows),(error:unknown)=>{
  assert.ok(error instanceof SheetTimeResolutionRequired);assert.equal(error.issues[0].row,3);
  assert.deepEqual(error.issues[0].candidates,['2026-10-25T01:30:00.000Z','2026-10-25T00:30:00.000Z']);return true;
 });
 const key=sheetTimeKey(rows[0],rows[2]);
 for(const timestamp of ['2026-10-25T01:30:00.000Z','2026-10-25T00:30:00.000Z']){
  const values=parseClickRows(rows,{[key]:timestamp});assert.equal(values[1].timestamp,timestamp);assert.equal(values[1].channel,'whatsapp');assert.equal(values[0].channel,'call');
 }
 assert.throws(()=>parseClickRows(rows,{[key]:'2026-10-25T02:30:00.000Z'}),SheetTimeResolutionRequired);
 const changed=[...rows];changed[2]=['25/10/2026 03:31:00','whatsapp'];assert.throws(()=>parseClickRows(changed,{[key]:'2026-10-25T01:30:00.000Z'}),SheetTimeResolutionRequired);
});
test('UTC evidence and row offsets resolve the repeated hour without changing click identity fields',()=>{
 const headers=['timestamp','utc_offset','timestamp_utc','gclid'];
 const winter=parseClickRows([headers,['2026-10-25 03:30:00','+02:00','','ad']])[0];
 assert.equal(winter.timestamp,'2026-10-25T01:30:00.000Z');assert.equal(winter.gclid,'ad');assert.ok(!('utc_offset' in winter));
 assert.equal(parseClickRows([headers,['25/10/2026 03:30:00','','2026-10-25T00:30:00Z','ad']])[0].timestamp,'2026-10-25T00:30:00.000Z');
 assert.throws(()=>parseClickRows([headers,['2026-10-25 03:30:00','+02:00','2026-10-25T00:30:00Z','ad']]),/conflict/);
 assert.throws(()=>parseClickRows([headers,['2026-10-26 12:00:00','+03:00','','ad']]),/conflict/);
 assert.throws(()=>parseClickRows([headers,['2026-03-29 03:30:00','','','ad']]),/does not exist/);
});
