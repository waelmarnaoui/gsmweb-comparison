import http from 'node:http';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function createGateway({token,fetcher=fetch,jobTimeout=1800000}){
 const jobs=new Map();let active=false;
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 async function complete(body,timeout){
  const response=await fetcher('http://127.0.0.1:11434/api/chat',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama3.1:8b',messages:body.messages,stream:false,keep_alive:'15m',options:{temperature:0,num_ctx:8192,num_predict:2400},format:body.response_format?.json_schema?.schema??'json'}),signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error('Provider unavailable');
  const raw=await response.text();if(raw.length>100000)throw new Error('Oversized response');
  const result=JSON.parse(raw);
  return {choices:[{finish_reason:result.done_reason==='length'?'length':result.done===true?'stop':'incomplete',message:{role:'assistant',content:result.message?.content}}]};
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const supplied=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+token);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){res.writeHead(401).end();return;}
  const send=(status,data)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(data));
  for(const [id,job] of jobs)if(Date.now()-job.createdAt>3600000&&job.state!=='pending')jobs.delete(id);
  if(req.method==='GET'&&req.url?.startsWith('/v1/jobs/')){
   const id=req.url.slice('/v1/jobs/'.length);if(!uuid.test(id)){res.writeHead(404).end();return;}
   const job=jobs.get(id);if(!job){res.writeHead(404).end();return;}
   send(200,{id,state:job.state,...(job.result?{result:job.result}:{}),...(job.error?{error:job.error}:{})});return;
  }
  if(req.method!=='POST'||!['/v1/chat/completions','/v1/jobs'].includes(req.url)){res.writeHead(404).end();return;}
  let ownsActive=false;
  try{
   req.setEncoding('utf8');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32000){res.writeHead(413).end();return;}}
   const input=JSON.parse(raw),isJob=req.url==='/v1/jobs',body=isJob?input.request:input;
   if(!body||body.model!=='llama3.1:8b'||body.stream!==false||body.tools||!Array.isArray(body.messages)||body.messages.length>8||body.messages.some(m=>!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')||(isJob&&!uuid.test(input.id))){res.writeHead(400).end();return;}
   if(isJob&&jobs.has(input.id)){
    const job=jobs.get(input.id);if(job.digest!==createHash('sha256').update(JSON.stringify(body)).digest('hex')){res.writeHead(409).end();return;}
    send(200,{id:input.id,state:job.state});return;
   }
   if(active||jobs.size>=50){res.writeHead(429).end();return;}
   active=true;ownsActive=true;
   if(isJob){
    const job={createdAt:Date.now(),state:'pending',digest:createHash('sha256').update(JSON.stringify(body)).digest('hex')};jobs.set(input.id,job);
    // Work stays in this long-lived local process, never in a Vercel invocation.
    void complete(body,jobTimeout).then(result=>{job.result=result;job.state='completed';}).catch(error=>{job.error=['TimeoutError','AbortError'].includes(error.name)?'timeout':'unavailable';job.state='failed';}).finally(()=>{active=false;});
    ownsActive=false;send(202,{id:input.id,state:'pending'});return;
   }
   send(200,await complete(body,230000));
  }catch(error){if(!res.headersSent)res.writeHead(['TimeoutError','AbortError'].includes(error.name)?504:502);res.end();}finally{if(ownsActive)active=false;}
 });
 server.requestTimeout=250000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const directory=join(homedir(),'.gsmweb-ollama');mkdirSync(directory,{recursive:true,mode:0o700});
 const tokenFile=join(directory,'gateway-token.txt');let token;
 try{token=readFileSync(tokenFile,'utf8').trim();}catch(error){if(error.code!=='ENOENT')throw error;token=randomBytes(32).toString('hex');writeFileSync(tokenFile,token,{mode:0o600,flag:'wx'});}
 if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid local gateway token file.');
 createGateway({token}).listen(11435,'127.0.0.1',()=>console.log('Protected Ollama gateway ready on 127.0.0.1:11435. Background chat limit: 30 minutes. Token file: '+tokenFile+'. Keep it private.'));
}
