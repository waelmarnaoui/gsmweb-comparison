import {requireAdmin,apiError} from '@/lib/server';
import {sheetsConfigured,readClickSheet} from '@/lib/sheets';
import {parseClickRows} from '@/lib/sheet-parser';
import {IntegrationError} from '@/lib/integration-error';
import {crmClient,configuredProvider} from '@/lib/connections';
import {CALLS_VISIBLE_FROM_UTC} from '@/lib/call-visibility';
export async function GET(){try{
 const {client}=await requireAdmin();const calls=await client.from('ga_calls').select('id',{head:true,count:'exact'}).gte('started_at',CALLS_VISIBLE_FROM_UTC);if(calls.error)throw calls.error;
 const remoteCrm=await crmClient(),needsSelection=configuredProvider('supabase_crm')&&!remoteCrm;const crmSource=remoteCrm||client;
 const crm=await Promise.all(['Client','Repair','GoogleAdsLeads','PaymentTransaction','RepairSettlement','SaleSettlement'].map(t=>crmSource.from(t).select('*',{head:true,count:'exact'}).limit(1)));const missing=crm.map((r,i)=>r.error?['Client','Repair','GoogleAdsLeads','PaymentTransaction','RepairSettlement','SaleSettlement'][i]:null).filter(Boolean);
 let sheetStatus='Not configured';let sheetDetail='Read-only Google credentials needed';if(sheetsConfigured()){try{const rows=parseClickRows(await readClickSheet());sheetStatus='Connected';sheetDetail=`${rows.length} click rows available`;}catch(error){sheetStatus='Needs attention';sheetDetail=error instanceof IntegrationError?error.message:'Google Sheets connection failed. Retry or check server configuration.';}}
 const drafts=await client.from('ga_conversion_drafts').select('id,ga_matches!inner(ga_calls!inner(started_at))',{head:true,count:'exact'}).gte('ga_matches.ga_calls.started_at',CALLS_VISIBLE_FROM_UTC).eq('status','prepared');
 return Response.json({items:[{name:'Supabase CRM',status:needsSelection?'Not configured':missing.length?'Attribution connected':'Connected',detail:needsSelection?'Select the separate CRM project in Connections.':missing.length?`CRM tables unavailable: ${missing.join(', ')}`:'CRM table access verified; payment adapter pending'},{name:'Google Sheets',status:sheetStatus,detail:sheetDetail},{name:'Android call collector',status:(calls.count||0)>0?'Receiving calls':'Waiting for calls',detail:`${calls.count||0} saved call records`},{name:'Google Ads offline conversions',status:drafts.error?'Needs attention':'Export only',detail:`${drafts.count||0} prepared payment conversions; no automatic upload`}]});
 }catch(error){return apiError(error)}}
