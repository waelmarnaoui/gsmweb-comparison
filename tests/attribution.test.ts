import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRomanianPhone,candidates} from '../lib/attribution';
test('Romanian variants map to the same E.164 number',()=>{for(const p of ['0722 481 903','0040722481903','40722481903','+40 (722) 481-903'])assert.equal(normalizeRomanianPhone(p),'+40722481903');assert.throws(()=>normalizeRomanianPhone('+44722481903'));});
test('window is directional, inclusive and timezone aware',()=>{const list=[{timestamp:'2026-10-09T12:00:00Z'},{timestamp:'2026-10-09T11:59:59Z'},{timestamp:'2026-10-09T12:02:01Z'}];assert.deepEqual(candidates('2026-10-09T15:02:00+03:00',list),[list[0]]);assert.throws(()=>candidates('bad',list));});
