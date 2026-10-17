import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readPublishing,setPublishing,setCorrections,runPublishingTick} from '@/lib/ai-ads/publishing-server';
export const maxDuration=300;
export async function GET(){try{await requireAdmin();return Response.json(await readPublishing(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);if(Number(request.headers.get('content-length')??0)>1000)throw new Error('Request too large.');const input=await request.json();
 if(input.operation==='settings'&&typeof input.enabled==='boolean')await setPublishing(user.id,input.enabled);
 else if(input.operation==='corrections'&&typeof input.enabled==='boolean')await setCorrections(user.id,input.enabled);
 else if(input.operation==='tick')await runPublishingTick();else throw new Error('Invalid publication request.');
 return Response.json(await readPublishing(),{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
