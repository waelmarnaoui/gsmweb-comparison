import 'server-only';
import {connectionToken} from '../connections';
import {IntegrationError} from '../integration-error';
import {rangeSchema,previousRange,organicTrendRows,type Range} from './model';
async function request(path:string,body?:unknown){
 const {token}=await connectionToken('google_search_console');let r:Response;
 try{r=await fetch('https://www.googleapis.com/webmasters/v3/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new IntegrationError('Search Console could not be reached. Try again later.',503);}
 if(!r.ok)throw new IntegrationError(r.status===403?'Search Console access denied. Enable Search Console API and grant this Google account access to the property.':'Search Console request failed. Reconnect your account if access has expired.',503);return r.json();
}
export async function searchConsoleSites(){const d=await request('sites');return (d.siteEntry??[]).filter((s:any)=>['siteOwner','siteFullUser','siteRestrictedUser'].includes(s.permissionLevel)).map((s:any)=>({siteUrl:String(s.siteUrl),permission:String(s.permissionLevel)}));}
export async function searchConsoleReport(site:string,input:Range){
 const range=rangeSchema.parse(input),sites=await searchConsoleSites();if(!sites.some((s:any)=>s.siteUrl===site))throw new IntegrationError('Choose a verified property from your connected account.',403);
 async function rows(r:Range){const all:any[]=[];for(let startRow=0;startRow<100000;startRow+=25000){const d=await request('sites/'+encodeURIComponent(site)+'/searchAnalytics/query',{startDate:r.from,endDate:r.to,dimensions:['query'],type:'web',dataState:'final',rowLimit:25000,startRow});if(d.rows!==undefined&&!Array.isArray(d.rows))throw new IntegrationError('Search Console returned an incomplete response.',503);all.push(...(d.rows??[]));if((d.rows?.length??0)<25000)return all;}throw new IntegrationError('Search Console row limit reached. Narrow your dates.',422);}
 const previous=previousRange(range),current=await rows(range),prior=await rows(previous);
 return {site,range,previous,fetchedAt:new Date().toISOString(),timeZone:'America/Los_Angeles',notice:'Organic queries for this property, not Google-wide search trends. Google omits some queries; recent finalized data may be delayed.',rows:organicTrendRows(current,prior)};
}
