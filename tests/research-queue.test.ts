import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
test('research queue SQL isolates owners and safely resumes checkpointed work',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['tests/research-queue.sql-test.mjs'],{encoding:'utf8',timeout:60000,env});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
