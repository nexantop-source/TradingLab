import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { listNews } from '@tl/market-data';
import { Badge, Card, Callout } from '@tl/ui';
import { AdSlot } from '@/components/AdSlot';

export const metadata: Metadata = { title: 'Artículos educativos' };

export default async function NewsPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const articles = listNews();

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Artículos educativos</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Contenido propio que explica mecanismos, no titulares de actualidad.
        </p>
      </header>

      <Callout tone="info" title="Por qué no verás noticias de mercado aquí todavía">
        Publicar noticias de actualidad exige una licencia de contenido con un proveedor autorizado. Hasta
        entonces preferimos no mostrar nada antes que mostrar información sin procedencia verificable. Estos
        artículos son material educativo redactado por nuestro equipo y están marcados como tal.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-2">
        {articles.map((a) => (
          <Link key={a.id} href={`/noticias/${a.slug}`}>
            <Card className="h-full p-5 transition-colors hover:border-[var(--color-blue)]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="violet">Educativo</Badge>
                <span className="num text-[10px] text-[var(--color-subtle)]">{a.readingMinutes} min</span>
              </div>
              <h2 className="mt-3 text-[15px] font-semibold leading-snug tracking-tight">{a.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">{a.summary}</p>
              <p className="mt-3 text-[11px] text-[var(--color-subtle)]">{a.tags.join(' · ')}</p>
            </Card>
          </Link>
        ))}
      </div>

      <AdSlot code="news-native" page="news" plan={auth.user.plan} />
    </div>
  );
}
