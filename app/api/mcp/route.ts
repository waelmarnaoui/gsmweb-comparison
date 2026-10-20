import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {allowedOrigin,authenticateMcp,authFailure,mcpConfig,McpAuthError,type McpConfig} from '@/lib/mcp/auth';
import {createGsmMcp,productionMcpServices} from '@/lib/mcp/server';
import {service} from '@/lib/server';

export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
  let config:McpConfig|undefined;
  try{
    config=mcpConfig();
    if(!allowedOrigin(request,config))return authFailure(403);
    const actor=await authenticateMcp(request,config,async subject=>{
      const r=await service().from('ga_admins').select('user_id').eq('user_id',subject).abortSignal(AbortSignal.timeout(5000)).maybeSingle();
      if(r.error)throw new McpAuthError(503);return !!r.data;
    });
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return new Response(null,{status:415});
    // Bound actual streamed bytes even when Content-Length is missing or forged.
    const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
    const chunks:Uint8Array[]=[];let length=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
    const body=Buffer.concat(chunks),parsed=JSON.parse(body.toString('utf8'));
    if(Array.isArray(parsed))return Response.json({error:'Batch requests are not supported'},{status:400});
    const server=createGsmMcp(await productionMcpServices(actor));
    const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    try{
      await server.connect(transport);
      const response=await transport.handleRequest(new Request(request.url,{method:'POST',headers:request.headers,body}),{parsedBody:parsed});
      // JSON mode: consume before closing per-request transport; never retain session state on Vercel.
      const responseBody=await response.arrayBuffer();
      return new Response(responseBody,{status:response.status,headers:{...Object.fromEntries(response.headers),'Cache-Control':'no-store'}});
    }finally{await server.close();}
  }catch(error){return authFailure(error instanceof McpAuthError?error.status:error instanceof SyntaxError?400:503,config);}
}
// No SSE subscription or stateful session is needed by this stateless server.
export function GET(){return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});}
export function DELETE(){return GET();}
