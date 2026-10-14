import {requireAdmin,apiError} from '@/lib/server';
import {reviewRange,isReviewRange} from '@/lib/review-day';
import {readCallHistory} from '@/lib/call-history';
import {firstInteractions} from '@/lib/first-interaction';
import {readCrmDay} from '@/lib/crm-reader';
import {clickSheetSource} from '@/lib/sheets';
import {IntegrationError} from '@/lib/integration-error';
import {reviewRepairContacts} from '@/lib/repair-review';
export async function GET(request:Request){try{
 const {client}=await requireAdmin(),url=new URL(request.url),from=url.searchParams.get('from')||url.searchParams.get('day')||'',to=url.searchParams.get('to')||from;
 try{reviewRange(from,to);}catch(error){throw new IntegrationError(error instanceof Error?error.message:'Select valid dates.');}
 const history=await readCallHistory(client,new Date().toISOString()),groups=firstInteractions(history),primary=new Set(groups.filter(g=>g.eligible).map(g=>g.primary.id));
 const calls=history.filter(c=>isReviewRange(c.started_at,from,to)).map(c=>({...c,firstInteraction:primary.has(c.id)}));
 const source=await clickSheetSource(),clicks:Record<string,unknown>[]=[];
 if(source){for(let offset=0;offset<10000;offset+=500){const {data,error}=await client.from('ga_clicks').select('id,source_key,clicked_at,gclid,campaign,page_url').like('source_key',source.id+':%').order('id').range(offset,offset+499);if(error)throw new IntegrationError('Website clicks could not be read.',503);clicks.push(...(data||[]));if((data||[]).length<500)break;if(offset===9500)throw new IntegrationError('Website click limit reached. No partial review was returned.',503);}}
 let crm:Awaited<ReturnType<typeof readCrmDay>>=[],crmError='';try{crm=await readCrmDay(from,to);}catch(error){crmError=error instanceof IntegrationError?error.message:'CRM review unavailable';}
 return Response.json({from,to,clicks:clicks.filter(c=>source&&String(c.source_key).startsWith(source.id+':')&&isReviewRange(String(c.clicked_at),from,to)),calls,crm:reviewRepairContacts(crm,history),crmError},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
