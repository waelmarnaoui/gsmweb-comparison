import {normalizeRomanianPhone} from './attribution';
import {parseTimestamp} from './timestamps';
import {CALLS_VISIBLE_FROM_UTC} from './call-visibility';
export function manualWhatsAppInput(input:unknown,now=Date.now()){
 if(!input||typeof input!=='object')throw new Error('Enter the phone number and first-message time.');
 const value=input as Record<string,unknown>;
 if(typeof value.phone!=='string'||value.phone.length>60||typeof value.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||typeof value.time!=='string'||!/^\d{2}:\d{2}(?::\d{2})?$/.test(value.time))throw new Error('Enter a phone number, date and time.');
 const phone=normalizeRomanianPhone(value.phone),precision=value.time.length===5?'minute':'second';
 const startedAt=parseTimestamp(value.date+' '+value.time+(precision==='minute'?':00':'')),time=Date.parse(startedAt);
 if(time>now)throw new Error('First-message time cannot be in the future.');
 if(time<Date.parse(CALLS_VISIBLE_FROM_UTC))throw new Error('First-message date must be on or after 24 September 2026.');
 return {phone,startedAt,precision};
}
export function clickChannel(value:string){
 const key=value.trim().toLowerCase().replace(/[\s-]+/g,'_');
 if(['whatsapp','whatsapp_click','click_whatsapp','whatsapp_button','whatsapp_message'].includes(key))return 'whatsapp';
 if(['call','phone','call_click','click_call','phone_click','click_phone','tel','tel_click','click_tel'].includes(key))return 'call';
 return 'unknown';
}
