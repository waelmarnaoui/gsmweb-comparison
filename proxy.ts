import {createServerClient} from '@supabase/ssr';
import {NextRequest,NextResponse} from 'next/server';

export async function proxy(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.next();
 let response=NextResponse.next({request});
 const client=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){
  values.forEach(({name,value})=>request.cookies.set(name,value));
  response=NextResponse.next({request});
  values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
 }}});
 const {data:{user}}=await client.auth.getUser();
 if(!user&&['/','/connections','/crm'].includes(request.nextUrl.pathname)){
  const redirect=NextResponse.redirect(new URL('/login',request.url));
  response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));
  return redirect;
 }
 return response;
}
export const config={matcher:['/','/login','/connections','/crm','/api/crm/:path*','/api/integrations/:path*','/api/dashboard','/api/connections','/api/settings','/api/import/sheets','/api/attribution/:path*','/api/conversions/export']};

