import type { Metadata } from 'next';
import Link from 'next/link';
import { GLOSSARY } from '@/content/glossary';
import { Badge, Card } from '@tl/ui';

export const metadata: Metadata = {
  title: 'Glosario',
  description: 'Definiciones claras de los términos que aparecen en el análisis y la gestión del riesgo.',
};

const CATEGORY_LABEL: Record<string, string> = {
  general: 'General',
  tecnico: 'Análisis técnico',
  riesgo: 'Gestión del riesgo',
  forex: 'Forex',
  cripto: 'Criptoactivos',
  fundamental: 'Análisis fundamental',
};

export default function GlossaryPage() {
  const byCategory = new Map<string, typeof GLOSSARY>();
  for (const term of [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'es'))) {
    const list = byCategory.get(term.category);
    if (list) list.push(term);
    else byCategory.set(term.category, [term]);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <header>
        <Badge tone="blue">Recursos</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Glosario</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          {GLOSSARY.length} términos explicados sin jerga innecesaria. Cuando una definición corriente induce a
          error, lo decimos.
        </p>
      </header>

      <nav aria-label="Categorías" className="mt-8 flex flex-wrap gap-2">
        {Array.from(byCategory.keys()).map((c) => (
          <a
            key={c}
            href={`#${c}`}
            className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-[12px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
          >
            {CATEGORY_LABEL[c] ?? c}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-10">
        {Array.from(byCategory.entries()).map(([category, terms]) => (
          <section key={category} id={category} className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">{CATEGORY_LABEL[category] ?? category}</h2>
            <dl className="mt-4 space-y-3">
              {terms.map((t) => (
                <Card key={t.slug} id={t.slug} className="scroll-mt-24 p-5">
                  <dt className="text-[15px] font-semibold">{t.term}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">{t.definition}</dd>
                  {t.related.length > 0 && (
                    <dd className="mt-3 flex flex-wrap gap-2">
                      {t.related.map((r) => (
                        <Link
                          key={r}
                          href={`#${r}`}
                          className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-subtle)] hover:text-[var(--color-blue)]"
                        >
                          {r.replace(/-/g, ' ')}
                        </Link>
                      ))}
                    </dd>
                  )}
                </Card>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
