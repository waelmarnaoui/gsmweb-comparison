import {fxDay,type DailyFx} from './ads-fx';
export const GOOGLE_USD_RON_URL='https://www.google.com/finance/quote/USD-RON?hl=en';
export function parseGoogleFinanceQuote(html:string,now=Date.now()):DailyFx{
 if(html.length>4_000_000||!html.includes('https://www.google.com/finance/quote/USD-RON'))throw new Error('Unexpected Google Finance response.');
 const matches:{rate:number;quoteAt:string}[]=[];
 // Parse JSON only: never evaluate scripts or select unrelated page prices.
 for(const script of html.split('<script').slice(1)){
  const end=script.indexOf('</script>');if(end<0)continue;
  const body=script.slice(0,end),start=body.indexOf('data:'),stop=body.lastIndexOf(', sideChannel:');
  if(start<0||stop<start||!body.includes('AF_initDataCallback'))continue;
  let data:unknown;try{data=JSON.parse(body.slice(start+5,stop));}catch{continue;}
  function visit(node:unknown,depth=0){
   if(!Array.isArray(node)||depth>20)return;
   if(node[2]==='USD / RON'&&node[21]==='USD-RON'&&Array.isArray(node[15])&&node[15][0]==='USD'&&node[15][1]==='RON'){
    const rate=Array.isArray(node[5])?node[5][0]:null,seconds=Array.isArray(node[11])?node[11][0]:null;
    if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=0||rate>100||typeof seconds!=='number'||!Number.isSafeInteger(seconds))throw new Error('Invalid Google Finance quote.');
    const quoted=seconds*1000;if(quoted>now+60000||now-quoted>4*86400000)throw new Error('Google Finance quote is stale or future dated.');
    matches.push({rate,quoteAt:new Date(quoted).toISOString()});return;
   }
   for(const child of node)visit(child,depth+1);
  }
  visit(data);
 }
 const unique=[...new Map(matches.map(quote=>[JSON.stringify(quote),quote])).values()];
 if(unique.length!==1)throw new Error('A unique USD/RON Google Finance quote was not found.');
 return {source:'google_finance_public',date:fxDay(now),capturedAt:new Date(now).toISOString(),...unique[0]};
}
export async function fetchGoogleFinanceQuote(fetcher:typeof fetch=fetch,now=Date.now()):Promise<DailyFx>{
 const response=await fetcher(GOOGLE_USD_RON_URL,{headers:{Accept:'text/html','Accept-Language':'en-US,en;q=0.9'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('Google Finance quote is unavailable.');
 const reader=response.body?.getReader();if(!reader)throw new Error('Google Finance response is empty.');
 const decoder=new TextDecoder();let html='',size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4_000_000)throw new Error('Google Finance response exceeds supported size.');html+=decoder.decode(value,{stream:true});}html+=decoder.decode();}
 finally{await reader.cancel().catch(()=>{});}
 return parseGoogleFinanceQuote(html,now);
}
