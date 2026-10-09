import {requireAdmin,apiError} from '@/lib/server';
import {eventKey,readClickSheet,sheetId} from '@/lib/sheets';
import {parseClickRows} from '@/lib/sheet-parser';
export async function POST(){try{
 const {client,user}=await requireAdmin();const values=parseClickRows(await readClickSheet());let inserted=0;
 const rows=values.map(v=>({source_key:eventKey(sheetId,v),clicked_at:v.timestamp,gclid:v.gclid||null,campaign:v.campaign||null,page_url:v.page_url||null,session_id:v.session_id||null}));
 for(let i=0;i<rows.length;i+=200){const {data,error}=await client.from('ga_clicks').upsert(rows.slice(i,i+200),{onConflict:'source_key',ignoreDuplicates:true}).select('id');if(error)throw error;inserted+=data?.length||0;}
 // The existing schema does not grant client audit inserts; import triggers record each new event.
 return Response.json({inserted,received:rows.length,importedBy:user.id});
 }catch(error){return apiError(error)}}
