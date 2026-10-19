import {z} from 'zod';
import {agentReplySchema} from './advisor-reply';
import {validHeadline} from './ai-ads/copy-rules';
export const OLLAMA_READ_TOOLS=['account_overview','customer_payments','website_clicks','business_records','inventory','advertising_status','agent_access_and_jobs','source_files','read_source_file'] as const;
export const OLLAMA_WRITE_TOOLS=['save_ad_drafts','remember_business_preference','record_daily_payments','run_control_cycle','automation_settings','create_source_change','deploy_source_change','queue_research_task'] as const;
export const ollamaActionSchema=z.object({tool:z.enum([...OLLAMA_READ_TOOLS,...OLLAMA_WRITE_TOOLS]),inputJson:z.string().max(55000),reason:z.string().min(1).max(500)}).strict();
export const ollamaAgentReplySchema=agentReplySchema.extend({actions:z.array(ollamaActionSchema).max(3).default([])});
export type OllamaAction=z.infer<typeof ollamaActionSchema>;
export const savedAdSchema=z.object({title:z.string().min(3).max(100),headlines:z.array(z.string().min(1).max(40).refine(validHeadline,'Use a valid 30-character headline or {KeyWord:model and part} with a 30-character fallback.')).min(3).max(15),descriptions:z.array(z.string().min(1).max(90)).min(2).max(4),landingUrl:z.string().url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&['gsmweb.site','www.gsmweb.site'].includes(url.hostname)&&!url.username&&!url.password;},'Use the GSMWeb website.')}).strict();
export const saveAdsSchema=z.object({drafts:z.array(savedAdSchema).min(1).max(5)}).strict();
export function isOllamaReadTool(name:string){return (OLLAMA_READ_TOOLS as readonly string[]).includes(name);}
