export type Draft={id:string;match_id:string;payment_transaction_id:string;amount:string|number;currency:string;paid_at:string;gclid:string;status:string};
export function preparedTimestampChange(draft:Draft,assignment:{match_id:string;amount:number;paid_at:string;gclid:string}|undefined){
 return Boolean(assignment&&draft.status==='prepared'&&draft.match_id===assignment.match_id&&draft.gclid===assignment.gclid&&Number(draft.amount)===assignment.amount&&Date.parse(draft.paid_at)!==Date.parse(assignment.paid_at));
}
export function conversionBlocker(draft:Draft,click:{gclid:string;clicked_at:string},payment:{id:string;amount:number;paidDate:string}|undefined,name:string,now=Date.now()){
 if(!name.trim())return 'Google Ads conversion name is not configured';
 if(!click.gclid||!draft.gclid||draft.gclid!==click.gclid)return 'Missing or mismatched GCLID';
 if(!payment)return 'Active CRM payment not found for this client';
 if(!Number.isFinite(Number(draft.amount))||Number(draft.amount)<=0||Math.round(Number(draft.amount)*100)!==Math.round(payment.amount*100)||draft.currency!=='RON')return 'Payment amount or currency changed';
 const paid=Date.parse(draft.paid_at),clicked=Date.parse(click.clicked_at);
 if(!Number.isFinite(paid)||!Number.isFinite(clicked)||paid!==clicked||paid>now)return 'Conversion time must equal the saved website click time';
 if(now-clicked>=90*86400000||paid-clicked>=90*86400000)return 'Click is outside the 90-day import limit';
 if(draft.status!=='prepared')return 'Conversion is not prepared';
 return '';
}

