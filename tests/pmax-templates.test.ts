import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pmaxTemplate} from '../lib/pmax/templates';
import {PMAX_SERVICES,pmaxDraftSchema} from '../lib/pmax/model';
test('offline repair templates cover each selected service and satisfy Google copy limits',()=>{
 const settings={name:'GSMWeb PMax',dailyUsd:52,location:'geoTargetConstants/123',locationLabel:'Drumul Taberei',landscape:'customers/2050434247/assets/1',square:'customers/2050434247/assets/2',logo:'customers/2050434247/assets/3',services:[...PMAX_SERVICES],models:'Samsung S22 S23 S24 iPhone Motorola Xiaomi Oppo OnePlus',finalUrl:'https://gsmweb.site/',businessName:'GSMWeb',conversionId:'7835048106'};
 const draft=pmaxTemplate(settings);assert.equal(pmaxDraftSchema.safeParse(draft).success,true);
 assert.deepEqual(draft.copy.groups.map(g=>g.service),PMAX_SERVICES);
 assert.equal(pmaxTemplate({...settings,services:['glass']}).copy.groups.length,1);
 assert.match(draft.copy.groups.find(g=>g.service==='glass')!.descriptions[0],/daca panoul/);
 assert.throws(()=>pmaxTemplate({...settings,location:''}));
});
