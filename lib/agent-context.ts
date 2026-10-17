import 'server-only';
import {service} from './server';
import {businessDay,previousBusinessDate,receiptsSummary,earnedAdAllowance,monitoringAlerts,controlReadiness} from './agent-policy';
import type {AdsObservation} from './ads-monitor';
import {IntegrationError} from './integration-error';
import {accountFx} from './ads-fx-server';
import {advisorReadiness} from './advisor-settings-server';
import {observationInRon} from './ads-fx';
export function agentAccount(){
 const account=process.env.GOOGLE_ADS_CUSTOMER_ID;
 if(!account||!/^\d{10}$/.test(account))throw new IntegrationError('Set the verified reporting account in server settings.',503);
 return account;
}
export async function readAgentContext(now=Date.now()){
 const account=agentAccount(),db=service(),business=businessDay(now),yesterday=previousBusinessDate(business.date);
 const [snapshots,checkins]=await Promise.all([
  db.from('ga_ads_observations').select('observation').eq('account_id',account).order('slot',{ascending:false}).limit(2),
  db.from('ga_agent_daily_checkins').select('id,business_date,amount_bani,source,created_at').eq('account_id',account).in('business_date',[business.date,yesterday]).order('id',{ascending:false}).limit(100)
 ]);
 if(snapshots.error||checkins.error)throw new IntegrationError('Agent storage is unavailable. Install the reviewed agent migrations.',503);
 const observation=(snapshots.data?.[0]?.observation??null) as AdsObservation|null;
 const previous=(snapshots.data?.[1]?.observation??null) as AdsObservation|null;
 const today=checkins.data?.find(row=>row.business_date===business.date),prior=checkins.data?.find(row=>row.business_date===yesterday);
 const allowance=earnedAdAllowance(prior?Number(prior.amount_bani):null),dailySpendRon=allowance.allowanceBani===null?null:allowance.allowanceBani/100;
 const aiStatus=await advisorReadiness().catch(()=>({configured:false,model:null,source:'unavailable',notice:'AI settings could not be verified. Open AI settings on the dashboard.'}));
 const fx=await accountFx(account,observation?.currency??'RON',now);
 const converted=observationInRon(observation,fx.rate,now),convertedPrevious=observationInRon(previous,fx.rate,now);
 return {accountId:account,businessDate:business.date,yesterday,checkinDue:business.checkinDue&&!today,
  today:today?{...receiptsSummary(Number(today.amount_bani)),source:today.source,confirmedAt:today.created_at}:null,
  yesterdayPaymentsBani:prior?Number(prior.amount_bani):null,allowance,
  control:controlReadiness(dailySpendRon),alerts:monitoringAlerts(converted??observation,convertedPrevious,observation?.today?.date===business.date?dailySpendRon:null,now).filter(a=>!(converted&&a.key==='currency')),observation,fx,ronObservation:converted,
  aiConfigured:aiStatus.configured,aiStatus,
  limitations:['Customer payments are owner-confirmed totals, not automatically reconciled CRM profit.','Google reporting is delayed; five-minute checks do not provide five-minute source freshness.','CPA and contribution profit are unavailable until payment attribution is reconciled.','USD uses the owner-approved fixed rate of 4.74 RON. This is a reporting assumption, not a market quote or bank billing rate.']};
}
