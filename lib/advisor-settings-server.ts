import 'server-only';
import {getConnection,saveConnection} from './connections';
import {advisorModel,advisorKey,selectGeminiConfiguration} from './advisor-settings';
import {IntegrationError} from './integration-error';
import {askAdvisor} from './agent-model';
import {service} from './server';
export async function advisorConfiguration(){
 let saved;try{saved=await getConnection('ai_advisor');}catch{if(!process.env.GOOGLE_GENERATIVE_AI_API_KEY&&!process.env.GEMINI_API_KEY)return {...selectGeminiConfiguration(null,process.env),source:'unavailable'};}
 return selectGeminiConfiguration(saved,process.env);
}
export async function advisorReadiness(){const {key:unused,...status}=await advisorConfiguration();void unused;return {...status,notice:status.configured?'Gemini is configured. Test the connection to verify model access. Free quota depends on your Google project; billing-enabled projects may charge.':'Add a Gemini API key from Google AI Studio in AI settings. Previous Claude keys are not used. No paid provider fallback is enabled.'};}
export async function configureAdvisor(actor:string,input:{apiKey?:unknown;model?:unknown;save:boolean}){
 const existing=await advisorConfiguration(),key=input.apiKey||existing.key,model=advisorModel(input.model??existing.model);
 if(!advisorKey(key))throw new IntegrationError('Enter a valid Gemini API key in the secure settings form. Do not paste keys into chat.',400);
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
