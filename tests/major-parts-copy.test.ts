import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInventory,defaultInventoryRules} from '../lib/ai-ads/inventory';
import {generateRepairDraft} from '../lib/ai-ads/policy';
import {buildStockSnapshot} from '../lib/ai-ads/monitor';
import {advertisingPartType,restrictedCopy,validHeadline,headlineFallback,insertionPreview,modelPartHeadline,COPY_RULES_VERSION} from '../lib/ai-ads/copy-rules';
const now=Date.parse('2026-10-16T12:00:00Z'),project='dmjunqbncyrinykbbmfk';
function part(type:string){return normalizeInventory(project,[{id:'p',name:'Recorded part',sku:'s',brand:null,partCode:null,partType:type,compatibleModels:['Samsung Galaxy S23'],modelId:null,category:'PART',quality:'used',active:true,minStock:1,recommendedPrice:100,updatedAt:new Date(now).toISOString()}],[{id:'l',productId:'p',quantityAvailable:3,unitCost:50,costIncludesVat:null,updatedAt:new Date(now).toISOString()}],[],defaultInventoryRules,now)[0];}
test('only display, battery and charging-port stock qualifies for advertising',()=>{
 for(const type of ['display','battery','charging-port'])assert.equal(part(type).eligible,true);
 for(const type of ['speaker','microphone','adhesive','camera-glass','custom-sticla-display-oca','back-cover','motherboard','other']){assert.equal(part(type).eligible,false);assert.ok(part(type).reasons.includes('outside_advertising_part_types'));}
 assert.equal(advertisingPartType('Display'),'display');assert.equal(advertisingPartType('charging_port'),null);
});
test('all three part families prepare 15 unique valid headlines and 3 keyword-insertion assets per variant',()=>{
 for(const type of ['display','battery','charging-port']){
  const draft=generateRepairDraft(part(type),'https://gsmweb.site/',now);assert.equal(draft.headlines.length,15);assert.equal(draft.descriptions.length,4);
  for(const variant of draft.variants!){assert.equal(variant.headlines.length,15);assert.equal(new Set(variant.headlines.map(headlineFallback)).size,15);assert.equal(variant.headlines.filter(text=>text.includes('{KeyWord:')).length,3);assert.ok(variant.headlines.every(validHeadline));assert.ok(variant.descriptions.every(text=>text.length<=90&&!restrictedCopy(text)));}
  assert.ok(draft.keywords.length>0);assert.ok(draft.keywords.every(keyword=>!restrictedCopy(keyword.text)&&keyword.text.includes('Samsung Galaxy S23')));assert.ok(draft.policy.issues.some(issue=>issue.code==='keyword_insertion_scope'));
 }
});
test('restricted terms are detected across accents, case and punctuation',()=>{
 for(const text of ['service gsm','SERVICE-GSM','reparatii telefoane','Reparații Telefoane','reparatie','REPARAȚIE','reparația'])assert.equal(restrictedCopy(text),true);
 for(const text of ['Inlocuire Baterie','Montaj Port Incarcare','GSMWEB'])assert.equal(restrictedCopy(text),false);
});

test('every display variant keeps iPhone 15 Pro Max inside keyword-insertion braces',()=>{
 const display={...part('display'),models:['iPhone 15 Pro Max']};
 const draft=generateRepairDraft(display,'https://gsmweb.site/',now);
 for(const variant of draft.variants!){
  assert.ok(variant.headlines.includes('{KeyWord:Display iPhone 15 Pro Max}'));
  assert.equal(variant.headlines.length,15);assert.ok(variant.headlines.every(validHeadline));
  assert.equal(insertionPreview(variant.headlines[0],'inlocuire display iPhone 15 Pro Max'),'Display iPhone 15 Pro Max');
 }
 assert.ok(draft.keywords.some(k=>k.text==='inlocuire display iPhone 15 Pro Max'));
 assert.ok(draft.keywords.every(k=>k.matchType==='EXACT'&&/^(inlocuire|schimbare) /.test(k.text)));
 assert.notEqual(COPY_RULES_VERSION,'major-parts-15-full-dki-disclosure-v2');
});

