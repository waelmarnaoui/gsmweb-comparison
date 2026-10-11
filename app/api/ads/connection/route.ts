import {requireAdmin,apiError} from '@/lib/server';
import {adsConnectionStatus} from '@/lib/ads-connection';
import {uploadHistory} from '@/lib/ads-ledger';
export async function GET(){try{const {client}=await requireAdmin();return Response.json({...await adsConnectionStatus(),uploadTracking:(await uploadHistory(client)).configured},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
