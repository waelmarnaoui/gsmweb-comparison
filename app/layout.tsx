import './globals.css';
import './mobile.css';
import type {Viewport} from 'next';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',interactiveWidget:'resizes-content'};
export const metadata = { title: 'GSMWeb | Attribution', description: 'Call attribution and recorded revenue review' };
export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
