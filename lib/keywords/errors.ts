import {ZodError} from 'zod';
import {IntegrationError} from '../integration-error';
import {ControlProviderError} from '../ads-control/google';
export function keywordError(error:unknown){
 if(error instanceof ZodError)return new IntegrationError('Check the dates, selected keywords, match type and destination. Select no more than 100 keywords.',422);
 if(error instanceof ControlProviderError)return new IntegrationError('Google request failed: '+[error.code,...error.diagnostics].join(' · ')+'. No automatic retry was attempted; check keyword action history before sending again.',503);
 return error;
}
