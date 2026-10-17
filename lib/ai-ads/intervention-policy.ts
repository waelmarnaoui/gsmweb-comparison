import type {PublicationFeedback} from './publishing';
export const POLICY_ONLY_PREFERENCE='intervene_only_on_ineligible_ads';
export function feedbackFresh(feedback:PublicationFeedback|null,now=Date.now()){
 const time=Date.parse(feedback?.observedAt??'');
 return Number.isFinite(time)&&time<=now+10000&&now-time<300000;
}
export function policyOnlyFeedback(f:PublicationFeedback){
 return {state:f.groupStatus==='ENABLED'?'active':'paused',error_code:f.approval==='DISAPPROVED'?'google_disapproved':f.approval==='APPROVED_LIMITED'?'google_policy_limited':f.approval==='APPROVED'&&f.review==='REVIEWED'&&f.topics.length===0?null:'google_review_pending'};
}
