import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
import {pairingHash,sealWorkerConfig,openWorkerConfig} from '../lib/ads-control/pairing-crypto';
import {windowsProtect} from '../scripts/ads-worker-dpapi';
test('laptop setup uses a one-time high-entropy code and an authenticated encrypted envelope',()=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const token=randomBytes(32).toString('base64url');assert.match(pairingHash(token),/^[a-f0-9]{64}$/);assert.throws(()=>pairingHash('weak'));
 const envelope=sealWorkerConfig({test:'LOCAL_TEST_SENTINEL'},pair.publicKey,'test-pairing');assert.equal(JSON.stringify(envelope).includes('LOCAL_TEST_SENTINEL'),false);assert.deepEqual(openWorkerConfig(envelope,pair.privateKey),{test:'LOCAL_TEST_SENTINEL'});
 assert.throws(()=>openWorkerConfig({...envelope,context:'wrong-pairing'},pair.privateKey));
 const weak=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});assert.throws(()=>sealWorkerConfig({},weak.publicKey,'test'));assert.throws(()=>openWorkerConfig(envelope,weak.privateKey));
});
test('Windows laptop credentials round-trip through DPAPI without printing their contents',{skip:process.platform!=='win32'},async()=>{
 const encrypted=await windowsProtect('LOCAL_TEST_SENTINEL');assert.equal(encrypted.includes('LOCAL_TEST_SENTINEL'),false);assert.equal(await windowsProtect(encrypted,true),'LOCAL_TEST_SENTINEL');
});
