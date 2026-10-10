import {requireAdmin,apiError} from '@/lib/server';
import {normalizeRomanianPhone} from '@/lib/attribution';
import {firstInteractions} from '@/lib/first-interaction';
import {readCallHistory} from '@/lib/call-history';
import {matchingHealth,matchOptions,matchReviews,MATCHING_PENDING,optionReason} from '@/lib/matching-state';
import {formatRomanianTimestamp} from '@/lib/timestamps';
import {IntegrationError} from '@/lib/integration-error';
import {clickSheetSource} from '@/lib/sheets';
import {readClickSyncState} from '@/lib/sync-click-sheet';
import {clickSyncReason} from '@/lib/click-sync-state';

// Read-only diagnostics. Never confirms a match, imports data or writes to the CRM.
export async function GET(request:Request){try{
 const {client}=await requireAdmin(),phone=normalizeRomanianPhone(new URL(request.url).searchParams.get('phone')||'');
 const history=await readCallHistory(client,new Date().toISOString()),group=firstInteractions(history).find(g=>g.phone===phone);
 const health=await matchingHealth(client);
 if(!group)return Response.json({phone,found:false,matching:health},{headers:{'Cache-Control':'no-store'}});
 const settings=await client.from('ga_settings').select('window_seconds').eq('id',1).single();if(settings.error)throw settings.error;
 const call=group.primary,at=Date.parse(call.started_at),window=settings.data.window_seconds;
 const source=health.configured?await clickSheetSource():null;
 const sourceStatus=source?await readClickSyncState(client,source.id):null;
 const near=await client.from('ga_clicks').select('id,source_key,clicked_at,gclid,campaign').gte('clicked_at',new Date(at-Math.max(window,3600)*1000).toISOString())
  .lte('clicked_at',new Date(at+120000).toISOString()).order('clicked_at',{ascending:false}).order('id').limit(501);
 if(near.error)throw near.error;if((near.data||[]).length>500)throw new IntegrationError('Diagnostic click limit reached. No partial decision was returned.',503);
 const options=health.configured?await matchOptions(client,[call.id]):[];
 const reviews=health.configured?(await matchReviews(client)).filter(r=>r.call_id===call.id):[];
 const matches=await client.from('ga_matches').select('id,click_id,confirmation_method').eq('call_id',call.id);if(matches.error)throw matches.error;
 return Response.json({phone,found:true,matching:health,windowSeconds:window,selectedSheet:source?.id,sourceStatus,sourceReason:source?clickSyncReason(sourceStatus,source.id):MATCHING_PENDING,firstCall:{...call,romanianTime:formatRomanianTimestamp(call.started_at)},
  followUps:group.followUps.map(c=>({id:c.id,started_at:c.started_at,direction:c.direction})),matches:matches.data,reviews,options,
  reason:health.configured?optionReason(options):MATCHING_PENDING,
  nearbyImportedClicks:(near.data||[]).map(k=>{const delay=(at-Date.parse(k.clicked_at))/1000;return {...k,romanianTime:formatRomanianTimestamp(k.clicked_at),delaySeconds:delay,insideWindow:delay>=0&&delay<=window,selectedSource:source?k.source_key.startsWith(source.id+':'):false};}),
  limitation:'Timestamp matching identifies candidates, not proof of caller identity.'},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error)}}
