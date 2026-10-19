import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ollamaAgentReplySchema,ollamaActionSchema,saveAdsSchema,isOllamaReadTool} from '../lib/ollama-actions';
test('only implemented tools can be proposed; mutations are never classified as reads',()=>{
 for(const tool of ['execute_sql','shell','change_budget','delete_customer'])assert.equal(ollamaActionSchema.safeParse({tool,inputJson:'{}',reason:'test'}).success,false);
 assert.equal(isOllamaReadTool('inventory'),true);assert.equal(isOllamaReadTool('save_ad_drafts'),false);
});
test('saved drafts require bounded ad assets and a safe GSMWeb HTTPS landing page',()=>{
 const input={drafts:[{title:'Display',headlines:['Display telefon','Montaj display','GSMWeb Bucuresti'],descriptions:['Discuta cu echipa GSMWeb despre montaj.','Solicita detalii despre inlocuirea displayului.'],landingUrl:'https://gsmweb.site/'}]};
 assert.ok(saveAdsSchema.safeParse(input).success);
 assert.equal(saveAdsSchema.safeParse({drafts:[{...input.drafts[0],landingUrl:'https://evil.example'}]}).success,false);
 assert.equal(saveAdsSchema.safeParse({drafts:[{...input.drafts[0],headlines:['x']}]}).success,false);
 assert.equal(saveAdsSchema.safeParse({drafts:Array(6).fill(input.drafts[0])}).success,false);
});

test('saved chat drafts accept model keyword insertion by fallback length, not wrapper length',()=>{
 const draft={title:'iPhone 15 Pro Max display',headlines:['{KeyWord:Display iPhone 15 Pro Max}','Montaj display','GSMWeb Bucuresti'],descriptions:['Display pentru iPhone 15 Pro Max cu montaj.','Discuta cu echipa GSMWeb.'],landingUrl:'https://gsmweb.site/'};
 assert.ok(draft.headlines[0].length>30);
 assert.equal(saveAdsSchema.safeParse({drafts:[draft]}).success,true);
 for(const headline of ['{Display iPhone 15 Pro Max}','{KeyWord:'+'x'.repeat(31)+'}','x'.repeat(31),'{KeyWord:reparatii iPhone 15 Pro}'])assert.equal(saveAdsSchema.safeParse({drafts:[{...draft,headlines:[headline,...draft.headlines.slice(1)]}]}).success,false);
});
