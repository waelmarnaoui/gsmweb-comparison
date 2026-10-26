import {createHash} from 'node:crypto';
import {AmbiguousRomanianTime,parseTimestamp} from './timestamps';
export type SheetTimeIssue={key:string;row:number;timestamp:string;candidates:string[]};
export function sheetTimeKey(headers:string[],row:string[]){return createHash('sha256').update(JSON.stringify([headers,row])).digest('hex');}
export function resolveSheetTime(timestamp:string,key:string,resolutions:Record<string,string>,evidence?:{utc?:string;offset?:string}){
 let verified:string|undefined;
 if(evidence?.utc){
  if(!/^(?:\d{10}|\d{13})$/.test(evidence.utc)&&!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(evidence.utc))throw new Error('UTC timestamp needs an explicit offset or Unix timestamp.');
  verified=parseTimestamp(evidence.utc);
 }
 if(evidence?.offset&&!['+02:00','+03:00'].includes(evidence.offset))throw new Error('Romanian UTC offset must be +02:00 or +03:00.');
 const offsetCandidate=(candidate:string)=>new Date(Date.parse(candidate)+Number(evidence?.offset?.slice(1,3)||0)*3600000).toISOString().slice(11,19);
 const localClock=timestamp.match(/(?:T|[ ,])(\d{1,2}):(\d{2})(?::(\d{2}))?/);
 const clock=localClock?`${localClock[1].padStart(2,'0')}:${localClock[2]}:${localClock[3]||'00'}`:null;
 try{
  const parsed=parseTimestamp(timestamp);
  if(verified&&verified!==parsed)throw new Error('UTC and local website timestamps conflict.');
  if(evidence?.offset&&clock&&offsetCandidate(parsed)!==clock)throw new Error('Website UTC offset conflicts with the Romanian calendar date.');
  return parsed;
 }catch(error){
  if(error instanceof AmbiguousRomanianTime){
   const fromOffset=evidence?.offset?error.candidates.find(candidate=>offsetCandidate(candidate)===clock):undefined;
   if(verified&&!error.candidates.includes(verified))throw new Error('UTC and local website timestamps conflict.');
   if(verified&&fromOffset&&verified!==fromOffset)throw new Error('Website UTC timestamp and offset conflict.');
   if(verified||fromOffset)return verified||fromOffset!;
   if(error.candidates.includes(resolutions[key]))return resolutions[key];
  }
  throw error;
 }
}
