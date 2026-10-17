import {redeemLaptopPairing} from '@/lib/ads-control/pairing-server';
import {apiError} from '@/lib/server';
import {ADS_WEB_ONLY} from '@/lib/ads-web-mode';
export const maxDuration=30;
export async function POST(request:Request){try{
 if(ADS_WEB_ONLY)return Response.json({error:'Laptop pairing is disabled in web-only mode.'},{status:410});
 // This endpoint is for the local worker, authenticated by a single-use 256-bit
 // setup capability. It returns only an envelope for that worker's RSA key.
 const text=await request.text();if(text.length>8000)throw new Error('Invalid setup request.');
 const input=JSON.parse(text);if(typeof input.setupCode!=='string'||typeof input.publicKey!=='string'||input.publicKey.length>2000)throw new Error('Invalid setup request.');
 return Response.json(await redeemLaptopPairing(input.setupCode,input.publicKey),{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
