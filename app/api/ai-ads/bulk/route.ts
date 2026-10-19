import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
import {bulkKeywordReport,collectBulkKeywords,readBulkGroups,saveBulkGroup,publishBulkGroup} from '@/lib/bulk-ads/server';
import type {BulkRow} from '@/lib/bulk-ads/engine';
export const maxDuration=120;
export async function GET(){try{const {user}=await requireAdmin();const report=await bulkKeywordReport();let groups:BulkRow[],storageNotice=null;try{groups=await readBulkGroups(user.id);}catch(e){storageNotice=e instanceof Error?e.message:'Draft storage unavailable.';groups=[];}return Response.json({groups,report,storageNotice},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const raw=await request.text();if(Buffer.byteLength(raw)>12000)throw new IntegrationError('Request too large.',413);
 const input=JSON.parse(raw);let result;
 if(input.operation==='keywords')result=await collectBulkKeywords(user.id);
 else if(input.operation==='save')result=await saveBulkGroup(user.id,input.selection,input.campaignId,input.cpcMicros??null);
 else if(input.operation==='publish'&&typeof input.id==='string'&&/^[a-f0-9-]{36}$/i.test(input.id)&&typeof input.hash==='string'&&/^[a-f0-9]{64}$/.test(input.hash)&&input.confirmed===true)result=await publishBulkGroup(user.id,input.id,input.hash,true);
 else throw new IntegrationError('Invalid bulk action.',400);
 return Response.json({result},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
