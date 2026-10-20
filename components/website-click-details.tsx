import type {WebsiteClickDetails} from '@/lib/website-click-details';
import {formatRomanianTimestamp} from '@/lib/timestamps';
import './website-click-details.css';

export function WebsiteClickEvidence({click}:{click:WebsiteClickDetails|null}){
 if(!click)return <small>No website click matched</small>;
 const fields=[['Click time · Bucharest',formatRomanianTimestamp(click.clickedAt)],['GCLID',click.gclid||'Not captured'],['GBRAID',click.gbraid||'Not captured'],['WBRAID',click.wbraid||'Not captured'],['Campaign',click.campaign||'Not captured'],['Page URL',click.pageUrl||'Not captured'],['Session ID',click.sessionId||'Not captured'],['Click ID',click.id],['Import source',click.sourceKey],['Click → first contact',click.delaySeconds===null?'Unavailable':click.delaySeconds+' seconds']];
 return <details className="website-click-evidence"><summary>{click.gclid?'GCLID present':'Website click matched · No GCLID'}</summary><dl>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Not captured'}</dd></div>)}</dl></details>;
}
