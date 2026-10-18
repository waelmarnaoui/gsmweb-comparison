import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clearCurrentAdsCooldown,type CooldownResetStore} from '../lib/ads-cooldown-reset';
import {adsReadWait,ADS_QUOTA_WAIT_MS,ADS_READ_GAP_MS,type AdsReadReceipt} from '../lib/ads-web-mode';
import {gatedAdsRead,type AdsReadGateStore} from '../lib/ads-read-gate';
const now=Date.parse('2026-10-18T10:00:00Z'),requestId='12345678-1234-4123-8123-123456789abc';
test('owner reset clears all old holds but a later quota or read starts normal cooldown again',()=>{
 const rows:AdsReadReceipt[]=[{id:1,action:'quota',created_at:new Date(now-1000).toISOString()},{id:2,action:'report',created_at:new Date(now-500).toISOString()},{id:3,action:'owner_reset',created_at:new Date(now).toISOString()}];
 for(const kind of ['report','policy','resources','search'] as const)assert.equal(adsReadWait(kind,rows,now),0);
 rows.push({id:4,action:'quota',created_at:new Date(now).toISOString()});assert.equal(adsReadWait('search',rows,now),ADS_QUOTA_WAIT_MS);
 rows.push({id:5,action:'owner_reset',created_at:new Date(now).toISOString()});assert.equal(adsReadWait('search',rows,now),0);
 rows.push({id:6,action:'report',created_at:new Date(now).toISOString()});assert.equal(adsReadWait('report',rows,now),ADS_READ_GAP_MS);
});
test('legacy timestamp-only receipts reset conservatively and unknown future history remains blocked',()=>{
 assert.equal(adsReadWait('report',[{action:'quota',created_at:new Date(now-1000).toISOString()},{action:'owner_reset',created_at:new Date(now).toISOString()}],now),0);
 assert.equal(adsReadWait('report',[{action:'owner_reset',created_at:new Date(now).toISOString()},{action:'quota',created_at:new Date(now).toISOString()}],now),ADS_QUOTA_WAIT_MS);
 assert.equal(adsReadWait('report',[{action:'owner_reset',created_at:new Date(now+120000).toISOString()}],now),ADS_QUOTA_WAIT_MS);
});
function fixture(){
 const recorded=new Set<string>();let locked=false,writes=0;
 const store:CooldownResetStore={lock:async()=>{if(locked)return null;locked=true;return 'lease';},unlock:async()=>{locked=false;},alreadyRecorded:async id=>recorded.has(id),record:async id=>{recorded.add(id);writes++;}};
 return {store,writes:()=>writes};
}
test('repeated confirmation IDs do not create a second reset watermark',async()=>{
 const f=fixture();assert.deepEqual(await clearCurrentAdsCooldown('owner',requestId,f.store),{cleared:true,duplicate:false});assert.deepEqual(await clearCurrentAdsCooldown('owner',requestId,f.store),{cleared:true,duplicate:true});assert.equal(f.writes(),1);
});
test('invalid confirmation, missing history, failed storage and occupied account fail closed',async()=>{
 const f=fixture();await assert.rejects(clearCurrentAdsCooldown('owner','bad',f.store));assert.equal(f.writes(),0);
 await assert.rejects(clearCurrentAdsCooldown('owner',requestId,{...f.store,lock:async()=>null}),/ads_read_busy/);
 for(const field of ['alreadyRecorded','record'] as const)await assert.rejects(clearCurrentAdsCooldown('owner',requestId,{...f.store,[field]:async()=>{throw new Error('storage');}}),/storage/);
 assert.equal(f.writes(),0);assert.equal((await clearCurrentAdsCooldown('owner',requestId,f.store)).cleared,true);
});
test('all account checks resume after reset and the next quota response blocks them again without retries',async()=>{
 const rows:AdsReadReceipt[]=[{id:1,action:'quota',created_at:new Date(now-1000).toISOString()},{id:2,action:'owner_reset',created_at:new Date(now-500).toISOString()}];let calls=0;
 const store:AdsReadGateStore={lock:async()=>'lease',unlock:async()=>{},receipts:async()=>rows,record:async action=>{rows.push({id:rows.length+1,action,created_at:new Date(now).toISOString()});}};
 assert.equal(await gatedAdsRead('report',store,async()=>{calls++;return 'ok';},()=>false,now),'ok');
 await assert.rejects(gatedAdsRead('policy',store,async()=>{calls++;throw new Error('quota');},()=>true,now),/quota/);
 await assert.rejects(gatedAdsRead('search',store,async()=>{calls++;},()=>false,now),/ads_read_wait/);assert.equal(calls,2);
});
test('reset endpoint remains owner-only, same-origin and audited; it cannot invoke Google or modify Ads settings',()=>{
 const route=readFileSync('app/api/optimizer/cooldown/route.ts','utf8');assert.match(route,/requireAdmin/);assert.match(route,/sameOrigin\(request\)/);assert.match(route,/confirmed!==true/);assert.match(route,/actor,action:'owner_reset'/);
 assert.doesNotMatch(route,/googleads\.googleapis|collectAdsObservation|setPublishing|stock_enabled|protect_existing_ads/);
});
