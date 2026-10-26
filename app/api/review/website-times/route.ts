import {requireAdmin,apiError,service} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {clickSheetSource,readClickSheet} from '@/lib/sheets';
import {parseClickRows,SheetTimeResolutionRequired} from '@/lib/sheet-parser';
import {readSheetTimeResolutions} from '@/lib/sheet-time-store';
import {IntegrationError} from '@/lib/integration-error';
async function inspect(){
 const source=await clickSheetSource(),rows=await readClickSheet(source),resolutions=await readSheetTimeResolutions(source.id);
 try{parseClickRows(rows,resolutions);return {source,issues:[] as SheetTimeResolutionRequired['issues']};}
 catch(error){if(error instanceof SheetTimeResolutionRequired)return {source,issues:error.issues};throw error;}
}
export async function GET(){try{await requireAdmin();const {issues}=await inspect();return Response.json({issues},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 sameOrigin(request);const {user}=await requireAdmin(),text=await request.text();
 if(text.length>100000)throw new IntegrationError('Too many timezone choices.',413);
 const body=JSON.parse(text);
 if(body.confirmed!==true||!Array.isArray(body.choices)||!body.choices.length||body.choices.length>500)throw new IntegrationError('Confirm the selected website times.');
 const {source,issues}=await inspect(),seen=new Set<string>();
 const records=body.choices.map((choice:{key?:unknown;timestamp?:unknown})=>{
  const issue=issues.find(row=>row.key===choice?.key);
  if(!issue||typeof choice.timestamp!=='string'||!issue.candidates.includes(choice.timestamp)||seen.has(issue.key))throw new IntegrationError('Website rows changed or a timezone choice is invalid. Check the rows again.',409);
  seen.add(issue.key);return {actor:user.id,entity:'ga_sheet_time_resolution',record_id:source.id,action:'CONFIRM_TIME',details:{key:issue.key,row:issue.row,local_timestamp:issue.timestamp,timestamp:choice.timestamp}};
 });
 const {error}=await service().from('ga_audit').insert(records);
 if(error)throw new IntegrationError('Timezone choices could not be saved. Check saved choices before retrying.',503);
 return Response.json({saved:records.length},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
