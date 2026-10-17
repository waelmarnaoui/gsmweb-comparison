/** Local diagnostic only: no database writes, Ads mutations, or job execution. */
import {readFile} from 'node:fs/promises';
import {windowsProtect} from './ads-worker-dpapi';
import {ADS_REPORTING_VERSION} from '../lib/ads-monitor';
import {safeGoogleCodes} from '../lib/ads-control/google';
async function main(){
 const filename=process.argv[2];if(!filename)throw new Error('Provide the paired worker file path.');
 const c=JSON.parse(await windowsProtect(await readFile(filename,'utf8'),true)) as Record<string,string>;
 const account=c.GOOGLE_ADS_CUSTOMER_ID;if(!/^\d{10}$/.test(account))throw new Error('Worker account invalid.');
 const oauth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:c.ADS_CONTROL_WORKER_REFRESH_TOKEN,client_id:c.GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_ID,client_secret:c.GOOGLE_ADS_MANAGEMENT_OAUTH_CLIENT_SECRET}),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!oauth.ok){console.log(JSON.stringify({stage:'oauth',http:oauth.status}));return;}
 const auth=await oauth.json();if(typeof auth.access_token!=='string')throw new Error('OAuth response invalid.');
 const r=await fetch(`https://googleads.googleapis.com/${ADS_REPORTING_VERSION}/customers/${account}/googleAds:search`,{method:'POST',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json',...(c.GOOGLE_ADS_DEVELOPER_TOKEN?{'developer-token':c.GOOGLE_ADS_DEVELOPER_TOKEN}:{}),...(c.GOOGLE_ADS_LOGIN_CUSTOMER_ID?{'login-customer-id':c.GOOGLE_ADS_LOGIN_CUSTOMER_ID}:{})},body:JSON.stringify({query:"SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.policy_summary.policy_topic_entries FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED' LIMIT 1001"}),redirect:'error',signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok||data.error){console.log(JSON.stringify({stage:'ads_read',http:r.status,codes:safeGoogleCodes(data),quota:(data.error?.details??[]).map((d:any)=>({type:d['@type'],reason:d.reason,retryDelay:d.retryDelay,metadata:Object.fromEntries(Object.entries(d.metadata??{}).filter(([k])=>['quota_limit','quota_limit_value','quota_metric','service','quota_location','consumer'].includes(k)))}))}));return;}
 console.log(JSON.stringify({stage:'ads_read',checkedAt:new Date().toISOString(),account,complete:!data.nextPageToken&&(data.results?.length??0)<=1000,ads:(data.results??[]).map((x:any)=>({resource:x.adGroupAd?.resourceName,adStatus:x.adGroupAd?.status,groupStatus:x.adGroup?.status,approval:x.adGroupAd?.policySummary?.approvalStatus,review:x.adGroupAd?.policySummary?.reviewStatus,topics:(x.adGroupAd?.policySummary?.policyTopicEntries??[]).map((t:any)=>({topic:t.topic,type:t.type}))}))}));
}
void main().catch(()=>{console.error('Read-only diagnosis could not complete. No changes were sent.');process.exitCode=1;});
