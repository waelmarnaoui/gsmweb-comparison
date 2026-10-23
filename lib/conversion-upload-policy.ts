export const WEBSITE_CLICK_REQUIRED='Only conversions linked to a verified website click can be uploaded to Google.';
export function websiteLinkedConversion(row:{timeBasis?:string}){return row.timeBasis==='website_click';}
export function bucharestToday(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
