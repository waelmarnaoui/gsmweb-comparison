import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clickSyncReason} from '../lib/click-sync-state';
const now=Date.parse('2026-10-10T09:00:00Z');
test('missing, wrong-sheet, failed, stale and future import status blocks export',()=>{
 assert.ok(clickSyncReason(null,'sheet',now));
 for(const state of [
  {sheet_id:'other',synced_at:'2026-10-10T08:59:00Z',action:'SYNC_SUCCESS'},
  {sheet_id:'sheet',synced_at:'2026-10-10T08:59:00Z',action:'SYNC_FAILED'},
  {sheet_id:'sheet',synced_at:'2026-10-10T08:29:59Z',action:'SYNC_SUCCESS'},
  {sheet_id:'sheet',synced_at:'2026-10-10T09:01:00Z',action:'SYNC_SUCCESS'},
  {sheet_id:'sheet',synced_at:'invalid',action:'SYNC_SUCCESS'}
 ])assert.ok(clickSyncReason(state,'sheet',now));
 assert.equal(clickSyncReason({sheet_id:'sheet',synced_at:'2026-10-10T08:30:00Z',action:'SYNC_SUCCESS'},'sheet',now),'');
});
