import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askOllama,ollamaEndpoint} from '../lib/ollama-advisor';
test('Ollama gateway restricts outbound destinations',()=>{
 assert.equal(ollamaEndpoint('https://test.ngrok-free.dev/'),'https://test.ngrok-free.dev/v1');
 for(const value of ['http://test.ngrok-free.dev','https://127.0.0.1','https://test.ngrok-free.dev/other','https://test.ngrok-free.dev?token=x','https://test.ngrok-free.dev.evil.com'])assert.throws(()=>ollamaEndpoint(value));
});
test('Ollama failures never fall back or leak provider details',async()=>{
 let calls=0;await assert.rejects(askOllama({key:'private',baseURL:'https://test.ngrok-free.dev',message:'test',context:{},history:[],fetcher:async()=>{calls++;return new Response('sensitive provider body',{status:401});}}),error=>error instanceof Error&&error.name==='OllamaProviderError'&&!error.message.includes('sensitive'));
 assert.equal(calls,1);
});
