import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {syncClickSheet} from '@/lib/sync-click-sheet';
import {autoMatch} from '@/lib/auto-match';
import {conversionDashboard,conversionDateRange} from '@/lib/conversion-dashboard';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=60;
export async function POST(request:Request){try{
 const {client}=await requireAdmin();sameOrigin(request);const {action}=await request.json();
 if(!['import','clicks','crm','all'].includes(action))throw new IntegrationError('Choose a review action.');
 conversionDateRange(new URL(request.url));
 let imported=null,matched=null,prepared=null,ready=0,blocked=0;
 if(action==='import'||action==='all')imported=await syncClickSheet(client,true);
 if(action==='clicks'||action==='all'){if(action==='clicks')await syncClickSheet(client);matched=await autoMatch(client);if(!matched.configured)throw new IntegrationError('Install the approved matching update before matching website clicks.',503);}
 if(action==='crm'||action==='all'){const result=await conversionDashboard(new URL(request.url),{client,prepare:true});prepared=result.items.length;ready=result.items.filter(item=>item.ready).length;blocked=result.items.length-ready;}
 return Response.json({imported,matched,prepared,ready,blocked},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
