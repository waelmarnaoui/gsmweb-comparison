import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewRange,isReviewRange} from '../lib/review-day';
test('11 to 14 October includes all four Bucharest days',()=>{
 const range=reviewRange('2026-10-11','2026-10-14');
 assert.equal(range.start,'2026-10-10T21:00:00.000Z');assert.equal(range.end,'2026-10-14T20:59:59.999Z');
 for(const time of ['2026-10-11 00:00:00','2026-10-12 09:42:16','2026-10-13 12:00:00','2026-10-14 23:59:59'])assert.equal(isReviewRange(time,'2026-10-11','2026-10-14'),true);
 assert.equal(isReviewRange('2026-10-10 23:59:59','2026-10-11','2026-10-14'),false);
 assert.equal(isReviewRange('2026-10-15 00:00:00','2026-10-11','2026-10-14'),false);
});
test('range handles changing Bucharest offsets and rejects invalid dates/order',()=>{
 const range=reviewRange('2026-10-24','2026-10-26');assert.equal((Date.parse(range.end)-Date.parse(range.start)+1)/3600000,73);
 assert.throws(()=>reviewRange('2026-10-14','2026-10-11'));assert.throws(()=>reviewRange('2026-02-30','2026-10-14'));
});
