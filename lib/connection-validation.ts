import {IntegrationError} from './integration-error';
export function validateOAuthState(state:{userId:string;expires:number;nonce:string},userId:string,nonce:string|null,now=Date.now()){
 if(state.userId!==userId||!Number.isFinite(state.expires)||state.expires<=now||!nonce||state.nonce!==nonce)throw new IntegrationError('Connection sign-in state did not match. Start again.');
}
export function validateRequestOrigin(origin:string|null,expected:string){if(origin!==expected)throw new IntegrationError('Request origin rejected.',403);}
type OriginEnvironment={APP_URL?:string;VERCEL?:string;VERCEL_ENV?:string;VERCEL_URL?:string;VERCEL_PROJECT_PRODUCTION_URL?:string};
export function validateAppRequestOrigin(origin:string|null,env:OriginEnvironment){
 const allowed=new Set<string>();
 if(env.APP_URL){try{const url=new URL(env.APP_URL.trim());if(!url.username&&!url.password&&(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))allowed.add(url.origin);}catch{/* Invalid configuration is not a trusted origin. */}}
 if(env.VERCEL==='1'){
  // Only server-provided deployment hosts are trusted, never request Host headers.
  const hosts=[env.VERCEL_URL,...(env.VERCEL_ENV==='production'?[env.VERCEL_PROJECT_PRODUCTION_URL]:[])];
  for(const host of hosts){if(host&&/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)&&host.includes('.'))allowed.add('https://'+host.toLowerCase());}
 }
 if(!allowed.size)throw new IntegrationError('Application address is not configured. Set APP_URL to the dashboard HTTPS address.',503);
 if(!origin||!allowed.has(origin))throw new IntegrationError('Request origin rejected. Open the configured dashboard address, or check APP_URL in Vercel and redeploy.',403);
}

