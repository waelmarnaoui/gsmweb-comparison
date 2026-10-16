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
  stale:!observation||!Number.isFinite(Date.parse(observation.fetchedAt))||Date.now()-Date.parse(observation.fetchedAt)>900000,
  observation:observation?{...observation,campaigns:observation.campaigns.map(c=>({...c,...summarizeCampaign(c,observation.currency)}))}:null,
  blockers:['Spending allowance uses yesterday’s confirmed customer payments, capped at 400 lei.','Visibility floors and CPA thresholds require configuration.','Paid-customer attribution and profit need reconciliation.','Account control has not been activated.']
 },{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
