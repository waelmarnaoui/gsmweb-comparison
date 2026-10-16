import 'server-only';
import {service} from './server';
import {clickSheetSource,readSheetCells} from './sheets';
import {fxDay,usableFx,validateGoogleSheetRate,type DailyFx} from './ads-fx';
export async function dailyGoogleFx(accountId:string,currency:string,now=Date.now()):Promise<{rate:DailyFx|null;notice:string|null}>{
 if(currency==='RON')return {rate:null,notice:null};
 if(currency!=='USD')return {rate:null,notice:'Google currency conversion currently supports USD to RON only.'};
 const unavailable='Google daily exchange rate is unavailable. In the connected click spreadsheet, add tab FX: A1 = USD/RON; B1 = =GOOGLEFINANCE("CURRENCY:USDRON"). Lei comparisons stay unavailable until a valid rate is read.';
 try{
  const db=service(),date=fxDay(now);
  const cached=await db.from('ga_ads_daily_fx').select('rate,rate_date,captured_at').eq('account_id',accountId).eq('rate_date',date).maybeSingle();
  if(cached.error)return {rate:null,notice:'Install the Google daily exchange-rate migration before enabling lei comparisons.'};
  const decode=(row:{rate:unknown;rate_date:string;captured_at:string}):DailyFx=>({source:'google_finance_sheet',date:row.rate_date,rate:Number(row.rate),capturedAt:row.captured_at,quoteAt:null});
  if(cached.data){const rate=decode(cached.data);return usableFx(rate,now)?{rate,notice:null}:{rate:null,notice:unavailable};}
  const source=await clickSheetSource();
  const [values,formulas]=await Promise.all([readSheetCells("'FX'!A1:B1",'UNFORMATTED_VALUE',source),readSheetCells("'FX'!A1:B1",'FORMULA',source)]);
  const rate=validateGoogleSheetRate(values,formulas);
  // One immutable capture per Bucharest business day. Concurrent callers use the winning row.
  const saved=await db.from('ga_ads_daily_fx').upsert({account_id:accountId,rate_date:date,rate,captured_at:new Date(now).toISOString()},{onConflict:'account_id,rate_date',ignoreDuplicates:true});
  if(saved.error)return {rate:null,notice:'Could not save today’s Google exchange rate. Lei comparisons remain unavailable.'};
  const winner=await db.from('ga_ads_daily_fx').select('rate,rate_date,captured_at').eq('account_id',accountId).eq('rate_date',date).single();
  if(winner.error)return {rate:null,notice:unavailable};
  const result=decode(winner.data);return usableFx(result,now)?{rate:result,notice:null}:{rate:null,notice:unavailable};
 }catch{return {rate:null,notice:unavailable};}
}
