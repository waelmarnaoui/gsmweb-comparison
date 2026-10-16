/** Optional always-on scheduler. Does not require a browser or Vercel account access. */
export {};
const appOrigin=new URL(process.env.APP_URL??'');
if(appOrigin.protocol!=='https:'||appOrigin.pathname!=='/'||appOrigin.username||appOrigin.password||appOrigin.search||appOrigin.hash)throw new Error('Set the production APP_URL origin.');
const secret=process.env.ADS_CONTROL_CRON_SECRET;
if(!secret||secret.length<32)throw new Error('Stock worker authentication is not configured.');
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function main(){
 do{
  const started=Date.now();
  try{
   const response=await fetch(new URL('/api/ai-ads/control/tick',appOrigin),{method:'POST',headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(280000)});
   if(!response.ok)throw new Error('Stock check failed.');
   const data=await response.json();if(data.checked!==true||data.changesConfirmed===false)throw new Error('Stock result invalid or synchronization failed.');
   console.info(data.reliable?'Stock control check completed.':'Stock source unavailable; no automatic change confirmed.');
  }catch{console.error('Stock control check failed. Review worker health in Account control.');}
  if(process.argv.includes('--once'))break;
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,Math.max(1000,60000-(Date.now()-started))));
 }while(!stopping);
}
void main().catch(()=>{console.error('Stock worker stopped.');process.exitCode=1;});
