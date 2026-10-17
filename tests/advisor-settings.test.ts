import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advisorModel,advisorKey,advisorFailure} from '../lib/advisor-settings';
import {askAdvisor} from '../lib/agent-model';
test('advisor has a usable default when only its server API key was configured',()=>{assert.equal(advisorModel(undefined),'claude-sonnet-5');assert.equal(advisorModel('claude-custom-model'),'claude-custom-model');assert.throws(()=>advisorModel('bad model\nsecret'));});
test('credential input is checked without ever rendering a saved key',()=>{assert.equal(advisorKey('sk-ant-'+ 'a'.repeat(40)),true);for(const v of ['',null,'not-a-key','sk-abc\n'])assert.equal(advisorKey(v),false);});
test('provider errors show specific safe setup steps, never provider text or key values',async()=>{for(const [status,code,match] of [[401,'invalid_api_key',/API key/],[402,'billing_error',/billing/],[404,'model_not_found',/model/]] as const){await assert.rejects(askAdvisor({key:'SECRET_KEY',model:'model',message:'x',context:{},history:[],fetcher:async()=>Response.json({error:{message:'PRIVATE_BODY SECRET_KEY',code}},{status})}),e=>{assert.match(String(e),match);assert.doesNotMatch(String(e),/PRIVATE_BODY|SECRET_KEY/);return true;});}assert.match(advisorFailure(500,'anything'),/try again later/);});
