import {requireAdmin,apiError} from '@/lib/server';
import {connectionToken,sameOrigin} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
export async function POST(request:Request){try{
 await requireAdmin();sameOrigin(request);if(!process.env.GOOGLE_PICKER_API_KEY||!process.env.GOOGLE_CLOUD_PROJECT_NUMBER)throw new IntegrationError('Google Picker API key and project number are not configured.',503);
 const {token}=await connectionToken('google');
 // Picker requires a short-lived Google token in memory. Never return refresh tokens or Supabase keys.
 return Response.json({token,apiKey:process.env.GOOGLE_PICKER_API_KEY,appId:process.env.GOOGLE_CLOUD_PROJECT_NUMBER},{headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
 }catch(error){return apiError(error);}}
