import {createHash} from 'node:crypto';
import {z} from 'zod';
import {apiError,requireAdmin,service} from '@/lib/server';
import {sameOrigin,connectionToken} from '@/lib/connections';
import {agentAccount} from '@/lib/agent-context';
import {keywordGoogle} from '@/lib/keywords/google';
import {ControlProviderError} from '@/lib/ads-control/google';
import {IntegrationError} from '@/lib/integration-error';
export const maxDuration=180;
const schema=z.object({seeds:z.array(z.string().trim().min(2).max(80)).min(1).max(20),country:z.enum(['RO','ALL'])});
export async function POST(request:Request){try{const {user}=await requireAdmin();sameOrigin(request);const raw=await request.text();if(raw.length>5000)throw new IntegrationError('Request too large.',413);const input=schema.parse(JSON.parse(raw)),account=agentAccount(),db=service(),key=createHash('sha256').update(JSON.stringify({account,input})).digest('hex');
 const saved=await db.from('ga_audit').select('details,created_at').eq('entity','keyword_demand').eq('record_id',key).eq('actor',user.id).order('id',{ascending:false}).limit(1).maybeSingle();if(saved.error)throw new IntegrationError('Saved keyword demand unavailable.',503);if(saved.data&&Date.now()-Date.parse(saved.data.created_at)<86400000)return Response.json({report:saved.data.details});
 const report=await keywordGoogle({account,token:async()=>(await connectionToken('google_ads_management')).token,login:process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,developerToken:process.env.GOOGLE_ADS_DEVELOPER_TOKEN}).ideas(input.seeds,input.country);
 const stored=await db.from('ga_audit').insert({actor:user.id,entity:'keyword_demand',record_id:key,action:'observed',details:report});if(stored.error)throw new IntegrationError('Demand report could not be saved.',503);return Response.json({report},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e instanceof ControlProviderError?new IntegrationError('Google Keyword Planner unavailable: '+[e.code,...e.diagnostics].join(' · ')+'. Verify API access or try later.',503):e);}}
