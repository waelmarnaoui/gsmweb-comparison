import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('chat mode defaults to read only on both client and server',()=>{
 const component=readFileSync('components/ads-agent.tsx','utf8'),route=readFileSync('app/api/optimizer/chat/route.ts','utf8');
 assert.match(component,/\[readOnly,setReadOnly\]=useState\(true\)/);
 assert.match(component,/readOnly:readOnly\|\|reviewOnly/);
 assert.match(route,/readOnly:body.readOnly!==false/);
 assert.match(component,/fieldset disabled=\{busy\|\|voiceActive\}/);
});
