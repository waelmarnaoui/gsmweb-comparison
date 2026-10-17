import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readPublishing,setPublishing,setCorrections,runPublishingTick} from '@/lib/ai-ads/publishing-server';
import {isGoogleQuotaError} from '@/lib/ads-control/google';
export const maxDuration=300;
export async function GET(){try{await requireAdmin();return Response.json(await readPublishing(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);if(Number(request.headers.get('content-length')??0)>1000)throw new Error('Request too large.');const input=await request.json();
 if(input.operation==='settings'&&typeof input.enabled==='boolean')await setPublishing(user.id,input.enabled);
 else if(input.operation==='corrections'&&typeof input.enabled==='boolean')await setCorrections(user.id,input.enabled);
 else if(input.operation==='refresh'){const result=await runPublishingTick({readOnly:true});if(!result.checked)return Response.json({error:'Read-only refresh is busy or waiting for the Google API quota cooldown.'},{status:409});}
 else if(input.operation==='tick')await runPublishingTick();else throw new Error('Invalid publication request.');
 return Response.json(await readPublishing(),{headers:{'Cache-Control':'no-store'}});
}catch(e){if(isGoogleQuotaError(e))return Response.json({error:'Google Ads API quota limit. No automatic action replay. Review activity and wait 15 minutes before checking again.'},{status:429,headers:{'Retry-After':'900','Cache-Control':'no-store'}});return apiError(e);}}
