import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {windowsProtect} from './ads-worker-dpapi';
const directory=path.resolve(process.env.ADS_WORKER_DIRECTORY??path.join(process.cwd(),'work','ads-laptop-runtime'));
let stopping=false,children:ReturnType<typeof spawn>[]=[];
process.on('SIGINT',()=>{stopping=true;children.forEach(child=>child.kill());});process.on('SIGTERM',()=>{stopping=true;children.forEach(child=>child.kill());});
async function main(){
 await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'host.pid'),String(process.pid));
 while(!stopping){
  try{
   const encrypted=await readFile(path.join(directory,'worker.dpapi'),'utf8'),config=JSON.parse(await windowsProtect(encrypted,true)) as Record<string,string>;
   children=['ads-recovery-worker.ts','ads-stock-worker.ts'].map(script=>spawn(process.execPath,[path.resolve('node_modules/tsx/dist/cli.mjs'),path.resolve('scripts',script)],{windowsHide:true,stdio:'inherit',env:{...process.env,...config}}));
   await Promise.race(children.map(child=>new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.once('error',()=>resolve());})));
   children.forEach(child=>child.kill());
  }catch{console.error('Laptop recovery could not start. Complete pairing and check Windows credential storage.');}
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,30000));
 }
}
void main().catch(()=>{console.error('Laptop recovery stopped.');process.exitCode=1;});
