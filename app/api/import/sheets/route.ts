import {requireAdmin,apiError} from '@/lib/server';
export async function POST(){try{
 const {client}=await requireAdmin();const token=process.env.GOOGLE_SHEETS_ACCESS_TOKEN,id=process.env.GOOGLE_SHEET_ID,range=process.env.GOOGLE_SHEET_RANGE;if(!token||!id||!range)throw new Error('Google Sheets is not configured');
 const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!response.ok)throw new Error('Sheets request failed');
 const data=await response.json();if(!Array.isArray(data.values)||data.values.length>10000)throw new Error('Invalid sheet');
 const rows=data.values.map((r:string[])=>{if(!r[0]||!r[1]||!/(Z|[+-]\d\d:\d\d)$/.test(r[1])||!Number.isFinite(Date.parse(r[1])))throw new Error('Invalid sheet timestamp');return {source_key:`${id}:${r[0]}`,clicked_at:new Date(r[1]).toISOString(),gclid:r[2]||null,campaign:r[3]||null,page_url:r[4]||null,session_id:r[5]||null};});
 const {data:inserted,error}=await client.from('ga_clicks').upsert(rows,{onConflict:'source_key',ignoreDuplicates:true}).select('id');if(error)throw error;return Response.json({inserted:inserted?.length||0});
 }catch(error){return apiError(error)}}
