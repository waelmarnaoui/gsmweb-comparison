import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CALLS_VISIBLE_FROM_UTC,visibleCallStart} from '../lib/call-visibility';
test('24 September starts at Bucharest midnight and cannot be bypassed by earlier query dates',()=>{
 assert.equal(CALLS_VISIBLE_FROM_UTC,'2026-09-23T21:00:00.000Z');
 assert.equal(visibleCallStart().toISOString(),CALLS_VISIBLE_FROM_UTC);
 assert.equal(visibleCallStart('2020-01-01T00:00:00Z').toISOString(),CALLS_VISIBLE_FROM_UTC);
 assert.equal(visibleCallStart('2026-10-10T00:00:00+03:00').toISOString(),'2026-10-09T21:00:00.000Z');
 assert.throws(()=>visibleCallStart('invalid'));
});

