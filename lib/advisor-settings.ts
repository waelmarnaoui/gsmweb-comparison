export const DEFAULT_ADVISOR_MODEL='claude-sonnet-5';
export function advisorModel(value:unknown){if(value===undefined||value===null||value==='')return DEFAULT_ADVISOR_MODEL;if(typeof value!=='string'||!/^claude-[a-zA-Z0-9][a-zA-Z0-9._:-]{0,112}$/.test(value))throw new Error('Choose a valid Claude model ID.');return value;}
export function advisorKey(value:unknown):value is string{return typeof value==='string'&&/^sk-ant-[a-zA-Z0-9_-]{20,500}$/.test(value);}
export function advisorFailure(status:number,code:unknown){
 if(status===401)return 'Anthropic rejected the API key. Replace it in AI settings.';
 if(status===403)return 'This Anthropic project does not permit the requested model. Check project permissions.';
 if(status===402||status===400&&code==='billing_error')return 'Anthropic API billing or quota is unavailable. Check the API project billing and spending limit.';
 if(status===429)return 'Anthropic rate limit reached. Wait before trying another analysis.';
 if(status===404)return 'The selected Anthropic model is unavailable to this API project. Choose another model in AI settings.';
 if(status===400)return 'Anthropic rejected the model or structured-output settings. Check the advisor model in AI settings.';
 return 'The Anthropic advisor request failed. Check AI settings and try again later.';
}
