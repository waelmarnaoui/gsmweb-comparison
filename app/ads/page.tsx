'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,Link2,RefreshCw} from 'lucide-react';
type Item={id:string;ready:boolean;authorized:boolean;error:string};
export default function AdsSetup(){
 const [item,setItem]=useState<Item|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{const response=await fetch('/api/integrations',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Connection check failed');setItem(result.items.find((i:Item)=>i.id==='google_ads'));}catch(e){setNotice(e instanceof Error?e.message:'Connection check failed');}}
 useEffect(()=>{refresh();const params=new URLSearchParams(window.location.search);if(params.get('error'))setNotice(params.get('error')!);if(params.get('connected'))setNotice('Google account authorized. Ads destination validation and upload activation are still pending.');},[]);
 async function connect(){setBusy(true);try{const response=await fetch('/api/integrations/google_ads/start',{method:'POST',cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Connection failed');window.location.assign(result.url);}catch(e){setNotice(e instanceof Error?e.message:'Connection failed');setBusy(false);}}
 return <div className="setup-page"><header className="setup-header"><a className="secondary" href="/"><ArrowLeft size={16}/>Dashboard</a><strong>GSMWeb</strong><a href="/connections">Connections</a></header><main className="setup-main"><div className="section-heading"><h1>Google Ads</h1><button className="secondary" onClick={refresh}><RefreshCw size={16}/>Refresh</button></div>{notice&&<p role="status">{notice}</p>}{item?.error&&<p role="alert">{item.error}</p>}<section className="setup-provider"><h2>GSMWeb CRM conversions</h2><p>Account: 205-043-4247</p><p>Conversion action: 7791753827</p><p>GSMWeb CRM - All records from GSMWeb CRM</p><p>{item?.authorized?'Account authorized':item?.ready?'Not connected':'Registration pending'}</p><button className="primary" disabled={!item?.ready||busy} onClick={connect}><Link2 size={16}/>{item?.authorized?'Reconnect Google Ads':'Connect Google Ads'}</button><p>Automatic uploads: not activated</p></section></main></div>;
}

