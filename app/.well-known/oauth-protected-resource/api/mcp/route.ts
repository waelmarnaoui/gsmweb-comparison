import {mcpConfig,resourceMetadata,authFailure} from '@/lib/mcp/auth';
export function GET(){try{return Response.json(resourceMetadata(mcpConfig()),{headers:{'Cache-Control':'no-store'}});}catch{return authFailure(503);}}
