import Link from 'next/link';
import BrandLogo from '@/components/brand-logo';
import './legal.css';
export default function LegalLayout({children}:{children:React.ReactNode}){
 return <div className="legal-page"><header><Link href="/login" aria-label="GSMWeb sign-in"><BrandLogo/></Link><nav aria-label="Legal pages"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link></nav></header><main>{children}</main><footer><p>GSMWEB SRL</p><a href="mailto:contact@gsmweb.ro">contact@gsmweb.ro</a><Link href="/login">Workspace sign-in</Link></footer></div>;
}
