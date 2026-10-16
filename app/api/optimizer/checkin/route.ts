import {requireAdmin,service,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {agentAccount} from '@/lib/agent-context';
import {businessDay,previousBusinessDate,receiptsSummary} from '@/lib/agent-policy';
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);const account=agentAccount();
 const body=await request.json(),today=businessDay().date;
 if(body.confirmed!==true||![today,previousBusinessDate(today)].includes(body.date)||!Number.isSafeInteger(body.amountBani)||body.amountBani<0||body.amountBani>100000000)throw new Error('Confirm valid customer payments for today or yesterday.');
 const summary=receiptsSummary(body.amountBani);
 const {error}=await service().from('ga_agent_daily_checkins').insert({account_id:account,business_date:body.date,amount_bani:body.amountBani,actor:user.id});
 if(error)throw new Error('Could not save daily check-in.');
 return Response.json(summary,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}}
