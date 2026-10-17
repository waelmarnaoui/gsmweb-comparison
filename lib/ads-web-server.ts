import 'server-only';
import {service} from './server';
import {agentAccount} from './agent-context';
import {connectionToken} from './connections';
import {createAdPolicyReader,type AdPolicyRecord} from './ads-policy-reader';
import {createControlGoogle,type ControlCampaign} from './ads-control/google';
import {lowRequestAdsRead} from './ads-read-server';
import {IntegrationError} from './integration-error';
type Snapshot={ads:AdPolicyRecord[];campaigns:ControlCampaign[];fetchedAt:string|null;adsComplete:boolean;campaignsComplete:boolean;errors:{section:string;message:string}[]};
export async function webAdsResources(refresh=false):Promise<Snapshot>{
 const db=service(),account=agentAccount();
 if(!refresh){const r=await db.from('ga_audit').select('details').eq('entity','google_ads_web_resources').eq('record_id',account).eq('action','observed').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();if(r.error)throw new IntegrationError('Saved Ads status is unavailable.',503);return r.data?.details as Snapshot??{ads:[],campaigns:[],fetchedAt:null,adsComplete:false,campaignsComplete:false,errors:[]};}
 return lowRequestAdsRead(account,'policy',async()=>{
  const options={accountId:account,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN,loginCustomerId:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,token:async()=>(await connectionToken('google_ads_management')).token};
  // Sequential: a quota rejection on the first read prevents a second request.
  const ads=await createAdPolicyReader(options).collect(),campaigns=await createControlGoogle(options).campaigns();
  const snapshot:Snapshot={ads:ads.ads,campaigns,fetchedAt:ads.fetchedAt,adsComplete:true,campaignsComplete:true,errors:[]};
  const saved=await db.from('ga_audit').insert({actor:null,action:'observed',entity:'google_ads_web_resources',record_id:account,details:snapshot});if(saved.error)throw new IntegrationError('Ads status was read but could not be saved.',503);return snapshot;
 });
}
