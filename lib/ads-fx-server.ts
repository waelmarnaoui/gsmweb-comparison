import 'server-only';
import {unstable_cache} from 'next/cache';
import {service} from './server';
import {fxDay,usableFx,type DailyFx} from './ads-fx';
import {fetchGoogleFinanceQuote} from './google-finance-quote';

// Only public data enters the cache. A new business date creates a new key.
// Keep legacy database rows' original Sheets provenance unchanged.
const publicQuote=unstable_cache(async(date:string)=>{
 const quote=await fetchGoogleFinanceQuote();
 if(quote.date!==date)throw new Error('Business day changed during quote collection.');
 return quote;
},['gsmweb-google-finance-usd-ron-v1'],{revalidate:false});

export async function dailyGoogleFx(accountId:string,currency:string,now=Date.now()):Promise<{rate:DailyFx|null;notice:string|null}>{
 if(currency==='RON')return {rate:null,notice:null};
 if(currency!=='USD')return {rate:null,notice:'Google currency conversion currently supports USD to RON only.'};
 try{
  const cached=await service().from('ga_ads_daily_fx').select('rate,rate_date,captured_at').eq('account_id',accountId).eq('rate_date',fxDay(now)).maybeSingle();
  if(cached.data&&!cached.error){
   const rate:DailyFx={source:'google_finance_sheet',date:cached.data.rate_date,rate:Number(cached.data.rate),capturedAt:cached.data.captured_at,quoteAt:null};
   if(usableFx(rate,now))return {rate,notice:null};
  }
 }catch{/* Legacy storage is optional for the independent public quote read. */}
 try{
  const rate=await publicQuote(fxDay(now));
  if(usableFx(rate,now))return {rate,notice:null};
 }catch{/* Fail closed: never substitute a guessed rate or another provider. */}
 return {rate:null,notice:'Google Finance USD/RON is temporarily unavailable or its quote could not be verified. The app retries automatically; no spreadsheet or browser sign-in is required. Lei comparisons remain unavailable until a valid quote is read.'};
}
