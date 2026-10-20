import {apiError,requireAdmin} from '@/lib/server';
import {sameOrigin,getConnection,configuredProvider} from '@/lib/connections';
import {searchConsoleSites,searchConsoleReport} from '@/lib/keywords/search-console';
import {IntegrationError} from '@/lib/integration-error';
import {keywordError} from '@/lib/keywords/errors';
export const maxDuration=180;
export async function GET(){try{await requireAdmin();const connected=Boolean(await getConnection('google_search_console'));return Response.json({configured:configuredProvider('google_search_console'),connected,sites:connected?await searchConsoleSites():[]},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{await requireAdmin();sameOrigin(request);const text=await request.text();if(text.length>2000)throw new IntegrationError('Request too large.',413);const body=JSON.parse(text);if(typeof body.site!=='string'||body.site.length>500)throw new IntegrationError('Choose a Search Console property.');return Response.json({report:await searchConsoleReport(body.site,body.range)},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(keywordError(e));}}
