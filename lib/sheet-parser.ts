const aliases:Record<string,string[]>={event_id:['event_id','id','click_id','eventid'],timestamp:['timestamp','clicked_at','click_timestamp','date_time','datetime','time','event_timestamp'],gclid:['gclid','google_click_id'],campaign:['campaign','campaign_name','utm_campaign'],page_url:['page_url','url','page','page_location'],session_id:['session_id','session','sessionid']};
export function parseClickRows(rows:string[][]){
 if(rows.length===0)return [];
 const headers=rows[0].map(s=>s.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 const map=Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,headers.findIndex(h=>names.includes(h))]));
 if(map.timestamp<0)throw new Error('Sheet needs a timestamp column');
 const result:Record<string,string>[]=[];
 for(let i=1;i<rows.length;i++){const row=rows[i];if(row.every(v=>!v.trim()))continue;const values=Object.fromEntries(Object.entries(map).map(([field,col])=>[field,col<0?'':String(row[col]||'').trim()]));if(!/(Z|[+-]\d{2}:\d{2})$/i.test(values.timestamp)||!Number.isFinite(Date.parse(values.timestamp)))throw new Error(`Row ${i+1}: timestamp needs ISO date and timezone offset`);values.timestamp=new Date(values.timestamp).toISOString();result.push(values);}
 if(rows.length>=10001)throw new Error('Sheet limit reached: narrow the configured range');
 return result;
}
