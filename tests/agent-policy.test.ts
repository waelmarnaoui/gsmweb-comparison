import {test} from 'node:test';
import assert from 'node:assert/strict';
import {businessDay,previousBusinessDate,receiptsSummary,earnedAdAllowance,monitoringAlerts,pauseDeadline,controlReadiness} from '../lib/agent-policy';
import type {AdsObservation} from '../lib/ads-monitor';
test('tomorrow spends 10% of yesterday, capped at 400 lei; missing is not zero',()=>{
 assert.equal(earnedAdAllowance(400000).allowanceBani,40000);
 assert.equal(earnedAdAllowance(200000).allowanceBani,20000);
 assert.equal(earnedAdAllowance(1000000).allowanceBani,40000);
 assert.equal(earnedAdAllowance(9).allowanceBani,0);
 assert.equal(earnedAdAllowance(0).ready,true);
 assert.equal(earnedAdAllowance(null).ready,false);
 assert.throws(()=>earnedAdAllowance(-1));
 assert.throws(()=>earnedAdAllowance(1.5));
});
test('daily categories have no overlapping boundaries and 4000 reaches the target',()=>{
 assert.equal(receiptsSummary(0).rating,'very_bad');assert.equal(receiptsSummary(49999).rating,'very_bad');
 assert.equal(receiptsSummary(50000).rating,'bad');assert.equal(receiptsSummary(99999).rating,'bad');
 assert.equal(receiptsSummary(100000).rating,'good');assert.equal(receiptsSummary(199999).rating,'good');
 assert.equal(receiptsSummary(200000).rating,'very_good');assert.equal(receiptsSummary(399999).targetReached,false);
 assert.equal(receiptsSummary(400000).targetReached,true);assert.equal(receiptsSummary(450000).gapBani,0);
});
test('19:00 check-in uses Bucharest and prior dates cross months/DST',()=>{
 assert.equal(businessDay(Date.parse('2026-10-16T15:59:00Z')).checkinDue,false);
 assert.equal(businessDay(Date.parse('2026-10-16T16:00:00Z')).checkinDue,true);
 assert.equal(businessDay(Date.parse('2026-12-16T17:00:00Z')).checkinDue,true);
 assert.equal(previousBusinessDate('2026-03-01'),'2026-02-28');
 assert.throws(()=>previousBusinessDate('2026-02-30'));
});
const now=Date.parse('2026-10-16T12:00:00Z');
function report(costMicros:string,timestamp=now):AdsObservation{return {accountId:'2050434247',currency:'RON',timeZone:'Europe/Bucharest',windowStart:'2026-10-09',windowEnd:'2026-10-15',fetchedAt:new Date(timestamp).toISOString(),campaigns:[],requestIds:[],today:{date:'2026-10-16',costMicros,clicks:1}};}
test('spend alerts preserve currency, date, freshness and pacing uncertainty',()=>{
 assert.equal(monitoringAlerts(null,null,400,now)[0].key,'stale');
 assert.equal(monitoringAlerts(report('400000000',now-16*60000),null,400,now)[0].key,'stale');
 assert.equal(monitoringAlerts(report('400000000'),null,400,now)[0].level,'critical');
 assert.equal(monitoringAlerts({...report('400000000'),currency:'USD'},null,400,now)[0].key,'currency');
 assert.equal(monitoringAlerts(report('30000000'),report('10000000',now-5*60000),400,now).some(a=>a.key.startsWith('pace:')),true);
 assert.equal(monitoringAlerts(report('30000000'),report('10000000',now-60*60000),400,now).length,0);
 assert.equal(monitoringAlerts(report('1000000'),null,0,now)[0].level,'critical');
 assert.equal(monitoringAlerts(report('0'),null,0,now).length,0);
 assert.equal(monitoringAlerts(report('500000000'),null,null,now).length,0);
});
test('ten-minute pause rule means maximum downtime, never a CPA learning window',()=>{
 assert.equal(pauseDeadline(now,now+599999).recoveryDue,false);
 assert.equal(pauseDeadline(now,now+600000).recoveryDue,true);
 assert.equal(pauseDeadline(now,now+700000).remainingMs,0);
 assert.throws(()=>pauseDeadline(now,now-1));
 assert.equal(controlReadiness(400).canEnable,false);
});


test('control mode follows saved authorization and pause state, never a cosmetic toggle',()=>{
 const settings={auto_publish_enabled:true,auto_publish_authorization:'owner approved',global_paused:false,auto_publish_checked_at:new Date(now).toISOString(),auto_publish_error:null};
 const active=controlReadiness(150,settings,now);assert.equal(active.mode,'CONTROL');assert.equal(active.canRun,true);assert.equal(active.health,'current');assert.equal(active.canEnable,false);
 assert.equal(controlReadiness(150,{...settings,auto_publish_authorization:null},now).mode,'ADVISE');
 assert.equal(controlReadiness(150,{...settings,auto_publish_enabled:false},now).canRun,false);
 const paused=controlReadiness(150,{...settings,global_paused:true},now);assert.equal(paused.mode,'PAUSED');assert.equal(paused.canRun,false);
 assert.equal(controlReadiness(150,null,now).mode,'ADVISE');
 assert.equal(controlReadiness(150,{...settings,auto_publish_checked_at:new Date(now-6*60000).toISOString()},now).health,'unconfirmed');
 assert.equal(controlReadiness(150,{...settings,auto_publish_error:'failed'},now).health,'unconfirmed');
 // Missing allowance does not revoke recorded authority; the execution guard must
 // still hold activation. Do not claim unrestricted permissions from this mode.
 assert.equal(controlReadiness(null,settings,now).scope,'new_stock_search_ads');
});
