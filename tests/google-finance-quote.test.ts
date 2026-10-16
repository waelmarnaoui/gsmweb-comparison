import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseGoogleFinanceQuote,fetchGoogleFinanceQuote,GOOGLE_USD_RON_URL} from '../lib/google-finance-quote';
import {usableFx,ronValue} from '../lib/ads-fx';
const now=Date.parse('2026-10-16T12:00:00Z');
function row(rate:unknown=4.7,quoted=now-60000){
 const node:unknown[]=Array(25).fill(null);node[2]='USD / RON';node[5]=[rate];node[11]=[quoted/1000];node[15]=['USD','RON'];node[21]='USD-RON';return node;
}
function html(nodes:unknown[]=[row()]){return `<link rel="canonical" href="https://www.google.com/finance/quote/USD-RON"><script>AF_initDataCallback({key: 'ds:2', hash: '7', data:${JSON.stringify([nodes])}, sideChannel: {}});</script>`;}
test('public Google quote validates explicit pair, price and source timestamp',()=>{
 const fx=parseGoogleFinanceQuote(html(),now);assert.equal(fx.source,'google_finance_public');assert.equal(fx.rate,4.7);assert.equal(fx.quoteAt,new Date(now-60000).toISOString());assert.equal(usableFx(fx,now),true);assert.equal(ronValue(10,'USD',fx,now),47);
});
test('rejects wrong pair, ambiguous quote, missing payload and manually rendered prices',()=>{
 const wrong=row();wrong[15]=['RON','USD'];
 for(const page of [html([wrong]),html([row(),row(4.8)]),html([]),'<div>USD / RON 4.7</div>'])assert.throws(()=>parseGoogleFinanceQuote(page,now));
 assert.equal(parseGoogleFinanceQuote(html([row(),row()]),now).rate,4.7);
});
test('rejects invalid prices, stale or future quotes but permits market closure carryover',()=>{
 for(const value of [0,-1,101,'4.7',null])assert.throws(()=>parseGoogleFinanceQuote(html([row(value)]),now));
 assert.throws(()=>parseGoogleFinanceQuote(html([row(4.7,now-5*86400000)]),now));
 assert.throws(()=>parseGoogleFinanceQuote(html([row(4.7,now+120000)]),now));
 assert.equal(parseGoogleFinanceQuote(html([row(4.7,now-3*86400000)]),now).rate,4.7);
 const fx=parseGoogleFinanceQuote(html(),now);assert.equal(usableFx({...fx,quoteAt:null},now),false);assert.equal(usableFx(fx,now+86400000),false);
});
test('transport uses fixed public Google URL without OAuth or spreadsheet credentials',async()=>{
 const fetcher:typeof fetch=async(input,init)=>{assert.equal(input,GOOGLE_USD_RON_URL);assert.equal(new Headers(init?.headers).has('authorization'),false);assert.equal(init?.redirect,'error');return new Response(html(),{headers:{'content-type':'text/html'}});};
 assert.equal((await fetchGoogleFinanceQuote(fetcher,now)).rate,4.7);
 for(const response of [new Response('denied',{status:403}),new Response('{}',{headers:{'content-type':'application/json'}}),new Response('consent',{headers:{'content-type':'text/html'}})])await assert.rejects(fetchGoogleFinanceQuote(async()=>response,now));
});
