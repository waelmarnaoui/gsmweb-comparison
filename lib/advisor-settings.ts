export const DEFAULT_ADVISOR_MODEL='gemini-3.8-flash';
export function advisorModel(value:unknown){if(value===undefined||value===null||value==='')return DEFAULT_ADVISOR_MODEL;if(typeof value!=='string'||!/^gemini-[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(value))throw new Error('Choose a valid Gemini model ID.');return value;}
export function advisorKey(value:unknown):value is string{return typeof value==='string'&&/^AIza[a-zA-Z0-9_-]{30,200}$/.test(value);}
export function selectGeminiConfiguration(saved:{credentials:{access_token:string};metadata:Record<string,string>}|null|undefined,env:Record<string,string|undefined>){
 // Never reinterpret the previous provider's encrypted credentials as a Google key.
 const google=saved?.metadata.provider==='google'?saved:null;
 const key=google?.credentials.access_token||env.GOOGLE_GENERATIVE_AI_API_KEY||env.GEMINI_API_KEY||null;
 return {key:advisorKey(key)?key:null,model:advisorModel(google?.metadata.model||env.GEMINI_ADVISOR_MODEL),source:google?.credentials.access_token?'encrypted_app_settings':key?'server_environment':'missing_key',configured:advisorKey(key),provider:'google' as const};
}
export function advisorFailure(status:number,code:unknown){
 if(status===401||status===400&&code==='API_KEY_INVALID')return 'Google rejected the Gemini API key. Replace it in AI settings.';
 if(status===403)return 'This Google project does not permit Gemini API access. Check key restrictions and enable the Gemini API.';
 if(status===402)return 'Gemini API billing is unavailable. No paid fallback was attempted.';
 if(status===429)return 'Gemini quota or rate limit reached. Wait for the quota to reset or check Google AI Studio. No paid fallback was attempted.';
 if(status===404)return 'The selected Gemini model is unavailable to this project. Check the model in AI settings.';
 if(status===400)return 'Google rejected the Gemini model or request settings. Check the model in AI settings.';
 return 'The Gemini request failed. Check AI settings and try again later. No paid fallback was attempted.';
}
