import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateGoogleSheetRate,usableFx,ronValue,observationInRon,type DailyFx} from '../lib/ads-fx';
import {monitoringAlerts} from '../lib/agent-policy';
import type {AdsObservation} from '../lib/ads-monitor';
const now=Date.parse('2026-10-16T10:00:00Z');
const fx:DailyFx={source:'google_finance_sheet',date:'2026-10-16',rate:4.5,capturedAt:'2026-10-16T09:00:00Z',quoteAt:null};
test('FX requires the correct pair, a GoogleFinance formula and numeric price',()=>{
 assert.equal(validateGoogleSheetRate([['USD/RON',4.5]],[['USD/RON','=GOOGLEFINANCE("CURRENCY:USDRON")']]),4.5);
 for(const value of ['#N/A','4.5',0,-1,Infinity,101])assert.throws(()=>validateGoogleSheetRate([['USD/RON',value]],[['USD/RON','=GOOGLEFINANCE("CURRENCY:USDRON")']]));
 assert.throws(()=>validateGoogleSheetRate([['RON/USD',4.5]],[['RON/USD','=GOOGLEFINANCE("CURRENCY:RONUSD")']]));
 assert.throws(()=>validateGoogleSheetRate([['USD/RON',4.5]],[['USD/RON','=4.5']]));
});
test('today uses its own daily capture; yesterday, future and invalid rates stay unavailable',()=>{
 assert.equal(usableFx(fx,now),true);assert.equal(ronValue(100,'USD',fx,now),450);
 assert.equal(ronValue(100,'RON',null,now),100);assert.equal(ronValue(100,'EUR',fx,now),null);
 assert.equal(usableFx({...fx,date:'2026-10-15'},now),false);
 assert.equal(usableFx({...fx,capturedAt:'2026-10-16T11:00:00Z'},now),false);
 assert.equal(usableFx({...fx,capturedAt:'2026-10-15T23:00:00Z',date:'2026-10-15'},now),false);
 assert.equal(ronValue(10,'USD',null,now),null);assert.equal(ronValue(-1,'USD',fx,now),null);
});
test('spend warning uses the same daily rate for both snapshots and preserves original USD',()=>{
 const current:AdsObservation={accountId:'2050434247',currency:'USD',timeZone:'Europe/Bucharest',windowStart:'2026-10-09',windowEnd:'2026-10-15',fetchedAt:new Date(now).toISOString(),campaigns:[],requestIds:[],today:{date:'2026-10-16',costMicros:'100000000',clicks:50}};
 const previous={...current,fetchedAt:new Date(now-5*60000).toISOString(),today:{...current.today!,costMicros:'90000000'}};
 const ron=observationInRon(current,fx,now),priorRon=observationInRon(previous,fx,now);
 assert.equal(ron?.today?.costMicros,'450000000');assert.equal(current.today?.costMicros,'100000000');assert.equal(current.currency,'USD');
 const alerts=monitoringAlerts(ron,priorRon,400,now);assert.ok(alerts.some(a=>a.key.startsWith('spend:')));assert.ok(!alerts.some(a=>a.key==='currency'));
 assert.equal(observationInRon(current,null,now),null);
});
