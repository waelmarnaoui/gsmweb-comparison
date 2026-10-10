import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstInteractions} from '../lib/first-interaction';
const missed={id:'a',phone:'+40722123456',started_at:'2026-10-10T09:42:16+03:00',direction:'missed'};
test('keeps missed first call and groups callbacks and repeated incoming calls',()=>{
 const rows=firstInteractions([{...missed,id:'b',direction:'outgoing',started_at:'2026-10-10T11:04:28+03:00'},{...missed,id:'c',phone:'0722 123 456',direction:'incoming',started_at:'2026-10-11T11:04:28+03:00'},missed],Date.parse('2026-10-12T00:00:00Z'));
 assert.equal(rows.length,1);assert.equal(rows[0].primary.id,'a');assert.equal(rows[0].followUps.length,2);assert.ok(rows[0].eligible);
});
test('first inbound wins even if outbound is earlier; outbound-only stays ineligible',()=>{
 const outgoing={...missed,id:'out',direction:'outgoing',started_at:'2026-10-10T08:00:00+03:00'};
 assert.equal(firstInteractions([outgoing,missed])[0].primary.id,'a');assert.equal(firstInteractions([outgoing])[0].eligible,false);
});
test('selection is stable for timestamp ties and ignores pre-cutoff, invalid and future calls',()=>{
 assert.equal(firstInteractions([{...missed,id:'b'},missed])[0].primary.id,'a');
 assert.equal(firstInteractions([{...missed,started_at:'2026-09-23T10:00:00Z'},{...missed,phone:'private'},{...missed,started_at:'2099-01-01T00:00:00Z'}]).length,0);
});
