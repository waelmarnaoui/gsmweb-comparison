import {requireAdmin} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {mcpConfig} from '@/lib/mcp/auth';

const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function html(content:string,status=200){return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect GSMWEB</title><main><h1>Connect GSMWEB to ChatGPT</h1>${content}</main></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
function authorizationId(value:unknown){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(value))throw new Error('Invalid authorization');return value;}
function callback(value:string,allowed:string[]){
  const url=new URL(value);
  if(!allowed.some(uri=>{const candidate=new URL(uri);return url.origin===candidate.origin&&url.pathname===candidate.pathname&&!candidate.search&&!candidate.hash;}))throw new Error('Unexpected callback');
  return value;
}
export async function GET(request:Request){
  try{
    const config=mcpConfig(),{client}=await requireAdmin();
    const id=authorizationId(new URL(request.url).searchParams.get('authorization_id'));
    const {data,error}=await client.auth.oauth.getAuthorizationDetails(id);
    if(error||!data)throw new Error('Authorization unavailable');
    if('redirect_url' in data)return Response.redirect(callback(data.redirect_url,config.redirects),303);
    if(!config.clients.includes(data.client.id)||!config.redirects.includes(data.redirect_uri)||data.scope.split(' ').some(s=>s!=='openid'))throw new Error('Client outside scope');
    return html(`<p><strong>${escape(data.client.name)}</strong> requests access to Google Ads reports and aggregate conversion tracking for the configured GSMWEB account.</p><p>This does not authorize live ad changes. Cost reduction proposals, if enabled separately, require review and approval in GSMWEB.</p><p>Requested scope: ${escape(data.scope)}. Return address: ${escape(data.redirect_uri)}</p><form method="post"><input type="hidden" name="authorization_id" value="${escape(id)}"><button name="decision" value="approve">Allow access</button> <button name="decision" value="deny">Deny</button></form>`);
  }catch{return html('<p>Sign in to GSMWEB as an administrator in another tab, then reload this page. If already signed in, this request may be expired or the connector may need configuration.</p><a href="/login" target="_blank" rel="noopener noreferrer">Sign in</a>',403);}
}
export async function POST(request:Request){
  try{
    sameOrigin(request);const config=mcpConfig(),{client}=await requireAdmin();
    if(Number(request.headers.get('content-length')??0)>2048)throw new Error('Request too large');
    const form=await request.formData(),id=authorizationId(form.get('authorization_id')),decision=form.get('decision');
    const details=await client.auth.oauth.getAuthorizationDetails(id);
    if(details.error||!details.data||'redirect_url' in details.data)throw new Error('Authorization already resolved');
    if(!config.clients.includes(details.data.client.id)||!config.redirects.includes(details.data.redirect_uri)||details.data.scope.split(' ').some(s=>s!=='openid'))throw new Error('Invalid client');
    if(decision!=='approve'&&decision!=='deny')throw new Error('Choose a decision');
    const {data,error}=await(decision==='approve'?client.auth.oauth.approveAuthorization(id,{skipBrowserRedirect:true}):client.auth.oauth.denyAuthorization(id,{skipBrowserRedirect:true}));
    if(error||!data)throw new Error('Consent failed');
    return Response.redirect(callback(data.redirect_url,config.redirects),303);
  }catch{return html('<p>Consent was not completed. Start the connection again from ChatGPT.</p>',400);}
}
