/** Optional always-on scheduler. Does not require a browser or Vercel account access. */
export {};
const appOrigin=new URL(process.env.APP_URL??'');
if(appOrigin.protocol!=='https:'||appOrigin.pathname!=='/'||appOrigin.username||appOrigin.password||appOrigin.search||appOrigin.hash)throw new Error('Set the production APP_URL origin.');
const secret=process.env.ADS_CONTROL_CRON_SECRET;
if(!secret||secret.length<32)throw new Error('Stock worker authentication is not configured.');
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function main(){
 let failures=0;
 do{
  const started=Date.now();let delay=60000;
  try{
   const response=await fetch(new URL('/api/ai-ads/control/tick',appOrigin),{method:'POST',headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(280000)});
   if(!response.ok){const retry=Number(response.headers.get('retry-after'));if(Number.isFinite(retry)&&retry>0)delay=Math.min(3600000,Math.max(60000,retry*1000));throw new Error('Stock check failed.');}
   const data=await response.json();if(data.checked!==true||data.changesConfirmed===false)throw new Error('Stock result invalid or synchronization failed.');
   console.info(data.reliable?'Stock control check completed.':'Stock source unavailable; no automatic change confirmed.');
   failures=0;
  }catch{failures++;delay=Math.max(delay,Math.min(900000,60000*2**Math.min(failures-1,4)));console.error('Stock control check failed. Backing off; review worker health in Account control.');}
  if(process.argv.includes('--once'))break;
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,Math.max(1000,delay-(Date.now()-started))));
 }while(!stopping);
}
void main().catch(()=>{console.error('Stock worker stopped.');process.exitCode=1;});
