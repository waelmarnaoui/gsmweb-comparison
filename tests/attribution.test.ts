import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRomanianPhone,candidates} from '../lib/attribution';
test('Romanian variants map to the same E.164 number',()=>{for(const p of ['0722 481 903','0040722481903','40722481903','+40 (722) 481-903'])assert.equal(normalizeRomanianPhone(p),'+40722481903');});
test('international numbers retain their country codes',()=>{for(const [input,expected] of [['+44 7700 900123','+447700900123'],['0049 (151) 23456789','+4915123456789'],['+1 (202) 555-0123','+12025550123'],['+216 20 123 456','+21620123456']])assert.equal(normalizeRomanianPhone(input),expected);for(const input of ['private','1234','+0123456789','+1234567890123456','+4477abc00900123'])assert.throws(()=>normalizeRomanianPhone(input));});
test('window is directional, inclusive and timezone aware',()=>{const list=[{timestamp:'2026-10-09T12:00:00Z'},{timestamp:'2026-10-09T11:59:59Z'},{timestamp:'2026-10-09T12:02:01Z'}];assert.deepEqual(candidates('2026-10-09T15:02:00+03:00',list),[list[0]]);assert.throws(()=>candidates('bad',list));});

