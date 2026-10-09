import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateOAuthState,validateRequestOrigin} from '../lib/connection-validation';
test('OAuth state is bound to nonce, current admin and expiration',()=>{
 const state={userId:'admin-a',expires:2000,nonce:'random'};
 assert.doesNotThrow(()=>validateOAuthState(state,'admin-a','random',1000));
 assert.throws(()=>validateOAuthState(state,'admin-b','random',1000));
 assert.throws(()=>validateOAuthState(state,'admin-a','changed',1000));
 assert.throws(()=>validateOAuthState(state,'admin-a',null,1000));
 assert.throws(()=>validateOAuthState(state,'admin-a','random',2000));
});
test('mutation origin rejects missing and hostile origins',()=>{
 assert.doesNotThrow(()=>validateRequestOrigin('https://app.example','https://app.example'));
 assert.throws(()=>validateRequestOrigin(null,'https://app.example'));
 assert.throws(()=>validateRequestOrigin('https://app.example.attacker.test','https://app.example'));
});
