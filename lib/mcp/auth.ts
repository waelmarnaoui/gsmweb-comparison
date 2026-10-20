import {createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey} from 'jose';

export type McpConfig = {resource:string; issuer:string; clients:string[]; redirects:string[]};
export class McpAuthError extends Error {
  constructor(public status:401|403|503) { super('MCP access denied'); }
}
export function mcpConfig(env:Record<string,string|undefined>=process.env):McpConfig {
  if(env.MCP_ENABLED!=='true')throw new McpAuthError(503);
  const app=new URL(env.APP_URL??''), supabase=new URL(env.NEXT_PUBLIC_SUPABASE_URL??'');
  if(app.protocol!=='https:'||supabase.protocol!=='https:'||app.username||app.password)throw new McpAuthError(503);
  const clients=(env.MCP_OAUTH_CLIENT_IDS??'').split(',').map(x=>x.trim()).filter(Boolean);
  const redirects=(env.MCP_OAUTH_REDIRECT_URIS??'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!clients.length||!redirects.length)throw new McpAuthError(503);
  for(const uri of redirects)if(new URL(uri).protocol!=='https:')throw new McpAuthError(503);
  return {resource:app.origin+'/api/mcp',issuer:supabase.origin+'/auth/v1',clients,redirects};
}
export function resourceMetadata(c:McpConfig){return {resource:c.resource,authorization_servers:[c.issuer],scopes_supported:['openid'],bearer_methods_supported:['header']};}
export function allowedOrigin(request:Request,c:McpConfig){
  const origin=request.headers.get('origin');
  return !origin||[new URL(c.resource).origin,'https://chatgpt.com'].includes(origin);
}
let cached:{issuer:string;keys:ReturnType<typeof createRemoteJWKSet>}|undefined;
export async function authenticateMcp(request:Request,c:McpConfig,isAdmin:(subject:string)=>Promise<boolean>,keys?:JWTVerifyGetKey){
  const header=request.headers.get('authorization');
  if(!header||header.length>16384||!/^Bearer [A-Za-z0-9_.-]+$/.test(header))throw new McpAuthError(401);
  if(!keys){
    if(cached?.issuer!==c.issuer)cached={issuer:c.issuer,keys:createRemoteJWKSet(new URL(c.issuer+'/.well-known/jwks.json'),{timeoutDuration:5000,cooldownDuration:30000})};
    keys=cached!.keys;
  }
  let payload;
  try{({payload}=await jwtVerify(header.slice(7),keys,{issuer:c.issuer,audience:c.resource,algorithms:['RS256','ES256'],requiredClaims:['sub','exp','iat','client_id'],maxTokenAge:'15m',clockTolerance:5}));}
  catch{throw new McpAuthError(401);}
  if(!payload.sub||!/^[a-f0-9-]{36}$/i.test(payload.sub)||typeof payload.client_id!=='string'||!c.clients.includes(payload.client_id)||typeof payload.scope!=='string'||!payload.scope.split(' ').includes('openid'))throw new McpAuthError(403);
  // A fresh database authorization check precedes every request. Never trust user_metadata.
  if(!await isAdmin(payload.sub))throw new McpAuthError(403);
  return payload.sub;
}
export function authFailure(status:number,c?:McpConfig){
  return Response.json({error:status===503?'Connector is not configured':status===403?'Forbidden':'Authorization required'},{status,headers:{'Cache-Control':'no-store',...(status===401&&c?{'WWW-Authenticate':`Bearer resource_metadata="${new URL(c.resource).origin}/.well-known/oauth-protected-resource/api/mcp"`}:{})}});
}
