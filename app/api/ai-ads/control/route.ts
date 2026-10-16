import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readControl,controlResources,setControl,linkProduct,unlinkProduct,proposeAction,approveAction,executeAction,reconcileAction,proposeRollback,runStockControlTick,markControlWorkerFailed} from '@/lib/ads-control/server';
import {refreshAdsObservation} from '@/lib/ads-monitor-server';
import {createLaptopPairing} from '@/lib/ads-control/pairing-server';
import {cancelAction} from '@/lib/ads-control/server';
import {ControlProviderError} from '@/lib/ads-control/google';
import {resourceReadError} from '@/lib/ads-control/resource-loader';
const controlError=(error:unknown)=>error instanceof ControlProviderError?Response.json({error:resourceReadError(error)},{status:503}):apiError(error);
export const maxDuration=120;
export async function GET(request:Request){try{
 await requireAdmin();
 return Response.json(new URL(request.url).searchParams.get('resources')==='1'?await controlResources():await readControl(),{headers:{'Cache-Control':'no-store'}});
}catch(error){return controlError(error);}}
export async function POST(request:Request){try{
 const {user}=await requireAdmin();sameOrigin(request);
 if(Number(request.headers.get('content-length')??0)>5000)throw new Error('Request too large.');
 const input=await request.json();
 const text=(name:string,max=200)=>{if(typeof input[name]!=='string'||!input[name]||input[name].length>max)throw new Error('Invalid control request.');return input[name] as string;};
 const id=()=>{const value=text('id',36);if(!/^[a-f0-9-]{36}$/i.test(value))throw new Error('Invalid action.');return value;};
 switch(input.operation){
  case 'pair':return Response.json(await createLaptopPairing(user.id,text('canary',20)),{headers:{'Cache-Control':'no-store'}});
  case 'tick':{
   try{const reporting=await refreshAdsObservation();const result=await runStockControlTick(true);return Response.json({...result,reportingAvailable:!reporting.refreshError});}
   catch(error){try{await markControlWorkerFailed(true);}catch{}throw error;}
  }
  case 'settings':
   if(typeof input.enabled!=='boolean'&&typeof input.paused!=='boolean'||input.enabled!==undefined&&typeof input.enabled!=='boolean'||input.paused!==undefined&&typeof input.paused!=='boolean')throw new Error('Invalid settings.');
   await setControl(user.id,{enabled:input.enabled,paused:input.paused});break;
  case 'link':await linkProduct(user.id,text('resource'),text('productId'));break;
  case 'unlink':await unlinkProduct(text('resource'));break;
  case 'propose':
   if(!['ad_status','campaign_pause','budget_decrease'].includes(input.kind))throw new Error('Unsupported action.');
   return Response.json({id:await proposeAction(user.id,{kind:input.kind,resource:text('resource'),value:text('value',30),requestId:text('requestId',36)})});
  case 'approve':await approveAction(user.id,id());break;
  case 'cancel':await cancelAction(user.id,id());break;
  case 'execute':{const action=await executeAction(id());return Response.json({id:action.id,state:action.state,errorCode:action.error_code});}
  case 'reconcile':{const action=await reconcileAction(id());return Response.json({id:action.id,state:action.state,errorCode:action.error_code});}
  case 'rollback':return Response.json({id:await proposeRollback(user.id,id(),text('requestId',36))});
  default:throw new Error('Unsupported control request.');
 }
 return Response.json({saved:true});
}catch(error){return controlError(error);}}
