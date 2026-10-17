import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_MESSAGE_LIMIT,CHAT_DRAFT_LIMIT,LONG_REVIEW_MESSAGE,savedChatMessage,needsAgentSummary} from '../lib/chat-policy';
import {chatFailureMessage,chatFailureReply} from '../lib/agent-failure';
import {agentReplySchema} from '../lib/advisor-reply';
test('chat preserves complete messages and rejects oversize audit records instead of truncating them',()=>{
 const message='x'.repeat(CHAT_MESSAGE_LIMIT-20)+' Do not deploy.';
 assert.equal(savedChatMessage(message,[]),message);
 assert.throws(()=>savedChatMessage(message,['requirements.txt']),/exceed 4,000/);
 assert.throws(()=>savedChatMessage('x'.repeat(CHAT_MESSAGE_LIMIT+1),[]),/exceed 4,000/);
 assert.match(savedChatMessage(LONG_REVIEW_MESSAGE,['requirements.txt']),/Do not change settings/);
 assert.equal(CHAT_DRAFT_LIMIT,40000);
});
test('agent reserves its final step and elapsed-time budget for a summary without new tools',()=>{
 assert.equal(needsAgentSummary(0,0),false);assert.equal(needsAgentSummary(6,149999),false);
 assert.equal(needsAgentSummary(7,0),true);assert.equal(needsAgentSummary(2,150000),true);
});
test('failure receipts describe confirmed tool states without claiming rollback or exposing provider details',()=>{
 const error=Object.assign(new Error('SECRET_KEY private provider body'),{name:'TimeoutError'});
 const reply=chatFailureReply(error,[{tool:'source_files',state:'completed'},{tool:'read_source_file',state:'failed'},{tool:'bad private token',state:'completed'}]);
 assert.deepEqual(reply.evidence,['source_files: completed','read_source_file: failed']);
 assert.match(reply.reply,/time limit/);assert.match(reply.reply,/automatically resent/);assert.match(reply.risks,/Do not assume/);
 assert.doesNotMatch(JSON.stringify(reply),/SECRET_KEY|private provider body|bad private token/);agentReplySchema.parse(reply);
 assert.match(chatFailureReply(error,null).evidence[0],/unknown/);
 assert.match(chatFailureMessage({name:'AI_NoOutputGeneratedError'}),/complete, valid final reply/);
 assert.match(chatFailureMessage({statusCode:429,message:'SECRET_KEY'}),/quota/);
 agentReplySchema.parse(chatFailureReply(error,Array(50).fill({tool:'source_files',state:'completed'})));
});
