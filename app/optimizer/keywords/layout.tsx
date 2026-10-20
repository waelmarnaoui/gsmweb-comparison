'use client';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import '@/components/keywords.css';
const links=[['/optimizer/keywords','Search terms'],['/optimizer/keywords/budget','Budget & quality'],['/optimizer/keywords/search-console','My website'],['/optimizer/keywords/demand','Google keyword demand']];
export default function Layout({children}:{children:ReactNode}){const path=usePathname();return <><nav className="keyword-subnav" aria-label="Keywords">{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>{children}</>;}
