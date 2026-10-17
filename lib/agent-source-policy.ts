export const AGENT_REPOSITORY='waelmarnaoui/gsmweb-comparison';
export function sourcePath(value:unknown){
 if(typeof value!=='string'||value.length>180||!/^[a-zA-Z0-9_.\-/]+$/.test(value)||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..')||/(^|\/)(\.env[^/]*|\.git|node_modules|work|outputs|\.next|secrets?|credentials?[^/]*|service[-_]?account[^/]*|tokens?[^/]*)(\/|$)/i.test(value)||/\.(pem|key|pfx|dpapi|zip|sqlite|db)$/i.test(value))throw new Error('This is not an accessible source-code path.');
 return value;
}
export function sourceContent(text:string){
 if(text.length>50000||/-----BEGIN [\w ]*PRIVATE KEY-----|sk-ant-[a-zA-Z0-9_-]{20,}|AIza[a-zA-Z0-9_-]{30,}|AQ\.[a-zA-Z0-9._~-]{20,}|github_pat_[a-zA-Z0-9_]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|GOCSPX-[a-zA-Z0-9_-]{10,}|ya29\.[a-zA-Z0-9_-]{20,}|sb_secret_[a-zA-Z0-9_-]{10,}|eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\./.test(text))throw new Error('Source contains secret-like material or exceeds the reading limit.');
 return text;
}
export function validateSourceFiles(files:{path:string;content:string}[]){
 if(!Array.isArray(files)||files.length<1||files.length>8)throw new Error('A source change supports one to eight text files.');
 const seen=new Set<string>();let bytes=0;for(const f of files){sourcePath(f.path);if(seen.has(f.path))throw new Error('Duplicate source path.');seen.add(f.path);sourceContent(f.content);bytes+=f.content.length;}
 if(bytes>90000)throw new Error('Source change is too large. Split it into smaller changes.');return files;
}
export function sourceChecksReady(review:{status:string;statuses:{name:string;state:string}[];checks:{name:string;status:string;conclusion:string}[]}){
 return review.status==='success'&&review.statuses.some(s=>s.name==='Vercel'&&s.state==='success')&&review.checks.some(c=>c.name==='Agent validation'&&c.status==='completed'&&c.conclusion==='success')&&review.checks.every(c=>c.status==='completed'&&['success','skipped','neutral'].includes(c.conclusion));
}
