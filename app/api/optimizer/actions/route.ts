import {requireAdmin,apiError} from '@/lib/server';
import {sameOrigin} from '@/lib/connections';
import {readOllamaActions,decideOllamaAction} from '@/lib/ollama-action-server';
export const maxDuration=300;
export async function GET(){try{const {user}=await requireAdmin();return Response.json(await readOllamaActions(user.id),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{const {user}=await requireAdmin();sameOrigin(request);const raw=await request.text();if(raw.length>1000)throw new Error('Request too large.');const input=JSON.parse(raw);if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id)||!['approve','reject'].includes(input.operation))throw new Error('Invalid action decision.');return Response.json(await decideOllamaAction(user.id,input.id,input.operation==='approve'),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
