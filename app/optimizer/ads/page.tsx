import Link from 'next/link';
import {Sparkles} from 'lucide-react';
import PublishingPanel from '@/components/publishing-panel';
export default function Ads(){return <main className="setup-main"><div className="workspace-heading"><h1>Ads & status</h1><Link className="primary" href="/ai-ads/opportunities"><Sparkles size={16}/>Create ads</Link></div><PublishingPanel/></main>;}
