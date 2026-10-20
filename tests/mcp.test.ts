import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {authenticateMcp,mcpConfig,allowedOrigin,resourceMetadata} from '../lib/mcp/auth';
import {createDiagnosticReader,diagnosticWindow,diagnosticQuery,reportKinds} from '../lib/mcp/diagnostics';
import {createGsmMcp} from '../lib/mcp/server';

const config={resource:'https://gsmweb.example/api/mcp',issuer:'https://project.supabase.co/auth/v1',clients:['chatgpt-client'],redirects:['https://chatgpt.com/connector_platform_oauth_redirect']};
const subject='00000000-0000-0000-0000-000000000001';
test('connector is disabled and fails closed without explicit configuration',()=>{
  assert.throws(()=>mcpConfig({}));
  assert.throws(()=>mcpConfig({MCP_ENABLED:'true',APP_URL:'http://example.com',NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co'}));
  assert.equal(resourceMetadata(config).resource,config.resource);
  assert.equal(allowedOrigin(new Request(config.resource,{headers:{Origin:'https://evil.example'}}),config),false);
  assert.equal(allowedOrigin(new Request(config.resource),config),true);
});
test('JWT signature, audience, issuer, expiry, scope, client and current admin are all enforced',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('ES256');
  const sign=(patch:Record<string,unknown>={})=>new SignJWT({sub:subject,client_id:'chatgpt-client',scope:'openid',...patch}).setProtectedHeader({alg:'ES256'}).setIssuer(config.issuer).setAudience(config.resource).setIssuedAt().setExpirationTime('10m').sign(privateKey);
  const request=(token:string)=>new Request(config.resource,{headers:{Authorization:'Bearer '+token}});
  assert.equal(await authenticateMcp(request(await sign()),config,async()=>true,async()=>publicKey),subject);
  for(const patch of [{client_id:'other'},{scope:''},{sub:'unmapped'}])await assert.rejects(()=>sign(patch).then(t=>authenticateMcp(request(t),config,async()=>true,async()=>publicKey)));
  await assert.rejects(()=>sign().then(t=>authenticateMcp(request(t),config,async()=>false,async()=>publicKey)));
  const wrong=await new SignJWT({client_id:'chatgpt-client',scope:'openid'}).setProtectedHeader({alg:'ES256'}).setSubject(subject).setIssuer(config.issuer).setAudience('authenticated').setIssuedAt().setExpirationTime('10m').sign(privateKey);
  await assert.rejects(()=>authenticateMcp(request(wrong),config,async()=>true,async()=>publicKey));
  const expired=await new SignJWT({client_id:'chatgpt-client',scope:'openid'}).setProtectedHeader({alg:'ES256'}).setSubject(subject).setIssuer(config.issuer).setAudience(config.resource).setIssuedAt(1).setExpirationTime(2).sign(privateKey);
  await assert.rejects(()=>authenticateMcp(request(expired),config,async()=>true,async()=>publicKey));
  const other=await generateKeyPair('ES256');
  await assert.rejects(()=>sign().then(t=>authenticateMcp(request(t),config,async()=>true,async()=>other.publicKey)));
});
test('yesterday uses completed account days across timezone and daylight-saving boundaries',()=>{
  assert.deepEqual(diagnosticWindow(Date.parse('2026-10-20T00:30:00Z'),'America/Los_Angeles',1),{start:'2026-10-18',end:'2026-10-18'});
  assert.deepEqual(diagnosticWindow(Date.parse('2026-10-26T00:30:00Z'),'Europe/Bucharest',7),{start:'2026-10-19',end:'2026-10-25'});
  for(const kind of reportKinds)assert.ok(!diagnosticQuery(kind,'2026-10-01','2026-10-19').includes(':mutate'));
  assert.throws(()=>diagnosticQuery('arbitrary' as any,'2026-10-01','2026-10-19'));
});
const account='2050434247';
function reporting(fetcher:typeof fetch){return createDiagnosticReader({account,token:async()=> 'private-google-token',fetcher,now:()=>Date.parse('2026-10-20T10:00:00Z')});}
function identity(){return Response.json({results:[{customer:{id:account,currencyCode:'USD',timeZone:'Europe/Bucharest'}}]});}
test('diagnostics paginate without mutation and filter private search terms',async()=>{
  let calls=0;
  const report=await reporting(async(url,init)=>{
    assert.ok(String(url).endsWith('/googleAds:search'));
    assert.equal(init?.method,'POST');
    calls++;if(calls===1)return identity();
    if(calls===2)return Response.json({results:[{searchTermView:{searchTerm:'repair iphone display'}}],nextPageToken:'page2'});
    assert.equal(JSON.parse(String(init?.body)).pageToken,'page2');
    return Response.json({results:[{searchTermView:{searchTerm:'person@example.com'}}]});
  }).collect('search_terms',1);
  assert.equal(report.rows.length,1);assert.equal(report.privacyFiltered,1);assert.equal(report.start,'2026-10-19');assert.equal(report.currency,'USD');
  assert.ok(!JSON.stringify(report).includes('private-google-token'));
});
test('identity mismatch, quota errors, repeated pages and oversized reports never return partial totals',async()=>{
  for(const mode of ['identity','quota','repeat','oversize']){
    let calls=0;
    await assert.rejects(()=>reporting(async()=>{
      calls++;if(calls===1)return mode==='identity'?Response.json({results:[{customer:{id:'9999999999',currencyCode:'USD',timeZone:'UTC'}}]}):identity();
      if(mode==='quota')return new Response('secret provider body',{status:429});
      if(mode==='oversize')return Response.json({results:Array.from({length:5001},()=>({metrics:{clicks:'1'}}))});
      return Response.json({results:[],nextPageToken:'same'});
    }).collect('campaigns',7));
  }
});
test('real MCP client discovers only read tools by default; unknown execution tools fail',async()=>{
  const server=createGsmMcp({report:async()=>({currency:'USD'}),tracking:async()=>({saved:true})});
  const client=new Client({name:'test-client',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(a);await client.connect(b);
    const tools=await client.listTools();assert.deepEqual(tools.tools.map(t=>t.name).sort(),['ads_diagnostic_report','conversion_tracking_health']);
    assert.ok(tools.tools.every(t=>t.annotations?.readOnlyHint));
    assert.ok((await client.callTool({name:'ads_diagnostic_report',arguments:{section:'campaigns',days:1}})).content);
    assert.equal((await client.callTool({name:'execute_action',arguments:{}})).isError,true);
  }finally{await client.close();await server.close();}
});
test('optional optimization tool creates a proposal only; approval/execution are never advertised',async()=>{
  let proposed=0;
  const server=createGsmMcp({report:async()=>({}),tracking:async()=>({}),propose:async()=>{proposed++;return {executed:false};}});
  const client=new Client({name:'test-client',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
  try{
    await server.connect(a);await client.connect(b);const {tools}=await client.listTools();
    assert.equal(tools.length,3);assert.ok(!tools.some(t=>/approve|execute/.test(t.name)));
    await client.callTool({name:'propose_cost_reduction',arguments:{kind:'budget_decrease',resource:`customers/${account}/campaignBudgets/1`,value:'10000000',requestId:'8712940a-4e25-422f-b3c5-e831787656da'}});
    assert.equal(proposed,1);
  }finally{await client.close();await server.close();}
});
test('stateless HTTP transport initializes and serves tools on independent requests',async()=>{
  for(const message of [{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}},{jsonrpc:'2.0',id:2,method:'tools/list',params:{}}]){
    const server=createGsmMcp({report:async()=>({}),tracking:async()=>({})});
    const transport=new WebStandardStreamableHTTPServerTransport({enableJsonResponse:true,sessionIdGenerator:undefined});
    try{
      await server.connect(transport);
      const response=await transport.handleRequest(new Request(config.resource,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify(message)}));
      assert.equal(response.status,200);const body=await response.json();assert.equal(body.id,message.id);assert.ok(body.result);
    }finally{await server.close();}
  }
});
