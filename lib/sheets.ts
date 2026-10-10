import 'server-only';
import {createSign} from 'node:crypto';
import {IntegrationError} from './integration-error';
import {configuredProvider,getConnection,connectionToken} from './connections';
async function checkSheetResponse(response:Response){
 if(response.ok)return;
 const data=await response.json().catch(()=>null);
 if(data?.error?.details?.some((d:{reason?:string})=>d.reason==='SERVICE_DISABLED'))throw new IntegrationError('Enable Google Sheets API in the service account Google Cloud project.',503);
 if(response.status===403)throw new IntegrationError('Google Sheets access denied. Share this spreadsheet with the service account client_email as Viewer and verify Google Sheets API is enabled.',403);
 if(response.status===404)throw new IntegrationError('Spreadsheet not found or inaccessible. Check GOOGLE_SHEET_ID and service account Viewer access.');
 if(response.status===400)throw new IntegrationError('Invalid spreadsheet range. GOOGLE_SHEET_RANGE must name an existing tab and include its header row.');
 if(response.status===401)throw new IntegrationError('Google credentials were rejected. Replace expired or revoked credentials in Vercel and redeploy.',503);
 throw new IntegrationError('Google Sheets is temporarily unavailable. Retry shortly.',503);
}
export const sheetId=process.env.GOOGLE_SHEET_ID || '14wmk6KJ7p4d-p9KctSGj4MtKVk4w0XvH1qfvKox0Sgw';
export function sheetsConfigured(){return Boolean(configuredProvider('google')||process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SHEETS_ACCESS_TOKEN);}
export async function clickSheetSource(){
 if(configuredProvider('google')){const saved=await getConnection('google');if(saved){if(!saved.metadata.sheet_id)throw new IntegrationError('Choose a spreadsheet from Google Drive in Connections first.');return {id:saved.metadata.sheet_id,range:saved.metadata.range,oauth:true};}}
 return {id:sheetId,range:process.env.GOOGLE_SHEET_RANGE,oauth:false};
}
async function accessToken(){
 if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON){
  let account;try{account=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);}catch{throw new IntegrationError('GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON. Paste the complete downloaded JSON file into Vercel and redeploy.');}if(!account?.client_email||!account?.private_key)throw new IntegrationError('Google credentials are missing client_email or private_key. Use the complete service account JSON file.');
  const now=Math.floor(Date.now()/1000);const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  let assertion;try{assertion=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(account.private_key,'base64url');}catch{throw new IntegrationError('Google private key format is invalid. Use the unchanged JSON file contents in Vercel.');}
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)throw new IntegrationError('Google authentication failed. Verify the service account key is active, replace revoked credentials in Vercel, and redeploy.',503);const data=await response.json();if(typeof data.access_token!=='string')throw new IntegrationError('Google did not return an access token. Retry shortly.',503);return data.access_token as string;
 }
 if(process.env.GOOGLE_SHEETS_ACCESS_TOKEN)return process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
 throw new IntegrationError('Add GOOGLE_SERVICE_ACCOUNT_JSON to the Vercel deployment environment and redeploy.',503);
}
export async function readClickSheet(source?:Awaited<ReturnType<typeof clickSheetSource>>){
 source=source||await clickSheetSource();const sheetId=source.id;
 const token=source.oauth?(await connectionToken('google')).token:await accessToken();let range=source.range;
 if(!range){const meta=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),cache:'no-store'});await checkSheetResponse(meta);const data=await meta.json();const first=data.sheets?.find((s:{properties:{sheetId:number}})=>s.properties.sheetId===0)||data.sheets?.[0];if(!first)throw new IntegrationError('No spreadsheet tab found.');range="'"+first.properties.title.replaceAll("'","''")+"'!A1:AZ10001";}
 const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000),cache:'no-store'});await checkSheetResponse(response);const data=await response.json();return (data.values||[]) as string[][];
}
