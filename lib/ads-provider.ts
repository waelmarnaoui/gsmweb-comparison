import 'server-only';
import {IntegrationError} from './integration-error';
import {adsErrorSummary} from './ads-error';
const BASE='https://datamanager.googleapis.com/v1/';
export async function adsRequest(token:string,path:string,body?:unknown){
 const response=await fetch(BASE+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok){
  let data:unknown;try{data=await response.json();}catch{}
  throw new IntegrationError(adsErrorSummary(response.status,data),502);
 }
 return response.json();
}
