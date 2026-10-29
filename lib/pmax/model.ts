import {z} from 'zod';
import {createHash} from 'node:crypto';
const line=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[{}<>\r\n]/.test(v),'Use plain ad copy without keyword insertion.');
export const PMAX_SERVICES=['display','glass','backglass','battery','charging','camera','other'] as const;
const groupSchema=z.object({service:z.enum(PMAX_SERVICES),name:line(80),headlines:z.array(line(30)).min(3).max(15),longHeadlines:z.array(line(90)).min(1).max(5),descriptions:z.array(line(90)).min(2).max(5),themes:z.array(line(80)).min(1).max(50)}).strict().refine(v=>v.headlines.some(h=>h.length<=15),'Include one headline of 15 characters or fewer.');
export const pmaxCopySchema=z.object({groups:z.array(groupSchema).min(1).max(7)}).strict().refine(v=>new Set(v.groups.map(g=>g.service)).size===v.groups.length,'Duplicate repair category.');
const asset=z.string().regex(/^customers\/\d{10}\/assets\/\d+$/);
export const pmaxSettingsSchema=z.object({name:line(100),dailyUsd:z.number().min(1).max(1000),location:z.string().regex(/^geoTargetConstants\/\d+$/),locationLabel:line(150),landscape:asset,square:asset,logo:asset,services:z.array(z.enum(PMAX_SERVICES)).min(1).max(7),models:z.string().trim().min(10).max(1800),finalUrl:z.string().url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&['gsmweb.site','www.gsmweb.site'].includes(u.hostname)&&!u.username&&!u.password&&!u.port;}),businessName:z.literal('GSMWeb'),conversionId:z.literal('7835048106')}).strict();
export const pmaxDraftSchema=z.object({settings:pmaxSettingsSchema,copy:pmaxCopySchema}).strict().refine(v=>v.settings.services.length===v.copy.groups.length&&v.settings.services.every(s=>v.copy.groups.some(g=>g.service===s)),'Generate every selected repair category.');
export type PmaxDraft=z.infer<typeof pmaxDraftSchema>;
export type PmaxRow={id:string;actor:string;account_id:string;state:string;version:number;draft:PmaxDraft|null;input:z.infer<typeof pmaxSettingsSchema>;content_hash:string|null;result:unknown;error_code:string|null;created_at:string};
export const pmaxHash=(account:string,draft:PmaxDraft)=>createHash('sha256').update(JSON.stringify({account,status:'ENABLED',draft:pmaxDraftSchema.parse(draft)})).digest('hex');
export function pmaxOperations(account:string,raw:PmaxDraft,id:string){
 const draft=pmaxDraftSchema.parse(raw),s=draft.settings;
 if(!/^\d{10}$/.test(account)||![s.square,s.landscape,s.logo].every(v=>v.startsWith(`customers/${account}/assets/`)))throw new Error('Assets belong to another account.');
 const root=`customers/${account}`,budget=root+'/campaignBudgets/-1',campaign=root+'/campaigns/-2',goal=root+'/customConversionGoals/-4';let temp=-100;
 const operations:Record<string,unknown>[]=[
  {campaignBudgetOperation:{create:{resourceName:budget,name:s.name+' '+id,amountMicros:String(Math.round(s.dailyUsd*1000000)),deliveryMethod:'STANDARD',explicitlyShared:false}}},
  {customConversionGoalOperation:{create:{resourceName:goal,name:'GSMWeb CRM '+id,conversionActions:[`${root}/conversionActions/${s.conversionId}`]}}},
  {campaignOperation:{create:{resourceName:campaign,name:s.name+' · '+id.slice(0,8),status:'ENABLED',advertisingChannelType:'PERFORMANCE_MAX',campaignBudget:budget,maximizeConversionValue:{},brandGuidelinesEnabled:true,urlExpansionOptOut:true,containsEuPoliticalAdvertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',geoTargetTypeSetting:{positiveGeoTargetType:'PRESENCE'}}}},
  {conversionGoalCampaignConfigOperation:{update:{resourceName:root+'/conversionGoalCampaignConfigs/-2',goalConfigLevel:'CAMPAIGN',customConversionGoal:goal},updateMask:'goal_config_level,custom_conversion_goal'}},
  {campaignCriterionOperation:{create:{campaign,location:{geoTargetConstant:s.location}}}},
  {campaignCriterionOperation:{create:{campaign,language:{languageConstant:'languageConstants/1032'}}}}
 ];
 function text(value:string,fieldType:string,group?:string){const resourceName=root+'/assets/'+temp--;operations.push({assetOperation:{create:{resourceName,textAsset:{text:value}}}});operations.push(!group?{campaignAssetOperation:{create:{campaign,asset:resourceName,fieldType}}}:{assetGroupAssetOperation:{create:{assetGroup:group,asset:resourceName,fieldType}}});}
 text(s.businessName,'BUSINESS_NAME');
 operations.push({campaignAssetOperation:{create:{campaign,asset:s.logo,fieldType:'LOGO'}}});
 for(const [index,c] of draft.copy.groups.entries()){
 const group=root+'/assetGroups/'+(-10-index);
 operations.push({assetGroupOperation:{create:{resourceName:group,campaign,name:c.name,finalUrls:[s.finalUrl],status:'ENABLED'}}});
 for(const value of c.headlines)text(value,'HEADLINE',group);for(const value of c.longHeadlines)text(value,'LONG_HEADLINE',group);for(const value of c.descriptions)text(value,'DESCRIPTION',group);
 for(const [asset,fieldType] of [[s.landscape,'MARKETING_IMAGE'],[s.square,'SQUARE_MARKETING_IMAGE']])operations.push({assetGroupAssetOperation:{create:{assetGroup:group,asset,fieldType}}});
 for(const text of [...new Set(c.themes)])operations.push({assetGroupSignalOperation:{create:{assetGroup:group,searchTheme:{text}}}});
 }
 return operations;
}
