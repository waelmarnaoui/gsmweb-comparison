'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {LayoutList,Sparkles} from 'lucide-react';
import AdsAgent from '@/components/ads-agent';
import './agent.css';
export default function Marketing(){
 const [notice,setNotice]=useState('');
 useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get('error'))setNotice(p.get('error')!);else if(p.get('connected'))setNotice('Reporting account connected.');window.history.replaceState({},'',window.location.pathname);},[]);
 return <main className="setup-main"><div className="workspace-heading"><h1>AI Marketing</h1><div className="agent-controls"><Link className="secondary" href="/optimizer/ads"><LayoutList size={16}/>Ads & status</Link><Link className="primary" href="/ai-ads/opportunities"><Sparkles size={16}/>Create ads</Link></div></div>{notice&&<p role="status" className="agent-notice">{notice}</p>}<AdsAgent/></main>;
}
