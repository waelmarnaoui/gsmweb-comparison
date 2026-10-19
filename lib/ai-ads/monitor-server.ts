import 'server-only';
import {service} from '../server';
import {IntegrationError} from '../integration-error';
import {readRepairInventory,inventoryProjectRef,inventorySourceStatus} from './source';
import {buildStockSnapshot,stockMonitorState,stockSnapshotFresh,type StockMonitorRun} from './monitor';
import {safeInventoryFailure} from './source-diagnostic';
const account=()=>{const id=process.env.GOOGLE_ADS_CUSTOMER_ID;if(!id||!/^\d{10}$/.test(id))throw new IntegrationError('Configure the verified Google Ads account for inventory monitoring.',503);return id;};
const storageError=()=>new IntegrationError('Stock monitoring storage is unavailable. Review and install STOCK-MONITOR-PROPOSED.sql in the attribution database.',503);
export async function readStockMonitor(){
 const id=account(),db=service();
 const query=()=>db.from('ga_stock_monitor_runs').select('status,snapshot,created_at,error_code').eq('account_id',id).eq('source_project',inventoryProjectRef);
 const [latest,good]=await Promise.all([query().order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle(),query().eq('status','complete').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle()]);
 if(latest.error||good.error)throw storageError();
 let diagnostic=null;
 if(latest.data?.status==='failed'){
  const saved=await db.from('ga_audit').select('details').eq('entity','stock_inventory_read').eq('record_id',id+':'+inventoryProjectRef).eq('action','failed').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle();
  if(!saved.error)diagnostic=saved.data?.details??null;
 }
 return {...stockMonitorState(latest.data as StockMonitorRun|null,good.data as StockMonitorRun|null),lastAttemptAt:latest.data?.created_at??null,source:await inventorySourceStatus(),diagnostic};
}
let active:Promise<Awaited<ReturnType<typeof readStockMonitor>>>|null=null;
export async function collectStockMonitor(initiatedBy:string|null=null){
 if(active)return active;
 active=(async()=>{
  const before=await readStockMonitor();
  if(before.reliable&&stockSnapshotFresh(before.snapshot))return before;
  const id=account(),db=service();
  let snapshot;
  try{
   const inventory=await readRepairInventory();snapshot=buildStockSnapshot(inventory,before.snapshot);
   if(Buffer.byteLength(JSON.stringify(snapshot),'utf8')>6_000_000)throw new Error('Snapshot size limit.');
  }catch(cause){
   const slot=new Date(Math.floor(Date.now()/300000)*300000).toISOString();
   const {error,data}=await db.from('ga_stock_monitor_runs').upsert({account_id:id,source_project:inventoryProjectRef,slot,status:'failed',snapshot:null,error_code:'inventory_read_failed',initiated_by:initiatedBy},{onConflict:'account_id,source_project,slot,status',ignoreDuplicates:true}).select('id');
   if(error)throw storageError();
   if(data?.length){
    const audit=await db.from('ga_audit').insert({actor:initiatedBy,action:'failed',entity:'stock_inventory_read',record_id:id+':'+inventoryProjectRef,details:safeInventoryFailure(cause)});
    if(audit.error)throw new IntegrationError('Stock read failed and its diagnostic could not be saved. Review the server audit permissions.',503);
   }
   return readStockMonitor();
  }
  const slot=new Date(Math.floor(Date.parse(snapshot.observedAt)/300000)*300000).toISOString();
  const {error}=await db.from('ga_stock_monitor_runs').upsert({account_id:id,source_project:inventoryProjectRef,slot,status:'complete',snapshot,error_code:null,initiated_by:initiatedBy},{onConflict:'account_id,source_project,slot,status',ignoreDuplicates:true});
  if(error)throw storageError();
  return readStockMonitor();
 })();
 try{return await active;}finally{active=null;}
}
