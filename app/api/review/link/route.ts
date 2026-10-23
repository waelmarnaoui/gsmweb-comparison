import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
import {linkId,manualClickInput} from '@/lib/manual-click-link';
import {readCallHistory} from '@/lib/call-history';
import {safePhone} from '@/lib/crm-comparison';
import {clickSheetSource} from '@/lib/sheets';
import {reviewRange} from '@/lib/review-day';
export async function GET(request:Request){try{
 const {client}=await requireAdmin(),url=new URL(request.url),callId=linkId(url.searchParams.get('callId'));
 let range;try{range=reviewRange(url.searchParams.get('from')||'',url.searchParams.get('to')||'');}catch{throw new IntegrationError('Choose valid click search dates.');}
 const history=await readCallHistory(client,new Date().toISOString()),original=history.find(row=>row.id===callId);
 if(!original)throw new IntegrationError('Saved customer interaction not found.');
 const interactions=history.filter(row=>safePhone(row.phone)===safePhone(original.phone)&&Date.parse(row.started_at)>=Date.parse(original.started_at));
 const source=await clickSheetSource();if(!source)throw new IntegrationError('Connect the website click sheet first.');
 const clicks:Record<string,unknown>[]=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await client.from('ga_clicks').select('id,clicked_at,gclid,campaign,page_url').like('source_key',source.id+':%').gte('clicked_at',range.start).lte('clicked_at',range.end).order('clicked_at',{ascending:false}).order('id').range(offset,offset+499);
  if(error)throw new IntegrationError('Website clicks could not be read.',503);
  clicks.push(...(data||[]));if((data||[]).length<500)return Response.json({interactions,clicks},{headers:{'Cache-Control':'no-store'}});
 }
 throw new IntegrationError('Too many clicks. Select a smaller date range.');
}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 sameOrigin(request);const {client}=await requireAdmin(),input=manualClickInput(await request.json());
 const {error}=await client.rpc('ga_link_click_manually',{p_call:input.callId,p_interaction:input.interactionId,p_click:input.clickId,p_reason:input.reason});
 if(error)throw new IntegrationError(['PGRST202','42883'].includes(error.code)?'Manual website linking needs the approved database setup.':'Link not saved. Check that the click precedes this customer interaction and neither the customer nor website source is already linked or submitted.',409);
 return Response.json({saved:true},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
