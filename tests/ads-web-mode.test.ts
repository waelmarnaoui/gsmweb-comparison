import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ADS_WEB_ONLY,ADS_READ_GAP_MS,ADS_QUOTA_WAIT_MS,adsReadWait,type AdsReadReceipt} from '../lib/ads-web-mode';
import {gatedAdsRead,type AdsReadGateStore} from '../lib/ads-read-gate';
const now=Date.parse('2026-10-18T09:00:00Z');
function fixture(){
 let locked=false;const receipts:AdsReadReceipt[]=[],trace:string[]=[];
 const store:AdsReadGateStore={lock:async()=>{if(locked)return null;locked=true;return 'lease';},unlock:async()=>{locked=false;trace.push('unlock');},receipts:async()=>receipts,record:async action=>{receipts.push({action,created_at:new Date(now).toISOString()});trace.push(action);}};
 return {store,receipts,trace};
}
test('temporary mode defaults to web-only and enforces six-hour attempts plus a shared 24-hour quota wait',()=>{
 assert.equal(ADS_WEB_ONLY,true);assert.equal(adsReadWait('report',[],now),0);
 const rows=[{action:'report',created_at:new Date(now).toISOString()}];assert.equal(adsReadWait('report',rows,now),ADS_READ_GAP_MS);assert.equal(adsReadWait('policy',rows,now),0);assert.equal(adsReadWait('report',rows,now+ADS_READ_GAP_MS),0);
 assert.equal(adsReadWait('search',[{action:'quota',created_at:new Date(now).toISOString()}],now),ADS_QUOTA_WAIT_MS);
 assert.equal(adsReadWait('report',[{action:'report',created_at:new Date(now+120000).toISOString()}],now),ADS_QUOTA_WAIT_MS);
});
test('separate requests share a persisted attempt, not an in-process cache',async()=>{
 const f=fixture();let calls=0;
 const collect=async()=>{calls++;assert.deepEqual(f.trace,['report']);return 'verified report';};
 assert.equal(await gatedAdsRead('report',f.store,collect,()=>false,now),'verified report');
 await assert.rejects(gatedAdsRead('report',{...f.store},collect,()=>false,now+1),/ads_read_wait/);assert.equal(calls,1);
});
test('account lease prevents concurrent requests before either calls Google',async()=>{
 const f=fixture();let release!:()=>void,calls=0;const wait=new Promise<void>(resolve=>release=resolve);
 const first=gatedAdsRead('report',f.store,async()=>{calls++;await wait;return 'ok';},()=>false,now);
 await new Promise(resolve=>setImmediate(resolve));await assert.rejects(gatedAdsRead('policy',{...f.store},async()=>{calls++;},()=>false,now),/ads_read_busy/);release();await first;assert.equal(calls,1);
});
test('quota stops other read types and failed requests are never silently replayed',async()=>{
 const f=fixture();let calls=0;
 await assert.rejects(gatedAdsRead('report',f.store,async()=>{calls++;throw new Error('quota');},()=>true,now),/quota/);
 await assert.rejects(gatedAdsRead('policy',f.store,async()=>{calls++;},()=>false,now),/ads_read_wait/);
 assert.equal(calls,1);assert.deepEqual(f.receipts.map(r=>r.action),['report','quota']);
 const g=fixture();await assert.rejects(gatedAdsRead('report',g.store,async()=>{throw new Error('transport');},()=>false,now),/transport/);
 await assert.rejects(gatedAdsRead('report',g.store,async()=>{},()=>false,now),/ads_read_wait/);
});
test('storage or intent failure fails closed without calling Google and releases the lease',async()=>{
 for(const field of ['record','receipts'] as const){const f=fixture();let calls=0;const store={...f.store,[field]:async()=>{throw new Error('storage');}};
  await assert.rejects(gatedAdsRead('report',store,async()=>{calls++;},()=>false,now),/storage/);assert.equal(calls,0);assert.deepEqual(f.trace,['unlock']);
 }
});
