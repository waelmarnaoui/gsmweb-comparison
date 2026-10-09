import 'server-only';
import {createSign,createHash} from 'node:crypto';
export const sheetId=process.env.GOOGLE_SHEET_ID || '14wmk6KJ7p4d-p9KctSGj4MtKVk4w0XvH1qfvKox0Sgw';
export function sheetsConfigured(){return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SHEETS_ACCESS_TOKEN);}
async function accessToken(){
 if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON){
  const account=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);if(!account.client_email||!account.private_key)throw new Error('Google credentials are not configured');
  const now=Math.floor(Date.now()/1000);const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const assertion=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(account.private_key,'base64url');
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)throw new Error('Google authentication failed');const data=await response.json();if(typeof data.access_token!=='string')throw new Error('Google authentication failed');return data.access_token as string;
 }
 if(process.env.GOOGLE_SHEETS_ACCESS_TOKEN)return process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
 throw new Error('Google Sheets is not configured');
}
export async function readClickSheet(){
 const token=await accessToken();let range=process.env.GOOGLE_SHEET_RANGE;
 if(!range){const meta=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),cache:'no-store'});if(!meta.ok)throw new Error('Google Sheet access denied');const data=await meta.json();const first=data.sheets?.find((s:{properties:{sheetId:number}})=>s.properties.sheetId===0);if(!first)throw new Error('Sheet tab not found');range="'"+first.properties.title.replaceAll("'","''")+"'!A1:AZ10001";}
 const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),cache:'no-store'});if(!response.ok)throw new Error('Google Sheet access denied');const data=await response.json();return (data.values||[]) as string[][];
}
export function eventKey(sheet:string,values:Record<string,string>){return sheet+':'+(values.event_id||createHash('sha256').update(JSON.stringify(values)).digest('hex'));}
