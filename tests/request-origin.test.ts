import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAppRequestOrigin} from '../lib/connection-validation';
const env={APP_URL:'https://old.example/path/',VERCEL:'1',VERCEL_ENV:'production',VERCEL_URL:'deployment.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'gsmweb-comparison.vercel.app'};
test('accepts configured canonical and exact Vercel production/deployment origins',()=>{
 for(const origin of ['https://old.example','https://deployment.vercel.app','https://gsmweb-comparison.vercel.app'])assert.doesNotThrow(()=>validateAppRequestOrigin(origin,env));
});
test('rejects missing, opaque, cross-site and deceptive origins',()=>{
 for(const origin of [null,'null','https://evil.vercel.app','https://gsmweb-comparison.vercel.app.evil.test','http://gsmweb-comparison.vercel.app','https://gsmweb-comparison.vercel.app/'])assert.throws(()=>validateAppRequestOrigin(origin,env));
});
test('does not trust production alias on preview or Vercel values outside Vercel',()=>{
 assert.throws(()=>validateAppRequestOrigin('https://gsmweb-comparison.vercel.app',{...env,VERCEL_ENV:'preview'}));
 assert.throws(()=>validateAppRequestOrigin('https://deployment.vercel.app',{...env,VERCEL:'0'}));
});
test('rejects malformed configuration and supports explicitly configured localhost',()=>{
 for(const APP_URL of ['https://user:pass@example.com','http://example.com','invalid'])assert.throws(()=>validateAppRequestOrigin('https://example.com',{APP_URL}));
 assert.doesNotThrow(()=>validateAppRequestOrigin('http://localhost:3000',{APP_URL:'http://localhost:3000/'}));
 assert.throws(()=>validateAppRequestOrigin('https://evil.test',{VERCEL:'1',VERCEL_URL:'evil.test/path'}));
});

