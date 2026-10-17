'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Activity,ArrowLeft,BarChart3,Bot,ChevronDown,ClipboardCheck,FileCheck,LayoutList,Menu,MessageCircle,Package,Settings,ShieldCheck,Sparkles,Target,X} from 'lucide-react';
import './workspace.css';
import './workspace-responsive.css';
const marketing=[['/optimizer','AI chat',Bot],['/optimizer/ads','Ads & status',LayoutList],['/ai-ads/opportunities','Create ads',Sparkles],['/ai-ads','Stock & drafts',Package],['/optimizer/reports','Campaign reports',BarChart3],['/ai-ads/control','Account controls',ShieldCheck],['/optimizer/settings','Settings & activity',Settings]] as const;
const conversions=[['/review','Conversion review',ClipboardCheck],['/whatsapp','WhatsApp leads',MessageCircle],['/crm','CRM comparison',Target],['/ads','Google Ads connection',FileCheck]] as const;
export default function WorkspaceShell({children}:{children:ReactNode}){
 const path=usePathname(),[open,setOpen]=useState(false),isMarketing=path.startsWith('/optimizer')||path.startsWith('/ai-ads');
 const [mobile,setMobile]=useState(false),menuButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const query=window.matchMedia('(max-width:1000px)'),update=()=>setMobile(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);menuButton.current?.focus();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[open]);
 const links=isMarketing?marketing:conversions,title=isMarketing?'AI Marketing':'Conversions';
 return <div className={'workspace-shell '+(isMarketing?'marketing-workspace':'conversion-workspace')}><a className="workspace-skip" href="#workspace-content">Skip to content</a><header className="workspace-mobile"><Link href="/optimizer"><Activity size={20}/>GSMWeb</Link><button ref={menuButton} type="button" className="workspace-icon" aria-label={open?'Close workspace menu':'Open workspace menu'} aria-expanded={open} aria-controls="workspace-nav" onClick={()=>setOpen(!open)}>{open?<X size={20}/>:<Menu size={20}/>}</button></header>
 {open&&<button className="workspace-shade" aria-label="Close workspace menu" onClick={()=>setOpen(false)}/>}
 <aside inert={mobile&&!open} id="workspace-nav" className={'workspace-nav'+(open?' is-open':'')}><Link href="/" className="workspace-brand"><span><Activity size={22}/></span><b>GSMWeb<small>BUSINESS WORKSPACE</small></b></Link><Link href="/" className="workspace-back"><ArrowLeft size={16}/>Dashboard</Link><Link className={'workspace-group '+(isMarketing?'selected':'')} href="/optimizer"><Bot size={19}/>AI Marketing<ChevronDown size={15}/></Link>{isMarketing&&<nav aria-label="AI Marketing">{marketing.map(([href,label,Icon])=><Link key={href} href={href} aria-current={path===href?'page':undefined} onClick={()=>setOpen(false)}><Icon size={17}/>{label}</Link>)}</nav>}
 <Link className={'workspace-group '+(!isMarketing?'selected':'')} href="/review"><ClipboardCheck size={19}/>Conversions<ChevronDown size={15}/></Link>{!isMarketing&&<nav aria-label="Conversions">{conversions.map(([href,label,Icon])=><Link key={href} href={href} aria-current={path===href?'page':undefined} onClick={()=>setOpen(false)}><Icon size={17}/>{label}</Link>)}</nav>}<div className="workspace-nav-bottom"><Link href="/connections"><Settings size={17}/>Connections</Link><small>Bucharest · GSMWeb</small></div></aside>
 <div className="workspace-body"><header className="workspace-top"><span>{title}</span><nav aria-label="Quick access">{links.slice(0,3).map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav></header><div id="workspace-content" tabIndex={-1}>{children}</div></div></div>;
}
