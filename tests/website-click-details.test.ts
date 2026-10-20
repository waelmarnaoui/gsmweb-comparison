import {test} from 'node:test';
import assert from 'node:assert/strict';
import {websiteClickDetails} from '../lib/website-click-details';

test('matched click details preserve captured values and exact contact delay',()=>{
 const row=websiteClickDetails({id:'click',clicked_at:'2026-10-10T06:41:10Z',gclid:'exact-click',page_url:'https://gsmweb.site/?gclid=exact-click&gbraid=braid',campaign:'Display',session_id:'session',source_key:'sheet:row',secret:'never expose'},'2026-10-10T06:42:16Z')!;
 assert.equal(row.gclid,'exact-click');assert.equal(row.delaySeconds,66);assert.equal(row.gbraid,'braid');assert.equal(row.sessionId,'session');assert.equal(row.sourceKey,'sheet:row');assert.ok(!('secret' in row));
});
test('phone-only conversions have no website evidence and missing GCLID is never fabricated',()=>{
 assert.equal(websiteClickDetails(undefined,'2026-10-10T06:42:16Z'),null);
 assert.equal(websiteClickDetails({id:'click',clicked_at:'2026-10-10T06:41:10Z'},'2026-10-10T06:42:16Z')!.gclid,'');
});
test('conflicting URL identifiers do not enrich the saved match',()=>{
 assert.equal(websiteClickDetails({gclid:'actual',page_url:'https://gsmweb.site/?gclid=other&gbraid=wrong'},'')!.gbraid,'');
});
