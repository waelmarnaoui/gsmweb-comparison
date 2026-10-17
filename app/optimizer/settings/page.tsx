'use client';
import AdvisorSettings from '@/components/advisor-settings';
import AgentAccess from '@/components/agent-access';
import {useState} from 'react';
export default function Settings(){const [saved,setSaved]=useState(false);return <main className="setup-main"><h1>Settings & activity</h1>{saved&&<p role="status">AI settings saved.</p>}<AdvisorSettings onConfigured={()=>setSaved(true)}/><AgentAccess/></main>;}
