import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
import {keywordReport,keywordHistory,prepareKeywords,executeKeywords} from '@/lib/keywords/server';
import {keywordError} from '@/lib/keywords/errors';
export const maxDuration=180;
export async function GET(request:Request){try{const {user}=await requireAdmin(),url=new URL(request.url);return Response.json({report:await keywordReport(user.id,{from:url.searchParams.get('from')||'',to:url.searchParams.get('to')||''}),history:await keywordHistory(user.id)},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(keywordError(e));}}
export async function POST(request:Request){try{const {user}=await requireAdmin();sameOrigin(request);const text=await request.text();if(text.length>20000)throw new IntegrationError('Request too large.',413);const body=JSON.parse(text);let result;
 if(body.operation==='report')result=await keywordReport(user.id,body.range,true);
 else if(body.operation==='prepare')result=await prepareKeywords(user.id,body.change);
 else if(body.operation==='execute'&&body.confirmed===true&&/^[a-f0-9-]{36}$/i.test(body.id)&&/^[a-f0-9]{64}$/.test(body.hash))result=await executeKeywords(user.id,body.id,body.hash);
 else throw new IntegrationError('Choose a valid keyword operation.');return Response.json({result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(keywordError(e));}}
