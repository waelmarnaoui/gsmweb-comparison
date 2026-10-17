import 'server-only';
import {getConnection,saveConnection} from './connections';
import {advisorModel,normalizeAdvisorKey,selectGeminiConfiguration} from './advisor-settings';
import {IntegrationError} from './integration-error';
import {askAdvisor} from './agent-model';
import {service} from './server';
import {askOllama,ollamaEndpoint} from './ollama-advisor';
export async function advisorConfiguration(){
 let saved;try{saved=await getConnection('ai_advisor');}catch{return {key:null,model:advisorModel(undefined),baseURL:'',source:'unavailable',configured:false,provider:'google' as const};}
 if(saved?.metadata.provider==='ollama')return {key:saved.credentials.access_token,model:'llama3.1:8b',baseURL:ollamaEndpoint(saved.metadata.baseURL),source:'encrypted_app_settings',configured:true,provider:'ollama' as const};
 return {...selectGeminiConfiguration(saved,process.env),baseURL:''};
}
export async function advisorReadiness(){const {key:unused,...status}=await advisorConfiguration();void unused;return {...status,notice:status.provider==='ollama'?'Ollama uses your protected computer gateway. Chat is read-only; account tools are unavailable for this model. No Gemini fallback is enabled.':status.configured?'Gemini is configured. Test the connection to verify model access. Free quota depends on your Google project; billing-enabled projects may charge.':'Add a Gemini API key from Google AI Studio in AI settings. Previous Claude keys are not used. No paid provider fallback is enabled.'};}
export async function configureAdvisor(actor:string,input:{provider?:unknown;baseURL?:unknown;apiKey?:unknown;model?:unknown;save:boolean}){
 if(input.provider!==undefined&&!['google','ollama'].includes(String(input.provider)))throw new IntegrationError('Invalid AI provider.',400);
 if(input.provider==='ollama'){
  const existing=await advisorConfiguration();
  const key=typeof input.apiKey==='string'&&input.apiKey.trim()?input.apiKey.trim():existing.provider==='ollama'?existing.key:null;
  if(!key||!/^[a-f0-9]{64}$/.test(key))throw new IntegrationError('Enter the protected gateway token in this form, not in chat.',400);
  let baseURL:string;try{baseURL=ollamaEndpoint(input.baseURL);}catch{throw new IntegrationError('Enter a valid HTTPS ngrok gateway URL.',400);}
  await askOllama({key,baseURL,message:'Confirm the connection test. No customer data is supplied.',context:{connectionTest:true},history:[]});
  if(input.save)await saveConnection('ai_advisor',{access_token:key,refresh_token:'',expires_at:0},{provider:'ollama',baseURL,model:'llama3.1:8b',verified_at:new Date().toISOString()},actor);
  return {...await advisorReadiness(),tested:true,testedModel:'llama3.1:8b',saved:input.save};
 }
 const existing=await advisorConfiguration(),key=normalizeAdvisorKey(input.apiKey||(existing.provider==='google'?existing.key:null)),model=advisorModel(input.model??(existing.provider==='google'?existing.model:undefined));
 if(!key)throw new IntegrationError('Paste the complete Gemini API key from Google AI Studio in the secure settings form. Standard and authorization keys are supported. Do not paste keys into chat.',400);
 // The connection test uses static configuration text, never customer records,
 // stock costs or advertising data. No provider secrets enter the model input.
 await askAdvisor({key,model,message:'Confirm that the AI advisor connection works. This is a connection test; do not analyze an advertising account.',context:{connectionTest:true},history:[]});
 if(input.save)await saveConnection('ai_advisor',{access_token:key,refresh_token:'',expires_at:0},{provider:'google',model,verified_at:new Date().toISOString()},actor);
 return {...await advisorReadiness(),tested:true,testedModel:model,saved:input.save};
}
export async function recordAdvisorReadiness(account:string){
 const status=await advisorReadiness(),db=service(),details={configured:status.configured,model:status.model,source:status.source};
 const last=await db.from('ga_audit').select('details').eq('entity','ai_advisor_readiness').eq('record_id',account).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(last.error)throw new Error('AI readiness history unavailable.');
 if(last.data?.details?.configured!==details.configured||last.data?.details?.model!==details.model||last.data?.details?.source!==details.source){const r=await db.from('ga_audit').insert({actor:null,action:'observed',entity:'ai_advisor_readiness',record_id:account,details});if(r.error)throw new Error('AI readiness history unavailable.');}
 return status;
}
