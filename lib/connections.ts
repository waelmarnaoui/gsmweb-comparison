import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {createClient} from '@supabase/supabase-js';
import {service} from './server';
import {IntegrationError} from './integration-error';
import {encryptConnection,decryptConnection} from './connection-crypto';
import {validateOAuthState,validateRequestOrigin} from './connection-validation';
export type ConnectionId='google'|'google_ads'|'supabase_calls'|'supabase_crm';
export type Credentials={access_token:string;refresh_token:string;expires_at:number;project_key?:string};
export type Connection={id:ConnectionId;credentials:Credentials;metadata:Record<string,string>;connected_by:string;sealed:string};
export function appOrigin(){const value=process.env.APP_URL;if(!value)throw new IntegrationError('APP_URL is not configured.',503);const url=new URL(value);if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw new IntegrationError('APP_URL must use HTTPS.',503);return url.origin;}
export function sameOrigin(request:Request){validateRequestOrigin(request.headers.get('origin'),appOrigin());}
function key(){const value=process.env.CONNECTION_ENCRYPTION_KEY;if(!value||Buffer.from(value,'base64').length!==32)throw new IntegrationError('Connection encryption is not configured.',503);return value;}
export function configuredProvider(id:ConnectionId){return Boolean(process.env.CONNECTION_ENCRYPTION_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.APP_URL&&(id==='google_ads'?process.env.GOOGLE_ADS_OAUTH_CLIENT_ID&&process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET:id==='google'?process.env.GOOGLE_OAUTH_CLIENT_ID&&process.env.GOOGLE_OAUTH_CLIENT_SECRET:process.env.SUPABASE_OAUTH_CLIENT_ID&&process.env.SUPABASE_OAUTH_CLIENT_SECRET));}
export async function getConnection(id:ConnectionId):Promise<Connection|null>{
 const {data,error}=await service().from('ga_connections').select('*').eq('id',id).maybeSingle();
 if(error)throw new IntegrationError('Connection storage is unavailable. The approved connection migration must be installed.',503);
 if(!data)return null;
 try{return {id,credentials:decryptConnection(data.encrypted_credentials,key(),id),metadata:data.metadata,connected_by:data.connected_by,sealed:data.encrypted_credentials};}catch{throw new IntegrationError('Saved credentials cannot be decrypted. Check the connection encryption key.',503);}
}
export async function saveConnection(id:ConnectionId,credentials:Credentials,metadata:Record<string,string>,userId:string){
 const {error}=await service().from('ga_connections').upsert({id,encrypted_credentials:encryptConnection(credentials,key(),id),metadata,connected_by:userId,updated_at:new Date().toISOString()});
 if(error)throw new IntegrationError('Could not save connection. Verify the approved connection migration is installed.',503);
}
export function oauthConfig(id:ConnectionId){
 const google=id==='google'||id==='google_ads',clientId=id==='google_ads'?process.env.GOOGLE_ADS_OAUTH_CLIENT_ID:google?process.env.GOOGLE_OAUTH_CLIENT_ID:process.env.SUPABASE_OAUTH_CLIENT_ID,secret=id==='google_ads'?process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET:google?process.env.GOOGLE_OAUTH_CLIENT_SECRET:process.env.SUPABASE_OAUTH_CLIENT_SECRET;
 if(!clientId||!secret)throw new IntegrationError(`${google?'Google':'Supabase'} sign-in registration is not configured.`,503);
 return {clientId,secret,callback:appOrigin()+'/api/integrations/'+id+'/callback',authorize:google?'https://accounts.google.com/o/oauth2/v2/auth':'https://api.supabase.com/v1/oauth/authorize',token:google?'https://oauth2.googleapis.com/token':'https://api.supabase.com/v1/oauth/token'};
}
export async function tokenRequest(id:ConnectionId,params:Record<string,string>){
 const config=oauthConfig(id);const headers:Record<string,string>={'Content-Type':'application/x-www-form-urlencoded'};
 if(id==='google'||id==='google_ads'){params.client_id=config.clientId;params.client_secret=config.secret;}else headers.Authorization='Basic '+Buffer.from(config.clientId+':'+config.secret).toString('base64');
 const response=await fetch(config.token,{method:'POST',headers,body:new URLSearchParams(params),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new IntegrationError('Provider sign-in expired or was rejected. Reconnect your account.',503);
 const data=await response.json();if(typeof data.access_token!=='string'||typeof data.expires_in!=='number'||data.expires_in<=0)throw new IntegrationError('Provider did not return a valid access token.',503);
 return data as {access_token:string;refresh_token?:string;expires_in:number;scope?:string};
}
export async function connectionToken(id:ConnectionId){
 const saved=await getConnection(id);if(!saved)throw new IntegrationError('Connect your account first.');
 if(saved.credentials.expires_at>Date.now()+60000)return {token:saved.credentials.access_token,saved};
 const data=await tokenRequest(id,{grant_type:'refresh_token',refresh_token:saved.credentials.refresh_token});
 saved.credentials={...saved.credentials,access_token:data.access_token,refresh_token:data.refresh_token||saved.credentials.refresh_token,expires_at:Date.now()+data.expires_in*1000};
 // A concurrent reconnect must not be overwritten by an older token refresh.
 const {data:updated,error}=await service().from('ga_connections').update({encrypted_credentials:encryptConnection(saved.credentials,key(),id),updated_at:new Date().toISOString()}).eq('id',id).eq('encrypted_credentials',saved.sealed).select('id');
 if(error)throw new IntegrationError('Could not refresh saved credentials.',503);
 if(!updated?.length){const current=await getConnection(id);if(current&&current.credentials.expires_at>Date.now()+60000)return {token:current.credentials.access_token,saved:current};throw new IntegrationError('Connection changed during refresh. Retry the request.',409);}
 return {token:data.access_token,saved};
}
type OAuthState={nonce:string;verifier:string;userId:string;expires:number};
export async function startAuthorization(id:ConnectionId,userId:string){
 if(!configuredProvider(id))throw new IntegrationError('Provider registration or encrypted connection storage is not configured.',503);
 await getConnection(id);
 const config=oauthConfig(id),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
 (await cookies()).set('gsm_oauth_'+id,encryptConnection({nonce,verifier,userId,expires:Date.now()+600000},key(),'state:'+id),{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/api/integrations/'+id,maxAge:600});
 const url=new URL(config.authorize);url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.callback,response_type:'code',state:nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',...(id==='google'||id==='google_ads'?{scope:id==='google_ads'?'https://www.googleapis.com/auth/datamanager':'https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent select_account'}:{})}).toString();return url.toString();
}
export async function completeAuthorization(id:ConnectionId,userId:string,url:URL){
 const jar=await cookies(),cookie=jar.get('gsm_oauth_'+id);jar.set('gsm_oauth_'+id,'',{path:'/api/integrations/'+id,maxAge:0,httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax'});
 if(!cookie)throw new IntegrationError('Connection sign-in expired. Start again.');
 let state:OAuthState;try{state=decryptConnection(cookie.value,key(),'state:'+id);}catch{throw new IntegrationError('Connection state is invalid. Start again.');}
 validateOAuthState(state,userId,url.searchParams.get('state'));
 if(url.searchParams.has('error'))throw new IntegrationError('Account connection was cancelled.');
 const code=url.searchParams.get('code');if(!code)throw new IntegrationError('Authorization code is missing.');
 const config=oauthConfig(id),data=await tokenRequest(id,{grant_type:'authorization_code',code,code_verifier:state.verifier,redirect_uri:config.callback});
 if(!data.refresh_token)throw new IntegrationError('Provider did not grant offline access. Reconnect and approve access.');
 await saveConnection(id,{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000},{},userId);
}
export async function managementGet(id:ConnectionId,path:string){
 if(id==='google'||id==='google_ads')throw new IntegrationError('Invalid provider.');const {token}=await connectionToken(id);
 const response=await fetch('https://api.supabase.com/v1/'+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new IntegrationError('Supabase project access failed. Check OAuth Projects Read and Secrets Read scopes or reconnect.',503);
 return response.json();
}
export async function crmClient(){
 if(!configuredProvider('supabase_crm'))return null;const saved=await getConnection('supabase_crm');if(!saved?.metadata.project_ref||!saved.credentials.project_key)return null;
 await managementGet('supabase_crm','projects/'+saved.metadata.project_ref);
 return createClient('https://'+saved.metadata.project_ref+'.supabase.co',saved.credentials.project_key,{auth:{persistSession:false,autoRefreshToken:false}});
}

