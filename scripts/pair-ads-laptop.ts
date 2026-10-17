import {generateKeyPairSync} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {openWorkerConfig,pairingHash} from '../lib/ads-control/pairing-crypto';
import {windowsProtect} from './ads-worker-dpapi';
import {ADS_WEB_ONLY} from '../lib/ads-web-mode';
async function main(){
 if(ADS_WEB_ONLY){console.info('Web-only mode: laptop pairing is disabled.');return;}
 const prompt=createInterface({input:stdin,output:stdout});
 let setupCode:string;try{setupCode=(await prompt.question('Paste the one-time laptop setup code from GSMWEB Account control: ')).trim();}finally{prompt.close();}
 pairingHash(setupCode);
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const response=await fetch('https://gsmweb-comparison.vercel.app/api/ai-ads/control/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({setupCode,publicKey}),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Pairing failed. Generate a new setup code in Account control.');
 const config=openWorkerConfig(await response.json(),privateKey);
 if(!config.SUPABASE_SERVICE_ROLE_KEY||!config.ADS_CONTROL_WORKER_REFRESH_TOKEN||!/^laptop-[a-f0-9-]{36}$/.test(config.ADS_CONTROL_RECOVERY_DEPLOYMENT_ID))throw new Error('Worker setup was incomplete.');
 const directory=path.resolve(process.env.ADS_WORKER_DIRECTORY??path.join(process.cwd(),'work','ads-laptop-runtime'));await mkdir(directory,{recursive:true});
 await writeFile(path.join(directory,'worker.dpapi'),await windowsProtect(JSON.stringify(config)),{mode:0o600});
 console.info('Laptop paired. Credentials are encrypted for your Windows user. Start GSMWEB recovery to send its first health check.');
}
void main().catch(()=>{console.error('Laptop setup could not complete. Check the setup code, internet connection and Windows secret storage. No credentials were displayed.');process.exitCode=1;});
