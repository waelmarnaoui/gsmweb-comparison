import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {advisorReadiness,configureAdvisor} from '@/lib/advisor-settings-server';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=120;
export async function GET(){try{await requireAdmin();return Response.json(await advisorReadiness(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);if(Number(request.headers.get('content-length')??0)>8192)throw new IntegrationError('AI settings request is too large.',413);
 const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>8192)throw new IntegrationError('AI settings request is too large.',413);
 let input;try{input=JSON.parse(raw);}catch{throw new IntegrationError('Invalid AI configuration request.',400);}
 if(!input||!['save','test'].includes(input.operation))throw new IntegrationError('Invalid AI configuration request.',400);
 return Response.json(await configureAdvisor(user.id,{provider:input.provider,baseURL:input.baseURL,apiKey:input.apiKey,model:input.model,save:input.operation==='save'}),{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e instanceof Error&&['AdvisorProviderError','OllamaProviderError'].includes(e.name)?new IntegrationError(e.message,503):e);}}
