import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {IntegrationError} from './integration-error';
export function service(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase integration is not configured');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function requireAdmin(){
 const jar=await cookies();const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Supabase integration is not configured');
 const client=createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll:(values)=>{values.forEach(({name,value,options})=>jar.set(name,value,options));}}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new Error('Unauthorized');
 const {data}=await client.from('ga_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(!data)throw new Error('Forbidden');return {client,user};
}
export function apiError(error:unknown){if(error instanceof IntegrationError)return Response.json({error:error.message},{status:error.status});const message=error instanceof Error?error.message:'Request failed';const status=message==='Unauthorized'?401:message==='Forbidden'?403:message.includes('not configured')?503:400;return Response.json({error:status===503?'Integration is not configured':status===400?'Invalid request or integration failure':message},{status});}
