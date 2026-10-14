import {parseTimestamp} from './timestamps';
export function reviewDay(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Select a valid review date.');
 return {day:value,start:parseTimestamp(value+' 00:00:00'),end:parseTimestamp(value+' 23:59:59.999')};
}
export function isReviewDay(timestamp:string,day:string){
 try{const {start,end}=reviewDay(day),time=Date.parse(parseTimestamp(timestamp));return time>=Date.parse(start)&&time<=Date.parse(end);}catch{return false;}
}
export function reviewRange(from:string,to:string){
 const start=reviewDay(from).start,end=reviewDay(to).end;
 if(Date.parse(start)>Date.parse(end))throw new Error('End date must be on or after start date.');
 return {from,to,start,end};
}
export function isReviewRange(timestamp:string,from:string,to:string){
 try{const range=reviewRange(from,to),time=Date.parse(parseTimestamp(timestamp));return time>=Date.parse(range.start)&&time<=Date.parse(range.end);}catch{return false;}
}
