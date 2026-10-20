import {extractBraidIdentifiers} from './ad-click-identifiers';

export function websiteClickDetails(click:Record<string,unknown>|undefined,callTime:string){
 if(!click)return null;
 const text=(key:string)=>typeof click[key]==='string'?click[key] as string:'';
 const clickedAt=text('clicked_at'),delay=(Date.parse(callTime)-Date.parse(clickedAt))/1000;
 return {id:text('id'),clickedAt,gclid:text('gclid'),campaign:text('campaign'),pageUrl:text('page_url'),sessionId:text('session_id'),sourceKey:text('source_key'),...extractBraidIdentifiers(text('page_url'),text('gclid')),delaySeconds:Number.isFinite(delay)?delay:null};
}
export type WebsiteClickDetails=NonNullable<ReturnType<typeof websiteClickDetails>>;
