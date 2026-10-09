import {IntegrationError} from './integration-error';
export function validateOAuthState(state:{userId:string;expires:number;nonce:string},userId:string,nonce:string|null,now=Date.now()){
 if(state.userId!==userId||!Number.isFinite(state.expires)||state.expires<=now||!nonce||state.nonce!==nonce)throw new IntegrationError('Connection sign-in state did not match. Start again.');
}
export function validateRequestOrigin(origin:string|null,expected:string){if(origin!==expected)throw new IntegrationError('Request origin rejected.',403);}
