import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paymentTotals,websiteTotals,businessRange} from '../lib/agent-business';
import {sourcePath,sourceContent,validateSourceFiles,sourceChecksReady} from '../lib/agent-source-policy';
test('CRM payments use exact integer bani, active payment IDs and calendar dates without double counting',()=>{
 const rows=[{id:'a',paidDate:'2026-10-17',amount:'1000.01',paymentMethod:'CASH',active:true},{id:'b',paidDate:'2026-10-17',amount:'500.10',paymentMethod:'CARD',active:true},{id:'c',paidDate:'2026-10-17',amount:'-20.01',paymentMethod:'TRANSFER',active:true},{id:'old',paidDate:'2026-10-17',amount:'9000',paymentMethod:'CASH',active:false}];
 const r=paymentTotals(rows,'2026-10-17','2026-10-17');assert.equal(r.totalNetBani,148010);assert.equal(r.daily[0].receivedBani,150011);assert.equal(r.daily[0].refundBani,2001);assert.equal(r.daily[0].payments,3);
 assert.throws(()=>paymentTotals([...rows,rows[0]],'2026-10-17','2026-10-17'),/Duplicate/);assert.throws(()=>paymentTotals([{...rows[0],amount:'unknown'}],'2026-10-17','2026-10-17'));
 assert.throws(()=>businessRange('2026-02-30','2026-03-01'));assert.throws(()=>businessRange('2026-01-01','2026-10-17'));
});
test('website reports strip tracking identifiers and distinguish events from sessions and page views',()=>{
 const r=websiteTotals([{id:'a',clicked_at:'x',gclid:'private',session_id:'cookie',page_url:'https://gsmweb.site/parts?gclid=private&phone=secret'},{id:'b',clicked_at:'x',gclid:null,session_id:'cookie',page_url:'https://gsmweb.site/parts?other=secret'}],'2026-10-17','2026-10-17');
 assert.equal(r.trackedEvents,2);assert.equal(r.recordedSessions,1);assert.equal(r.eventsWithAdClickIdentifier,1);assert.equal(r.pages[0].page,'https://gsmweb.site/parts');assert.ok(!JSON.stringify(r).includes('private'));assert.ok(r.notice.includes('not all page views'));
});
test('repository source access excludes credential files, traversal and real secret-like content',()=>{
 assert.equal(sourcePath('app/optimizer/page.tsx'),'app/optimizer/page.tsx');
 for(const path of ['../.env','C:/secrets','https://other/repo','app/../.env','.env.local','work/key.dpapi','.git/config','key.pem'])assert.throws(()=>sourcePath(path));
 assert.throws(()=>sourceContent('sk-ant-'+ 'a'.repeat(40)));assert.throws(()=>sourceContent('github_pat_'+ 'a'.repeat(40)));assert.throws(()=>validateSourceFiles([{path:'a.ts',content:'x'},{path:'a.ts',content:'y'}]));
});

 test('source deployment requires real build and regression checks, never a missing or pending check',()=>{
 const r={status:'success',statuses:[{name:'Vercel',state:'success'}],checks:[{name:'Agent validation',status:'completed',conclusion:'success'}]};
 assert.equal(sourceChecksReady(r),true);assert.equal(sourceChecksReady({...r,checks:[]}),false);assert.equal(sourceChecksReady({...r,status:'pending'}),false);assert.equal(sourceChecksReady({...r,checks:[{...r.checks[0],conclusion:'failure'}]}),false);
 });
