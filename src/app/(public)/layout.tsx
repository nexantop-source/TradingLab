import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { getAuth } from '@/lib/auth';

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
      <MarketingHeader authenticated={Boolean(auth)} />
      <main id="contenido" className="pt-24">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
