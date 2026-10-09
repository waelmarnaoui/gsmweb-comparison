export const CALLS_VISIBLE_FROM='2026-10-09T00:00:00+03:00';
export const CALLS_VISIBLE_FROM_UTC=new Date(CALLS_VISIBLE_FROM).toISOString();
export function visibleCallStart(value?:string|null){
 const date=new Date(value||CALLS_VISIBLE_FROM);
 if(!Number.isFinite(date.getTime()))throw new Error('Invalid date range');
 return new Date(Math.max(date.getTime(),Date.parse(CALLS_VISIBLE_FROM)));
}
