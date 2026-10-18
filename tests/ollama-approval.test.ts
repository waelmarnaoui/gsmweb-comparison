import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('server approval safety checks pass in the server-only module environment',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--conditions=react-server','--import','tsx','--test','tests/ollama-approval.server-test.ts'],{encoding:'utf8',timeout:30000,env});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/model-requested write only saves a proposal/);
});
