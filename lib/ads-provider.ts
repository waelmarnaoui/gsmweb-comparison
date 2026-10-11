import 'server-only';
import {IntegrationError} from './integration-error';
const BASE='https://datamanager.googleapis.com/v1/';
export async function adsRequest(token:string,path:string,body?:unknown){
 const response=await fetch(BASE+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok){
  let status='';try{const data=await response.json();if(typeof data.error?.status==='string'&&/^[A-Z_]{1,80}$/.test(data.error.status))status=' '+data.error.status;}catch{}
  throw new IntegrationError('Google request rejected (HTTP '+response.status+status+'). Check API access and conversion settings.',502);
 }
 return response.json();
}
