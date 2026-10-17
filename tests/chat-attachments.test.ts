import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseChatAttachments} from '../lib/chat-attachments';
import {attachmentMessage,runActionAgent} from '../lib/action-agent-model';
const text=(value:string)=>({name:'notes.txt',mediaType:'text/plain',data:Buffer.from(value).toString('base64')});
test('image, PDF and text bytes reach model as typed parts, not remote downloads',()=>{
 const image={name:'ad.png',mediaType:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')};
 const pdf={name:'brief.pdf',mediaType:'application/pdf',data:Buffer.from('%PDF-1.7\nexample').toString('base64')};
 const files=parseChatAttachments([image,pdf,text('Read this factual note.')]),parts=attachmentMessage('Review these files.',files);
 assert.equal(parts.length,4);assert.equal(parts[1].type,'file');assert.equal(parts[2].type,'file');assert.match(JSON.stringify(parts[3]),/UNTRUSTED ATTACHMENT/);assert.deepEqual(parseChatAttachments(undefined),[]);
});
test('reject secret text, MIME spoofing, excess files, invalid encoding and oversized files',()=>{
 for(const input of [[text('-----BEGIN PRIVATE KEY-----')],[{...text('bad'),mediaType:'image/png'}],Array(4).fill(text('x')),[{...text('x'),data:'https://example.test/secret'}],[text('x'.repeat(40001))],[{...text('x'),name:'../secret.txt'}]])assert.throws(()=>parseChatAttachments(input));
});
test('actual provider request contains image bytes and untrusted attachment boundary',async()=>{
 let received=false;const png={name:'ad.png',mediaType:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')};
 const output={reply:'Image reviewed.',evidence:[],recommendation:'Review policy.',expectedImpact:'Unknown',risks:'Unknown',confidence:'low',missingData:[]};
 const result=await runActionAgent({key:'TEST_NOT_REAL',model:'claude-sonnet-5',message:'Review my screenshot.',attachments:[png],context:{},history:[],tools:{},fetcher:async(_url,init)=>{const body=JSON.parse(String(init?.body));received=true;assert.ok(body.messages.some((message:any)=>message.content.some((part:any)=>part.type==='image'&&part.source.data===png.data)));assert.match(JSON.stringify(body.system),/untrusted evidence/);return Response.json({id:'msg_test',type:'message',role:'assistant',model:'claude-sonnet-5',content:[{type:'text',text:JSON.stringify(output)}],stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:20}});}});
 assert.equal(received,true);assert.equal(result.reply,'Image reviewed.');
});
