import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewSection} from '../lib/review-loading';

test('a failed upload check does not discard imported sources or CRM conversions',async()=>{
 const [sources,conversions,uploads]=await Promise.all([
  reviewSection('Sources',async()=>['click']),
  reviewSection('CRM',async()=>['repair']),
  reviewSection('Google upload review',async()=>{throw new Error('Refresh consent.');})
 ]);
 assert.deepEqual(sources.data,['click']);assert.deepEqual(conversions.data,['repair']);
 assert.equal(uploads.data,null);assert.equal(uploads.error,'Google upload review: Refresh consent.');
});
test('unknown failures fail closed without returning an upload manifest',async()=>{
 const result=await reviewSection('Google upload review',async()=>{throw null;});
 assert.equal(result.data,null);assert.match(result.error!,/Google upload review: Unavailable/);
});
