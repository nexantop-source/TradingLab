'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, UserRound } from 'lucide-react';

export function PublicAppChrome({ authenticated }: { authenticated: boolean }) {
  const path = usePathname();
  const title = path === '/precios' ? 'Planes' : path.startsWith('/legal') ? 'Información legal' : path === '/mercados' ? 'Mercados' : 'TradingLab';
  return <header className="native-public-header">
    <Link href="/app"><ChevronLeft size={22} aria-hidden="true" /><span>Mi espacio</span></Link>
    <span>{title}</span>
    <Link href={authenticated ? '/perfil' : '/entrar'} aria-label={authenticated ? 'Mi cuenta' : 'Iniciar sesión'}><UserRound size={21} aria-hidden="true" /></Link>
  </header>;
}
