import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encryptConnection,decryptConnection} from '../lib/connection-crypto';
test('connection secrets are encrypted, randomized and context-bound',()=>{
 const key=randomBytes(32).toString('base64'),value={refresh_token:'private-refresh-token'};
 const ciphertext=encryptConnection(value,key,'google');assert.ok(!ciphertext.includes(value.refresh_token));
 assert.notEqual(ciphertext,encryptConnection(value,key,'google'));assert.deepEqual(decryptConnection(ciphertext,key,'google'),value);
 assert.throws(()=>decryptConnection(ciphertext,key,'supabase_crm'));assert.throws(()=>decryptConnection(ciphertext,randomBytes(32).toString('base64'),'google'));
});
test('rejects malformed encryption keys',()=>assert.throws(()=>encryptConnection({},'bad','google'),/32 bytes/));
