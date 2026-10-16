import {requireAdmin,apiError} from '@/lib/server';
import {readRepairInventory} from '@/lib/ai-ads/source';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  await requireAdmin();
  const inventory=await readRepairInventory();
  return Response.json({...inventory,executionEnabled:false},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return apiError(error);}
}
