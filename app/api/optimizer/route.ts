import {requireAdmin,service,apiError} from '@/lib/server';
import {summarizeCampaign,TARGET_CPC_RON,type AdsObservation} from '@/lib/ads-monitor';
export async function GET(){try{
 await requireAdmin();
 const account=process.env.GOOGLE_ADS_CUSTOMER_ID;
 if(!account)return Response.json({mode:'OBSERVE',targetCpcRon:TARGET_CPC_RON,observation:null,notice:'Reporting account is not configured.'},{headers:{'Cache-Control':'no-store'}});
 const {data,error}=await service().from('ga_ads_observations').select('observation').eq('account_id',account).order('slot',{ascending:false}).limit(1).maybeSingle();
 if(error)throw new Error('Observation storage is unavailable. Install the reviewed migration.');
 const observation=(data?.observation??null) as AdsObservation|null;
 return Response.json({mode:'OBSERVE',executionEnabled:false,targetCpcRon:TARGET_CPC_RON,
  stale:!observation||!Number.isFinite(Date.parse(observation.fetchedAt))||Date.now()-Date.parse(observation.fetchedAt)>3600000,
  observation:observation?{...observation,campaigns:observation.campaigns.map(c=>({...c,...summarizeCampaign(c,observation.currency)}))}:null,
  blockers:['Daily spend limit is unset.','Visibility floors are unset.','Paid-customer attribution and profit need reconciliation.','All live ad changes require explicit approval.']
 },{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
