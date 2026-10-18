export type CooldownResetStore={lock:()=>Promise<string|null>;unlock:(token:string)=>Promise<void>;alreadyRecorded:(requestId:string)=>Promise<boolean>;record:(requestId:string,actor:string)=>Promise<void>};
export async function clearCurrentAdsCooldown(actor:string,requestId:string,store:CooldownResetStore){
 if(!actor||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))throw new Error('Invalid reset confirmation.');
 const token=await store.lock();if(!token)throw new Error('ads_read_busy');
 try{
  if(await store.alreadyRecorded(requestId))return {cleared:true,duplicate:true};
  await store.record(requestId,actor);
  return {cleared:true,duplicate:false};
 }finally{await store.unlock(token);}
}
