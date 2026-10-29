import {apiError,requireAdmin} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
import {generatePmax,googlePmax,pmaxRows,pollPmax,savePmax,submitPmax} from '@/lib/pmax/server';
import {ZodError} from 'zod';
import {ControlProviderError} from '@/lib/ads-control/google';
export const maxDuration=120;
export async function GET(){try{const {user}=await requireAdmin();return Response.json({rows:await pmaxRows(user.id)},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const text=await request.text();if(Buffer.byteLength(text)>100000)throw new IntegrationError('Request too large.',413);const body=JSON.parse(text);let result;
 if(body.operation==='catalogue'){
  try{result=await googlePmax().catalogue();}catch(error){
   if(error instanceof ControlProviderError)throw new IntegrationError('Google locations and images could not be loaded: '+[error.code,...error.diagnostics].join(' · ')+(error.httpStatus===429?'. Google API quota was reached. Retry manually later; no automatic retry was made.':'. Check the Google Ads connection and account access.'),error.httpStatus===429?429:503);
   throw new IntegrationError(error instanceof Error?error.message:'Google locations and images are unavailable.',503);
  }
 }
 else if(body.operation==='generate')result=await generatePmax(user.id,body.settings);
 else if(body.operation==='poll')result=await pollPmax(user.id,body.id);
 else if(body.operation==='save')result=await savePmax(user.id,body.id,body.draft,body.version);
 else if(body.operation==='publish'&&typeof body.hash==='string'&&/^[a-f0-9]{64}$/.test(body.hash)&&body.confirmed===true)result=await submitPmax(user.id,body.id,body.hash,true);
 else throw new IntegrationError('Choose a valid Performance Max action.');
 return Response.json({result},{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error instanceof ZodError?new IntegrationError('Check campaign fields and ad lengths: '+error.issues.slice(0,3).map(issue=>issue.path.join('.')+': '+issue.message).join('; ')):error);}}
