import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_DOCS, getLegalDoc } from '@/content/legal';
import { Badge, Card } from '@tl/ui';

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  return { title: doc?.title ?? 'Centro legal', description: doc?.summary };
}

export default async function LegalDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <nav aria-label="Ruta de navegación" className="text-[12px] text-[var(--color-muted)]">
        <Link href="/legal" className="hover:text-[var(--color-text)]">
          Centro legal
        </Link>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Versión {doc.version}</Badge>
          <span className="num text-[11px] text-[var(--color-subtle)]">En vigor desde {doc.effectiveAt}</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{doc.title}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">{doc.summary}</p>
      </header>

      <article className="mt-10 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[16px] font-semibold tracking-tight">{s.heading}</h2>
            <div className="mt-2.5 space-y-3">
              {s.body.split('\n').map((line, i) => (
                <p key={i} className="text-[14px] leading-[1.75] text-[var(--color-muted)]">
                  {line}
                </p>
              ))}
            </div>
          </section>
        ))}
      </article>

      <Card className="mt-12 p-5">
        <h2 className="text-[13px] font-semibold">Otros documentos</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
            <li key={d.slug}>
              <Link
                href={`/legal/${d.slug}`}
                className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-blue)]"
              >
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
