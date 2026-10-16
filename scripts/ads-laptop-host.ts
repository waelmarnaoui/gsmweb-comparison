import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {windowsProtect} from './ads-worker-dpapi';
const directory=path.resolve(process.env.ADS_WORKER_DIRECTORY??path.join(process.cwd(),'work','ads-laptop-runtime'));
let stopping=false,child:ReturnType<typeof spawn>|null=null;
process.on('SIGINT',()=>{stopping=true;child?.kill();});process.on('SIGTERM',()=>{stopping=true;child?.kill();});
async function main(){
 await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'host.pid'),String(process.pid));
 while(!stopping){
  try{
   const encrypted=await readFile(path.join(directory,'worker.dpapi'),'utf8'),config=JSON.parse(await windowsProtect(encrypted,true)) as Record<string,string>;
   child=spawn(process.execPath,[path.resolve('node_modules/tsx/dist/cli.mjs'),path.resolve('scripts/ads-recovery-worker.ts')],{windowsHide:true,stdio:'inherit',env:{...process.env,...config}});
   await new Promise<void>(resolve=>{child!.once('exit',()=>resolve());child!.once('error',()=>resolve());});
  }catch{console.error('Laptop recovery could not start. Complete pairing and check Windows credential storage.');}
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,30000));
 }
}
void main().catch(()=>{console.error('Laptop recovery stopped.');process.exitCode=1;});
