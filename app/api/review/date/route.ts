import {requireAdmin,apiError} from '@/lib/server';
import {bucharestToday} from '@/lib/conversion-upload-policy';
export async function GET(){try{await requireAdmin();return Response.json({today:bucharestToday()},{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
