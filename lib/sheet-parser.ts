import {IntegrationError} from './integration-error';
import {parseTimestamp} from './timestamps';
import {clickChannel} from './manual-whatsapp';
const aliases:Record<string,string[]>={event_id:['event_id','id','click_id','eventid'],timestamp:['timestamp','clicked_at','click_timestamp','date_time','datetime','time','event_timestamp'],gclid:['gclid','google_click_id'],campaign:['campaign','campaign_name','utm_campaign'],page_url:['page_url','url','page','page_location'],session_id:['session_id','session','sessionid']};
export function parseClickRows(rows:string[][]){
 if(rows.length===0)return [];
 const headers=rows[0].map(s=>s.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 const map=Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,headers.findIndex(h=>names.includes(h))]));
 if(map.timestamp<0)throw new IntegrationError('Sheet needs a timestamp column in its first row. Include the header row in GOOGLE_SHEET_RANGE.');
 const result:Record<string,string>[]=[];
 for(let i=1;i<rows.length;i++){const row=rows[i];if(row.every(v=>!v.trim()))continue;const values=Object.fromEntries(Object.entries(map).map(([field,col])=>[field,col<0?'':String(row[col]||'').trim()]));try{values.timestamp=parseTimestamp(values.timestamp);}catch(error){throw new IntegrationError(`Row ${i+1}: ${error instanceof Error?error.message:'Invalid timestamp'}`);}result.push(values);}
  const channelColumn=headers.findIndex(header=>['channel','event_type','event_name','click_type','button','action','type'].includes(header));
  if(channelColumn>=0)for(let i=1,index=0;i<rows.length;i++){if(rows[i].every(value=>!value.trim()))continue;const channel=clickChannel(String(rows[i][channelColumn]||''));if(channel!=='unknown')result[index].channel=channel;index++;}
 if(rows.length>=10001)throw new IntegrationError('Sheet limit reached: narrow the configured range');
 return result;
}
