import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdsRefreshGate,needsAdsRefresh} from '../lib/ads-refresh';
import {AdsReportingError} from '../lib/ads-monitor';
const now=Date.parse('2026-10-16T12:00:00Z');
test('missing, invalid, future and five-minute-old observations need collection',()=>{
 for(const stamp of [null,'bad',new Date(now+120000).toISOString(),new Date(now-300000).toISOString()])assert.equal(needsAdsRefresh(stamp,now),true);
 assert.equal(needsAdsRefresh(new Date(now-299999).toISOString(),now),false);
});
test('fresh reports do not call Google',async()=>{
 let calls=0;const refresh=createAdsRefreshGate();await refresh('account',async()=>new Date(now).toISOString(),async()=>{calls++;},now);assert.equal(calls,0);
});
test('concurrent stale readers share one read-only collection',async()=>{
 let calls=0,release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),refresh=createAdsRefreshGate();
 const collect=async()=>{calls++;await wait;};
 const a=refresh('account',async()=>null,collect,now),b=refresh('account',async()=>null,collect,now);release();
 assert.deepEqual(await a,{refreshError:null});assert.deepEqual(await b,{refreshError:null});assert.equal(calls,1);
});
test('API failure remains visible, redacts provider details and permits immediate manual retry',async()=>{
 let calls=0;const refresh=createAdsRefreshGate(),collect=async()=>{calls++;throw new Error('sensitive provider response');};
 assert.match((await refresh('account',async()=>null,collect,now)).refreshError!,/collection failed/);
 const result=await refresh('account',async()=>null,collect,now+1);assert.equal(calls,2);assert.ok(!result.refreshError!.includes('sensitive'));
});
test('quota responses retain a safe classification without a site cooldown',async()=>{
 let calls=0;const refresh=createAdsRefreshGate(),collect=async()=>{calls++;throw new AdsReportingError(429);};
 assert.equal((await refresh('account',async()=>null,collect,now)).quotaLimited,true);
 assert.equal(calls,1);assert.equal((await refresh('account',async()=>null,collect,now+1)).quotaLimited,true);assert.equal(calls,2);
});
