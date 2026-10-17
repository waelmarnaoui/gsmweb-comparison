import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advisorModel,advisorKey,normalizeAdvisorKey,ADVISOR_KEY_MAX_LENGTH,advisorFailure,selectGeminiConfiguration} from '../lib/advisor-settings';
import {askAdvisor} from '../lib/agent-model';
import {googleReply} from './google-fixture';
import {sourceContent} from '../lib/agent-source-policy';
test('Gemini Flash is the default and other-provider IDs are rejected',()=>{
 assert.equal(advisorModel(undefined),'gemini-3.8-flash');assert.equal(advisorModel('gemini-2.5-flash'),'gemini-2.5-flash');
 for(const value of ['claude-sonnet-5','bad model\nsecret','gemini-abc/../../secret'])assert.throws(()=>advisorModel(value));
});
test('Google credentials are checked without accepting Claude keys',()=>{
 assert.equal(advisorKey('AIza'+'a'.repeat(35)),true);
 assert.equal(advisorKey('AQ.'+'a'.repeat(1200)),true);
 for(const value of ['',null,'not-a-key','sk-ant-'+'a'.repeat(40),'AIza'+'a'.repeat(34)+'\n'])assert.equal(advisorKey(value),false);
});
test('authorization keys survive full length and copy whitespace without allowing malformed credentials',()=>{
 const key='AQ.'+'a'.repeat(1200)+'.Z_9-';
 assert.equal(normalizeAdvisorKey(' \n'+key+'\r\n '),key);
 for(const value of [null,{},'', 'AQ.short','AQ.'+'a'.repeat(30)+'\ninternal',key+' secret',key+'"',key+'\\', 'AQ.'+'a'.repeat(ADVISOR_KEY_MAX_LENGTH)])assert.equal(normalizeAdvisorKey(value),null);
 assert.equal(selectGeminiConfiguration(null,{GEMINI_API_KEY:' '+key+'\n'}).key,key);
 assert.equal(selectGeminiConfiguration({credentials:{access_token:key},metadata:{provider:'google'}},{}).key,key);
 assert.throws(()=>sourceContent('Accidental credential: '+key));
 assert.throws(()=>sourceContent('Accidental credential: '+'AIza'+'a'.repeat(35)));
});
test('complete authorization key reaches Google only in its authentication header',async()=>{
 const key='AQ.'+'a'.repeat(1200),output={reply:'Connected.',evidence:[],recommendation:'None',expectedImpact:'Unknown',risks:'Unknown',confidence:'low',missingData:[]};
 await askAdvisor({key,model:'gemini-3.8-flash',message:'Static connection test',context:{connectionTest:true},history:[],fetcher:async(url,init)=>{
  assert.equal(new Headers(init?.headers).get('x-goog-api-key'),key);
  assert.equal(String(url).includes(key),false);assert.equal(String(init?.body).includes(key),false);
  return googleReply(output);
 }});
});
test('legacy saved credentials are ignored; only Google settings or Gemini environment keys are selected',()=>{
 const key='AIza'+'a'.repeat(35),env={GOOGLE_GENERATIVE_AI_API_KEY:key};
 const legacy={credentials:{access_token:'sk-ant-private'},metadata:{provider:'anthropic',model:'claude-sonnet-5'}};
 assert.deepEqual(selectGeminiConfiguration(legacy,{}),{key:null,model:'gemini-3.8-flash',provider:'google',source:'missing_key',configured:false});
 assert.equal(selectGeminiConfiguration(legacy,env).key,key);
 const saved={credentials:{access_token:'AIza'+'b'.repeat(35)},metadata:{provider:'google',model:'gemini-3.8-flash'}};
 assert.equal(selectGeminiConfiguration(saved,env).key,saved.credentials.access_token);
 assert.equal(selectGeminiConfiguration(null,{GEMINI_API_KEY:key}).key,key);
 assert.equal(selectGeminiConfiguration(null,{ANTHROPIC_API_KEY:'sk-ant-private',CLAUDE_ADVISOR_MODEL:'claude-sonnet-5'}).key,null);
 assert.equal(selectGeminiConfiguration({credentials:{access_token:'sk-ant-private'},metadata:{provider:'google'}},{}).configured,false);
});
test('provider errors show safe setup steps without raw provider content and never retry',async()=>{
 for(const [status,match] of [[401,/API key/],[402,/billing/],[403,/Google project/],[404,/model/],[429,/quota/]] as const){
  let calls=0;await assert.rejects(askAdvisor({key:'SECRET_KEY',model:'gemini-3.8-flash',message:'x',context:{},history:[],fetcher:async()=>{calls++;return Response.json({error:{code:status,message:'PRIVATE_BODY SECRET_KEY',status:'ERROR'}},{status});}}),e=>{assert.match(String(e),match);assert.doesNotMatch(String(e),/PRIVATE_BODY|SECRET_KEY/);return true;});assert.equal(calls,1);
 }
 assert.match(advisorFailure(500,'anything'),/try again later/);
});
