import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { getAuth } from '@/lib/auth';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  return (
    <>
      <MarketingHeader authenticated={Boolean(auth)} />
      <main id="contenido" className="pt-24">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
