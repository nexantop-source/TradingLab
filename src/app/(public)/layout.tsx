import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { getAuth } from '@/lib/auth';
import Link from 'next/link';
import { PublicAppChrome } from '@/components/pwa/PublicAppChrome';

/**
 * La cabecera muestra «Iniciar sesión» o «Ir a mi panel» según la cookie, de
 * modo que estas páginas tampoco pueden servirse desde una caché compartida.
 *
 * El coste es que el centro legal deja de generarse de forma estática. Es
 * asumible: son páginas baratas de renderizar. Si en algún momento pesa,
 * la salida limpia es sacar el estado de sesión de la cabecera a un componente
 * de cliente, y devolver estas rutas a estáticas.
 */
export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  return (
    <div className="marketing-page">
      <div className="browser-marketing-header"><MarketingHeader authenticated={Boolean(auth)} /></div>
      <PublicAppChrome authenticated={Boolean(auth)} />
      <main id="contenido" className="pt-24">
        {children}
      </main>
      <div className="browser-marketing-footer"><MarketingFooter /></div>
      <footer className="native-public-footer"><Link href="/legal/terminos">Términos</Link><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/riesgo">Riesgos</Link><p>Educación y simulación. No es un broker.</p></footer>
    </div>
  );
}
