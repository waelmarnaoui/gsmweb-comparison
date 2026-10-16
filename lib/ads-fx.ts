import type {AdsObservation} from './ads-monitor';
export type DailyFx={source:'google_finance_sheet'|'google_finance_public';date:string;rate:number;capturedAt:string;quoteAt:string|null};
export function fxDay(now:number){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(name:string)=>parts.find(p=>p.type===name)!.value;return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validateGoogleSheetRate(values:unknown[][],formulas:unknown[][]):number{
 if(values[0]?.[0]!=='USD/RON'||formulas[0]?.[0]!=='USD/RON'||typeof formulas[0]?.[1]!=='string'||
  formulas[0][1].replace(/\s/g,'').toUpperCase()!=='=GOOGLEFINANCE("CURRENCY:USDRON")')throw new Error('FX!A1 must be USD/RON and FX!B1 must contain =GOOGLEFINANCE("CURRENCY:USDRON").');
 const value=values[0]?.[1];
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>100)throw new Error('Google exchange rate is unavailable or invalid.');
 return value;
}
export function usableFx(fx:DailyFx|null,now=Date.now()){
 return !!fx&&(fx.source==='google_finance_sheet'||fx.source==='google_finance_public')&&
  (fx.source!=='google_finance_public'||(fx.quoteAt!==null&&Number.isFinite(Date.parse(fx.quoteAt))&&Date.parse(fx.quoteAt)<=now+60000&&now-Date.parse(fx.quoteAt)<=4*86400000))&&fx.date===fxDay(now)&&Number.isFinite(fx.rate)&&fx.rate>0&&fx.rate<=100&&
  Number.isFinite(Date.parse(fx.capturedAt))&&fxDay(Date.parse(fx.capturedAt))===fx.date&&Date.parse(fx.capturedAt)<=now+60000&&now-Date.parse(fx.capturedAt)<=26*3600000;
}
export function ronValue(amount:number,currency:string,fx:DailyFx|null,now=Date.now()):number|null{
 if(!Number.isFinite(amount)||amount<0)return null;
 if(currency==='RON')return amount;
 if(currency==='USD'&&usableFx(fx,now))return amount*fx!.rate;
 return null;
}
export function observationInRon(observation:AdsObservation|null,fx:DailyFx|null,now=Date.now()):AdsObservation|null{
 if(!observation)return null;if(observation.currency==='RON')return observation;
 if(observation.currency!=='USD'||!usableFx(fx,now))return null;
 const convert=(value:string)=>{
  if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('Invalid currency amount.');
  const converted=Math.round(Number(value)*fx!.rate);if(!Number.isSafeInteger(converted))throw new Error('Converted currency amount exceeds supported range.');return String(converted);
 };
 return {...observation,currency:'RON',campaigns:observation.campaigns.map(c=>({...c,costMicros:convert(c.costMicros)})),
  ...(observation.today?{today:{...observation.today,costMicros:convert(observation.today.costMicros)}}:{})};
}
