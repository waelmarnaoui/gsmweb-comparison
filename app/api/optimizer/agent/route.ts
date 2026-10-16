import {requireAdmin,apiError} from '@/lib/server';
import {readAgentContext} from '@/lib/agent-context';
export async function GET(){try{await requireAdmin();return Response.json(await readAgentContext(),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
