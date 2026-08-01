import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { getNews } from '@tl/market-data';
import { Badge, Card, Button } from '@tl/ui';
import { formatDate } from '@/lib/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getNews(slug);
  return { title: article?.title ?? 'Artículo', description: article?.summary };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const { slug } = await params;
  const article = getNews(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <nav aria-label="Ruta de navegación" className="text-[12px] text-[var(--color-muted)]">
        <Link href="/noticias" className="hover:text-[var(--color-text)]">
          Artículos educativos
        </Link>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="violet">Educativo</Badge>
          <span className="num text-[11px] text-[var(--color-subtle)]">
            {article.readingMinutes} min · {formatDate(article.publishedAt, auth.user.timezone)}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.025em]">{article.title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">{article.summary}</p>
      </header>

      <article className="mt-8 space-y-4">
        {article.body.split('\n\n').map((p, i) => (
          <p key={i} className="text-[14px] leading-[1.75] text-[var(--color-muted)]">
            {p}
          </p>
        ))}
      </article>

      <Card className="mt-8 p-4">
        <p className="text-[11px] leading-relaxed text-[var(--color-subtle)]">
          Fuente: {article.source}. Contenido educativo de carácter general. No constituye asesoramiento de
          inversión ni recomendación sobre ningún instrumento concreto.
        </p>
      </Card>

      {article.relatedSymbols.length > 0 && (
        <div className="mt-6">
          <p className="text-[12px] text-[var(--color-muted)]">Instrumentos mencionados:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {article.relatedSymbols.map((s) => (
              <Link key={s} href={`/terminal?symbol=${s}`}>
                <Button size="sm" variant="outline">
                  {s}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
