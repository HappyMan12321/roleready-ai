import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'RoleReady — Your experience, clearly expressed',description:'An evidence-first resume workspace. Find your match, strengthen your wording, and keep every claim true to you.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
