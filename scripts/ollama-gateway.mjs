import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

const directory=join(homedir(),'.gsmweb-ollama');
mkdirSync(directory,{recursive:true,mode:0o700});
const tokenFile=join(directory,'gateway-token.txt');
let token;
try{token=readFileSync(tokenFile,'utf8').trim();}catch(error){if(error.code!=='ENOENT')throw error;token=randomBytes(32).toString('hex');writeFileSync(tokenFile,token,{mode:0o600,flag:'wx'});}
if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid local gateway token file.');
let active=false;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const supplied=Buffer.from(req.headers.authorization??''),expected=Buffer.from('Bearer '+token);
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){res.writeHead(401).end();return;}
 if(req.method!=='POST'||req.url!=='/v1/chat/completions'){res.writeHead(404).end();return;}
 if(active){res.writeHead(429).end();return;}
 active=true;
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32000){res.writeHead(413).end();return;}}
  const body=JSON.parse(raw);
  if(body.model!=='llama3.1:8b'||body.stream!==false||body.tools||!Array.isArray(body.messages)){res.writeHead(400).end();return;}
  const response=await fetch('http://127.0.0.1:11434/v1/chat/completions',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama3.1:8b',messages:body.messages,stream:false,temperature:0,max_tokens:800,response_format:{type:'json_object'}}),signal:AbortSignal.timeout(85000)});
  const text=await response.text();if(text.length>100000)throw new Error('Oversized response');
  res.writeHead(response.status,{'Content-Type':'application/json'}).end(text);
 }catch{if(!res.headersSent)res.writeHead(502);res.end();}finally{active=false;}
});
server.requestTimeout=100000;
server.listen(11435,'127.0.0.1',()=>console.log('Protected Ollama gateway ready on 127.0.0.1:11435. Token file: '+tokenFile+'. Keep it private.'));
