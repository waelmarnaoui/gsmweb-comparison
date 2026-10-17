import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {advisorReadiness,configureAdvisor} from '@/lib/advisor-settings-server';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=120;
export async function GET(){try{await requireAdmin();return Response.json(await advisorReadiness(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);if(Number(request.headers.get('content-length')??0)>2000)throw new Error('Request too large.');const input=await request.json();if(!['save','test'].includes(input.operation))throw new Error('Invalid AI configuration request.');
 return Response.json(await configureAdvisor(user.id,{apiKey:input.apiKey,model:input.model,save:input.operation==='save'}),{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e instanceof Error&&e.name==='AdvisorProviderError'?new IntegrationError(e.message,503):e);}}
