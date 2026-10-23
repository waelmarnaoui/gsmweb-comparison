import {IntegrationError} from './integration-error';
export function linkId(value:unknown){
 if(typeof value!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))throw new IntegrationError('Choose a saved interaction and website click.');
 return value;
}
export function manualClickInput(value:unknown){
 const input=value as Record<string,unknown>|null;
 if(!input||input.confirmed!==true)throw new IntegrationError('Confirm the website click belongs to this customer.');
 const reason=typeof input.reason==='string'?input.reason.trim():'';
 if(reason.length<10||reason.length>1000)throw new IntegrationError('Describe your evidence in 10 to 1000 characters.');
 return {callId:linkId(input.callId),interactionId:linkId(input.interactionId),clickId:linkId(input.clickId),reason};
}
