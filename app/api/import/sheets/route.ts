import {requireAdmin,apiError} from '@/lib/server';
import {eventKey,readClickSheet,clickSheetSource} from '@/lib/sheets';
import {sameOrigin} from '@/lib/connections';
import {parseClickRows} from '@/lib/sheet-parser';
import {autoMatch} from '@/lib/auto-match';
export async function POST(request:Request){try{
 const {client,user}=await requireAdmin();if(process.env.APP_URL)sameOrigin(request);const source=await clickSheetSource();const values=parseClickRows(await readClickSheet(source));let inserted=0;
 const rows=values.map(v=>({source_key:eventKey(source.id,v),clicked_at:v.timestamp,gclid:v.gclid||null,campaign:v.campaign||null,page_url:v.page_url||null,session_id:v.session_id||null}));
 for(let i=0;i<rows.length;i+=200){const {data,error}=await client.from('ga_clicks').upsert(rows.slice(i,i+200),{onConflict:'source_key',ignoreDuplicates:true}).select('id');if(error)throw error;inserted+=data?.length||0;}
 // The existing schema does not grant client audit inserts; import triggers record each new event.
 let attribution;try{attribution=await autoMatch(client);}catch{attribution={configured:true,confirmed:0,error:'Clicks were imported, but automatic attribution failed. Refresh to retry.'};}
 return Response.json({inserted,received:rows.length,importedBy:user.id,attribution});
 }catch(error){return apiError(error)}}
