import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clickImportRows} from '../lib/click-import';
import {parseTimestamp} from '../lib/timestamps';
const first={event_id:'reused-id',timestamp:parseTimestamp('10/10/2026 09:40:07'),gclid:'same-ad',session_id:''};
const second={...first,timestamp:parseTimestamp('10/10/2026 09:41:10')};
test('reused sheet identifiers preserve both click timestamps and remain idempotent',()=>{
 const rows=clickImportRows('sheet',[first,second,second],[]);
 assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.source_key)).size,2);
 assert.deepEqual(clickImportRows('sheet',[first,second],rows),rows);
 const legacy=[{source_key:'sheet:reused-id',clicked_at:first.timestamp,gclid:'same-ad',session_id:null}];
 const imported=clickImportRows('sheet',[first,second],legacy);
 assert.equal(imported[0].source_key,legacy[0].source_key);assert.equal(imported[1].source_key,rows[1].source_key);
});
test('overlapping imports choose the same canonical keys regardless of row order',()=>{
 const both=clickImportRows('sheet',[first,second],[]);
 assert.equal(clickImportRows('sheet',[first],[])[0].source_key,both[0].source_key);
 assert.equal(clickImportRows('sheet',[second],[])[0].source_key,both[1].source_key);
 assert.deepEqual(clickImportRows('sheet',[second,first],[]).map(r=>r.source_key).sort(),both.map(r=>r.source_key).sort());
});
test('different GCLIDs sharing a sheet ID are not silently dropped',()=>{
 assert.equal(clickImportRows('sheet',[first,{...first,gclid:'another-ad'}],[]).length,2);
});
test('explicit-offset calendar errors cannot roll into another day',()=>{
 for(const time of ['2026-02-30T09:41:10+03:00','2026-10-10T24:00:00Z','2026-10-10T09:60:00Z','2026-13-10T09:00:00Z'])assert.throws(()=>parseTimestamp(time));
 assert.equal(parseTimestamp('10/10/2026 09:41:10'),'2026-10-10T06:41:10.000Z');
 assert.equal(parseTimestamp('2026-10-10 09:41:10+03:00'),'2026-10-10T06:41:10.000Z');
});
