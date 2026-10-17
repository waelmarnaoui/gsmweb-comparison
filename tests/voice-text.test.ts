import {test} from 'node:test';
import assert from 'node:assert/strict';
import {speechChunks} from '../lib/voice-text';
test('spoken replies split into bounded chunks without losing words',()=>{
 const input='The agent will read the confirmed result. '.repeat(100);const chunks=speechChunks(input);
 assert.ok(chunks.every(chunk=>chunk.length<=220));assert.equal(chunks.join(' '),input.trim());
 assert.deepEqual(speechChunks('  '),[]);assert.equal(speechChunks('x'.repeat(450)).join(''),'x'.repeat(450));
});
