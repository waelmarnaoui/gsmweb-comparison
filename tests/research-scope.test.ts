import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchSourceBlock,researchRequestSchema,researchReportSchema} from '../lib/research-task';
test('research explicitly blocks missing web/30-day sources and bounds runtime; reports cannot include executable actions',()=>{
 assert.match(researchSourceBlock('Research competitors online')!,/not connected/);
 assert.match(researchSourceBlock('Find the best keywords in the last 30 days')!,/not connected/);
 assert.equal(researchSourceBlock('Review the supplied saved search report and flag missing evidence'),null);
 for(const hours of [0,13])assert.equal(researchRequestSchema.safeParse({title:'Test',instructions:'Review saved data',hours}).success,false);
 assert.equal(researchReportSchema.safeParse({summary:'Report',findings:[],limitations:[],recommendations:[],actions:[{tool:'mutate'}]}).success,false);
});
