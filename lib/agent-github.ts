import 'server-only';
import {getConnection,saveConnection} from './connections';
import {AGENT_REPOSITORY,sourcePath,sourceContent,validateSourceFiles,sourceChecksReady} from './agent-source-policy';
import {IntegrationError} from './integration-error';
export async function sourceReady(){const c=await getConnection('agent_github');return {configured:!!c?.credentials.access_token,repository:AGENT_REPOSITORY,notice:'Repository Contents and Pull requests read/write plus Checks read are needed. Code changes create a reviewable pull request. Deployment approval happens in this app.'};}
export function githubApi(token:string,fetcher:typeof fetch=fetch){
 return async(path:string,method='GET',body?:unknown)=>{
  if(!path.startsWith('/repos/'+AGENT_REPOSITORY+'/')&&path!=='/repos/'+AGENT_REPOSITORY)throw new Error('Repository scope mismatch.');
  let r:Response;try{r=await fetcher('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});}catch{throw new Error('GitHub request unconfirmed.');}
  if(!r.ok)throw new IntegrationError(r.status===401||r.status===403?'GitHub connection lacks the required repository permissions.':'GitHub did not confirm this operation. Inspect the job before retrying.',503);
  return r.status===204?{}:await r.json();
 };
}
export async function repositoryApi(){const c=await getConnection('agent_github');if(!c?.credentials.access_token)throw new IntegrationError('Connect GitHub in Agent access to enable source changes.',503);return githubApi(c.credentials.access_token);}
export async function connectSource(actor:string,token:unknown){
 if(typeof token!=='string'||! /^(github_pat_[A-Za-z0-9_]{20,250}|ghp_[A-Za-z0-9]{20,250})$/.test(token))throw new IntegrationError('Enter a GitHub repository token in the secure form, not chat.',400);
 const api=githubApi(token),repo=await api('/repos/'+AGENT_REPOSITORY);if(repo.full_name!==AGENT_REPOSITORY||repo.permissions?.push!==true)throw new IntegrationError('The token must allow writing the GSMWEB repository.',400);
 await api('/repos/'+AGENT_REPOSITORY+'/pulls?state=open&per_page=1');
 await saveConnection('agent_github',{access_token:token,refresh_token:'',expires_at:0},{repository:AGENT_REPOSITORY,verified_at:new Date().toISOString()},actor);return sourceReady();
}
export async function sourceList(){const api=await repositoryApi(),head=await api('/repos/'+AGENT_REPOSITORY+'/git/ref/heads/main'),commit=await api('/repos/'+AGENT_REPOSITORY+'/git/commits/'+head.object.sha),tree=await api('/repos/'+AGENT_REPOSITORY+'/git/trees/'+commit.tree.sha+'?recursive=1');if(tree.truncated)throw new Error('Source tree incomplete.');return {revision:head.object.sha,files:tree.tree.filter((x:any)=>x.type==='blob').map((x:any)=>{try{return sourcePath(x.path);}catch{return null;}}).filter(Boolean).slice(0,1500)};}
export async function sourceRead(path:string){sourcePath(path);const api=await repositoryApi(),r=await api('/repos/'+AGENT_REPOSITORY+'/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref=main');if(r.type!=='file'||r.encoding!=='base64'||r.size>50000)throw new Error('Not a readable text source file.');return {path,revision:r.sha,content:sourceContent(Buffer.from(r.content,'base64').toString('utf8'))};}
export async function createSourcePullRequest(id:string,payload:{title:string;description:string;files:{path:string;content:string}[]}){
 validateSourceFiles(payload.files);const api=await repositoryApi(),base='/repos/'+AGENT_REPOSITORY,head=await api(base+'/git/ref/heads/main'),commit=await api(base+'/git/commits/'+head.object.sha);
 const tree=await api(base+'/git/trees','POST',{base_tree:commit.tree.sha,tree:payload.files.map(f=>({path:f.path,mode:'100644',type:'blob',content:f.content}))});
 const made=await api(base+'/git/commits','POST',{message:payload.title,tree:tree.sha,parents:[head.object.sha]}),branch='gsmweb-agent/'+id;
 await api(base+'/git/refs','POST',{ref:'refs/heads/'+branch,sha:made.sha});
 const pr=await api(base+'/pulls','POST',{title:payload.title,body:payload.description+'\n\nCreated from the authenticated GSMWEB in-app agent. Review the diff and deployment checks before approving deployment in the app.',head:branch,base:'main',draft:false});
 return {status:'awaiting_review',number:pr.number,url:pr.html_url,head:made.sha,base:head.object.sha,branch,files:payload.files.map(f=>f.path)};
}
export async function sourceReview(result:{number:number;head:string}){
 const api=await repositoryApi(),base='/repos/'+AGENT_REPOSITORY,pr=await api(base+'/pulls/'+result.number);if(pr.head.sha!==result.head)throw new Error('Source revision changed.');
 const files=await api(base+'/pulls/'+result.number+'/files?per_page=100');if(pr.changed_files>100)throw new Error('Review too large.');
 const status=await api(base+'/commits/'+result.head+'/status'),checks=await api(base+'/commits/'+result.head+'/check-runs?per_page=100');
 return {url:pr.html_url,head:pr.head.sha,base:pr.base.sha,merged:pr.merged,mergeable:pr.mergeable,status:status.state,statuses:(status.statuses??[]).map((s:any)=>({name:s.context,state:s.state})),checks:(checks.check_runs??[]).map((c:any)=>({name:c.name,status:c.status,conclusion:c.conclusion})),files:files.map((f:any)=>({path:f.filename,status:f.status,patch:f.patch?sourceContent(f.patch):'Diff unavailable; inspect the repository before approval.'}))};
}
export async function mergeSourceChange(result:{number:number;head:string}){
 const review=await sourceReview(result);if(review.merged)return {status:'merged',url:review.url};
 if(!sourceChecksReady(review))throw new IntegrationError('Source deployment checks are pending or failed. The change was not merged.',409);
 const api=await repositoryApi(),r=await api('/repos/'+AGENT_REPOSITORY+'/pulls/'+result.number+'/merge','PUT',{sha:result.head,merge_method:'merge'});if(r.merged!==true)throw new Error('Merge not confirmed.');return {status:'merged',commit:r.sha,url:review.url,notice:'Merged after owner approval and checks. Production deployment is separate and must finish before claiming the feature is live.'};
}
