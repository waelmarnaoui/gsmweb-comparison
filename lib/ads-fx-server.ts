import 'server-only';
import {ownerFixedFx,type DailyFx} from './ads-fx';
// Owner explicitly approved 1 USD = 4.74 RON. No remote rate, key or storage dependency.
export async function accountFx(_accountId:string,currency:string,now=Date.now()):Promise<{rate:DailyFx|null;notice:string|null}>{
 if(currency==='RON')return {rate:null,notice:null};
 if(currency!=='USD')return {rate:null,notice:'The approved fixed conversion supports USD to RON only.'};
 return {rate:ownerFixedFx(now),notice:null};
}
