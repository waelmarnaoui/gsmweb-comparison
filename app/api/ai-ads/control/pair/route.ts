import {redeemLaptopPairing} from '@/lib/ads-control/pairing-server';
import {apiError} from '@/lib/server';
export const maxDuration=30;
export async function POST(request:Request){try{
 // This endpoint is for the local worker, authenticated by a single-use 256-bit
 // setup capability. It returns only an envelope for that worker's RSA key.
 const text=await request.text();if(text.length>8000)throw new Error('Invalid setup request.');
 const input=JSON.parse(text);if(typeof input.setupCode!=='string'||typeof input.publicKey!=='string'||input.publicKey.length>2000)throw new Error('Invalid setup request.');
 return Response.json(await redeemLaptopPairing(input.setupCode,input.publicKey),{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