test('model shortening preserves generation and complete variant suffixes',()=>{
 for(const model of ['iPhone 15','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 14 Plus','Samsung Galaxy S23 Ultra','Samsung Galaxy S24 FE']){
  for(const type of ['display','battery','charging-port']){
   const draft=generateRepairDraft({...part(type),models:[model]},'https://gsmweb.site/',now);
   const suffix=model.replace(/^(?:Samsung Galaxy |iPhone )/,'');
   for(const variant of draft.variants!){assert.ok(variant.headlines[0].includes(suffix));assert.ok(variant.headlines[0].startsWith('{KeyWord:'));assert.ok(validHeadline(variant.headlines[0]));}
  }
 }
 assert.equal(modelPartHeadline('Port Incarcare','Apple iPhone 15 Pro Max'),'Port Incarcare 15 Pro Max');
});

test('unfittable model labels require review rather than truncating a model identity',()=>{
 const model='Unusually Long Manufacturer Phone 2026 Pro Max Ultra';
 assert.equal(modelPartHeadline('Display',model),null);
 const draft=generateRepairDraft({...part('display'),models:[model]},'https://gsmweb.site/',now);
 assert.ok(draft.policy.issues.some(i=>i.code==='model_headline_too_long'&&i.risk==='high'));
 assert.equal(modelPartHeadline('Display',''),null);
});
test('keyword insertion uses a reviewed keyword when it fits and a valid fallback otherwise',()=>{
 assert.equal(insertionPreview('{KeyWord:GSMWEB Display}','display Samsung S23'),'display Samsung S23');
 assert.equal(insertionPreview('{KeyWord:GSMWEB Display}','inlocuire display Samsung Galaxy S23 Ultra'),'GSMWEB Display');
 assert.throws(()=>insertionPreview('{KeyWord:Display}','reparatie Samsung'));assert.equal(validHeadline('{Display Samsung}'),false);assert.equal(validHeadline('GSMWEB {KeyWord:Display}'),false);assert.equal(validHeadline('{KeyWord:GSMWEB Drumul Taberei}'),true);
});
test('small-part stock does not create drafts or advertising stock alerts',()=>{
 const old=part('speaker'),before=buildStockSnapshot({sourceProject:project,complete:true,parts:[old]},null,now);
 const changed={...old,available:0,fingerprint:'changed',observedAt:new Date(now+60000).toISOString()};
 const after=buildStockSnapshot({sourceProject:project,complete:true,parts:[changed]},before,now+60000);assert.equal(after.summary.parts,0);assert.equal(after.drafts.length,0);assert.equal(after.events.length,0);
});


test('installation-only offer has exactly two installation headlines with required display positions',()=>{
 for(const type of ['display','battery','charging-port'])for(const variant of generateRepairDraft(part(type),'https://gsmweb.site/',now).variants!){
  assert.equal(variant.headlines.filter(h=>/\b(montaj|inlocuire|schimbare)\b/i.test(h)).length,2);
  assert.equal(variant.pinnedHeadlines.length,1);assert.equal(variant.pinnedHeadlines[0].field,'HEADLINE_1');assert.ok(variant.headlines.includes(variant.pinnedHeadlines[0].text));assert.match(variant.pinnedHeadlines[0].text,/Montaj/);
  assert.equal(variant.pinnedDescriptions[0].field,'DESCRIPTION_1');assert.equal(variant.descriptions[0],variant.pinnedDescriptions[0].text);assert.match(variant.descriptions[0],/numai cu montaj.*Nu se vinde separat/);
  for(const h of variant.headlines.filter(h=>h.includes('{')))assert.match(h,/^\{KeyWord:[^{}]+\}$/);
  assert.ok(!variant.headlines.some(h=>/ieftin|cel mai|rapid|garanti|original|autorizat/i.test(h)));
 }
 const draft=generateRepairDraft(part('battery'),'https://gsmweb.site/',now);assert.deepEqual(draft.pinnedHeadlines,draft.variants![0].pinnedHeadlines);assert.deepEqual(draft.pinnedDescriptions,draft.variants![0].pinnedDescriptions);
});
