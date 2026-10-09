import {requireAdmin} from '@/lib/server';
import {appOrigin,completeAuthorization,ConnectionId} from '@/lib/connections';
import {IntegrationError} from '@/lib/integration-error';
import {NextResponse} from 'next/server';
export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
 const target=new URL('/connections',appOrigin());
 try{const {user}=await requireAdmin();const {provider}=await params;
 if(!['google','supabase_calls','supabase_crm'].includes(provider))throw new IntegrationError('Unknown connection.');
 await completeAuthorization(provider as ConnectionId,user.id,new URL(request.url));target.searchParams.set('connected',provider);
 }catch(error){target.searchParams.set('error',error instanceof IntegrationError?error.message:'Connection failed. Sign in to the app and try again.');}
 const response=NextResponse.redirect(target);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
