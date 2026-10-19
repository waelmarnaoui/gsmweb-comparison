import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
test('bulk ad storage protects browser roles and preserves audited immutable submission intent',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const r=spawnSync(process.execPath,['tests/bulk-ads.sql-test.mjs'],{encoding:'utf8',timeout:60000,env});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
