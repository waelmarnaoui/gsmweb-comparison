import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PMAX_DEFAULT_MODELS,PMAX_MODEL_GROUPS,PMAX_MODEL_LIMIT,pmaxModelThemes} from '../lib/pmax/models';
import {pmaxTemplate} from '../lib/pmax/templates';
const settings={name:'GSMWeb PMax',dailyUsd:52,location:'geoTargetConstants/123',locationLabel:'Drumul Taberei',landscape:'customers/2050434247/assets/1',square:'customers/2050434247/assets/2',logo:'customers/2050434247/assets/3',services:['display','glass','battery'],models:PMAX_DEFAULT_MODELS,finalUrl:'https://gsmweb.site/',businessName:'GSMWeb',conversionId:'7835048106'};
test('full model catalogue fits stored draft limits and retains all requested brands and variants',()=>{
 assert.ok(PMAX_DEFAULT_MODELS.length>1800);assert.ok(PMAX_DEFAULT_MODELS.length<PMAX_MODEL_LIMIT);
 for(const name of ['iPhone (2007)','iPhone 12 mini','iPhone 15 Pro Max','iPhone 18 Pro Max','S26 Ultra','S25 FE','S4 mini','A57','A52s','Huawei','Honor','Motorola','Xiaomi','OnePlus','OPPO'])assert.ok(PMAX_DEFAULT_MODELS.includes(name),name);
 const draft=pmaxTemplate(settings);assert.equal(draft.settings.models,PMAX_DEFAULT_MODELS);
 assert.ok(Buffer.byteLength(JSON.stringify(settings))<20000);assert.ok(Buffer.byteLength(JSON.stringify(draft))<100000);
 for(const group of draft.copy.groups){assert.equal(group.themes.length,50);assert.ok(group.themes.every(t=>t.length<=80));for(const [brand] of PMAX_MODEL_GROUPS)assert.ok(group.themes.some(t=>t.includes(brand==='Apple'?'iPhone':brand==='Samsung Galaxy S'||brand==='Samsung Galaxy A'?'Samsung Galaxy':brand)),brand);}
});
test('repair themes reflect edited selections without inventing brands and preserve model suffixes',()=>{
 const themes=pmaxModelThemes('Apple: iPhone 15 Pro Max, iPhone 15 Pro Max\nSamsung Galaxy S: S24 Ultra\nHonor: 90 Lite','Inlocuire display');
 assert.deepEqual(themes,['inlocuire display iPhone 15 Pro Max','inlocuire display Samsung Galaxy S24 Ultra','inlocuire display Honor 90 Lite']);
 const draft=pmaxTemplate({...settings,models:'Huawei: P30 Pro',services:['battery']});assert.deepEqual(draft.copy.groups[0].themes,['inlocuire baterie Huawei P30 Pro']);
});
