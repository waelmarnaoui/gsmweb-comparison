import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin,connectionToken} from '@/lib/connections';
import {createAdPolicyReader} from '@/lib/ads-policy-reader';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=60;
export async function GET(){try{
 await requireAdmin();const account=process.env.GOOGLE_ADS_CUSTOMER_ID;if(!account)throw new IntegrationError('Reporting account is not configured.',503);
 const {data,error}=await service().from('ga_audit').select('details,created_at').eq('entity','google_ads_policy').eq('record_id',account).eq('action','observed').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(error)throw new IntegrationError('Policy review history is unavailable.',503);
 const report=data?.details??null,stamp=Date.parse(report?.fetchedAt??'');return Response.json({report,stale:!report||!Number.isFinite(stamp)||stamp>Date.now()+60000||Date.now()-stamp>900000},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);
 const accountId=process.env.GOOGLE_ADS_CUSTOMER_ID;if(!accountId)throw new IntegrationError('Reporting account is not configured.',503);
 const recent=await service().from('ga_audit').select('details').eq('entity','google_ads_policy').eq('record_id',accountId).eq('action','observed').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
 if(recent.error)throw new IntegrationError('Policy review history is unavailable.',503);
 const savedAt=Date.parse(recent.data?.details?.fetchedAt??'');
 if(Number.isFinite(savedAt)&&savedAt<=Date.now()+60000&&Date.now()-savedAt<300000)return Response.json({report:recent.data!.details,stale:false,cached:true},{headers:{'Cache-Control':'no-store'}});
 const report=await createAdPolicyReader({accountId,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,token:async()=>(await connectionToken('google_ads_management')).token}).collect();
 const {error}=await service().from('ga_audit').insert({actor:user.id,action:'observed',entity:'google_ads_policy',record_id:accountId,details:report});
 if(error)throw new IntegrationError('Google policy results were read but could not be saved. No ad was changed.',503);
 return Response.json({report,stale:false},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
