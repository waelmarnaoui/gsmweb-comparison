import 'server-only';
import {service} from './server';
import {IntegrationError} from './integration-error';
export async function readSheetTimeResolutions(sheetId:string){
 const resolutions:Record<string,string>={};
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await service().from('ga_audit').select('details').eq('entity','ga_sheet_time_resolution').eq('record_id',sheetId).order('id',{ascending:false}).range(offset,offset+499);
  if(error)throw new IntegrationError('Saved website timezone choices could not be verified.',503);
  for(const row of data||[]){const {key,timestamp}=row.details||{};if(typeof key==='string'&&typeof timestamp==='string'&&!(key in resolutions))resolutions[key]=timestamp;}
  if((data||[]).length<500)return resolutions;
 }
 throw new IntegrationError('Website timezone resolution limit reached.',503);
}
