import {IntegrationError} from './integration-error';
import {AmbiguousRomanianTime} from './timestamps';
import {resolveSheetTime,sheetTimeKey,type SheetTimeIssue} from './sheet-time-resolution';
import {clickChannel} from './manual-whatsapp';
const aliases:Record<string,string[]>={event_id:['event_id','id','click_id','eventid'],timestamp:['timestamp','clicked_at','click_timestamp','date_time','datetime','time','event_timestamp'],gclid:['gclid','google_click_id'],campaign:['campaign','campaign_name','utm_campaign'],page_url:['page_url','url','page','page_location'],session_id:['session_id','session','sessionid']};
export class SheetTimeResolutionRequired extends IntegrationError {
 constructor(public readonly issues:SheetTimeIssue[]){super(`Row ${issues[0].row}: ambiguous Romanian clock-change time. Open Resolve website times in Conversion Review, select the correct occurrence, save, then run Match all again.`,409);}
}
export function parseClickRows(rows:string[][],resolutions:Record<string,string>={}){
 if(rows.length===0)return [];
 const headers=rows[0].map(s=>s.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 const map=Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,headers.findIndex(h=>names.includes(h))]));
 if(map.timestamp<0)throw new IntegrationError('Sheet needs a timestamp column in its first row. Include the header row in GOOGLE_SHEET_RANGE.');
 const result:Record<string,string>[]=[],issues:SheetTimeIssue[]=[];
 const channelColumn=headers.findIndex(header=>['channel','event_type','event_name','click_type','button','action','type'].includes(header));
 const utcColumn=headers.findIndex(header=>['timestamp_utc','utc_timestamp','unix_timestamp','timestamp_ms','event_timestamp_ms'].includes(header));
 const offsetColumn=headers.findIndex(header=>['utc_offset','timezone_offset'].includes(header));
 for(let i=1;i<rows.length;i++){
  const row=rows[i];if(row.every(v=>!v.trim()))continue;
  const values=Object.fromEntries(Object.entries(map).map(([field,col])=>[field,col<0?'':String(row[col]||'').trim()])),key=sheetTimeKey(rows[0],row);
  try{values.timestamp=resolveSheetTime(values.timestamp,key,resolutions,{utc:utcColumn<0?'':String(row[utcColumn]||'').trim(),offset:offsetColumn<0?'':String(row[offsetColumn]||'').trim()});}catch(error){
   if(error instanceof AmbiguousRomanianTime){if(!issues.some(issue=>issue.key===key))issues.push({key,row:i+1,timestamp:values.timestamp,candidates:error.candidates});continue;}
   throw new IntegrationError(`Row ${i+1}: ${error instanceof Error?error.message:'Invalid timestamp'}`);
  }
  if(channelColumn>=0){const channel=clickChannel(String(row[channelColumn]||''));if(channel!=='unknown')values.channel=channel;}
  result.push(values);
 }
 if(issues.length)throw new SheetTimeResolutionRequired(issues);
 if(rows.length>=10001)throw new IntegrationError('Sheet limit reached: narrow the configured range');
 return result;
}
