import {parseTimestamp} from './timestamps';
export function reviewDay(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Select a valid review date.');
 return {day:value,start:parseTimestamp(value+' 00:00:00'),end:parseTimestamp(value+' 23:59:59.999')};
}
export function isReviewDay(timestamp:string,day:string){
 try{const {start,end}=reviewDay(day),time=Date.parse(parseTimestamp(timestamp));return time>=Date.parse(start)&&time<=Date.parse(end);}catch{return false;}
}
