import {test} from 'node:test';import assert from 'node:assert/strict';
import {pmaxOperations,PMAX_SERVICES} from '../lib/pmax/model';
import {pmaxTemplate} from '../lib/pmax/templates';
import {PMAX_DEFAULT_MODELS} from '../lib/pmax/models';
const settings={name:'GSMWeb PMax',dailyUsd:52,location:'geoTargetConstants/123',locationLabel:'Drumul Taberei',landscape:'customers/2050434247/assets/1',square:'customers/2050434247/assets/2',logo:'customers/2050434247/assets/3',services:[...PMAX_SERVICES],models:PMAX_DEFAULT_MODELS,finalUrl:'https://gsmweb.site/',businessName:'GSMWeb',conversionId:'7835048106'};
test('all seven asset groups have complete consecutive link blocks and dependency order',()=>{
 const draft=pmaxTemplate(settings),ops=pmaxOperations('2050434247',draft,'id') as any[];
 const types=ops.map(op=>Object.keys(op)[0]);
 for(const type of new Set(types)){const first=types.indexOf(type),last=types.lastIndexOf(type);assert.ok(types.slice(first,last+1).every(t=>t===type),'split operation block: '+type);}
 assert.equal(types[types.indexOf('campaignOperation')+1],'campaignAssetOperation');
 assert.ok(types.lastIndexOf('assetOperation')<types.indexOf('campaignAssetOperation'));
 assert.ok(types.lastIndexOf('assetGroupOperation')<types.indexOf('assetGroupAssetOperation'));
 assert.ok(types.lastIndexOf('assetGroupAssetOperation')<types.indexOf('assetGroupSignalOperation'));
 const textAssets=ops.filter(o=>o.assetOperation).map(o=>o.assetOperation.create);
 assert.equal(new Set(textAssets.map(a=>a.textAsset.text)).size,textAssets.length,'reuse identical text instead of duplicate creates');
 const assetIds=new Set(textAssets.map(a=>a.resourceName));
 for(const group of ops.filter(o=>o.assetGroupOperation).map(o=>o.assetGroupOperation.create)){
  const links=ops.filter(o=>o.assetGroupAssetOperation?.create.assetGroup===group.resourceName).map(o=>o.assetGroupAssetOperation.create);
  for(const [type,min] of [['HEADLINE',3],['LONG_HEADLINE',1],['DESCRIPTION',2]] as const){const assets=links.filter(l=>l.fieldType===type).map(l=>l.asset);assert.ok(new Set(assets).size>=min,type+' '+group.name);assert.ok(assets.every(a=>assetIds.has(a)));}
  assert.ok(links.some(l=>l.fieldType==='MARKETING_IMAGE'));assert.ok(links.some(l=>l.fieldType==='SQUARE_MARKETING_IMAGE'));
 }
 const brand=ops.find(o=>o.campaignAssetOperation?.create.fieldType==='BUSINESS_NAME').campaignAssetOperation.create.asset;
 assert.ok(ops.some(o=>o.assetGroupAssetOperation?.create.fieldType==='HEADLINE'&&o.assetGroupAssetOperation.create.asset===brand),'shared GSMWeb asset is linked to brand and headlines');
});
