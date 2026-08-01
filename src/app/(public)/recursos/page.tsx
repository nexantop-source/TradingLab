import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Newspaper, ScrollText, ShieldAlert, LineChart } from 'lucide-react';
import { TRACKS, trackStats } from '@/content/academy';
import { listNews } from '@tl/market-data';
import { Badge, Card } from '@tl/ui';

export const metadata: Metadata = {
  title: 'Recursos',
  description: 'Rutas educativas, artículos, glosario y materiales de prevención del fraude financiero.',
};

export default function ResourcesPage() {
  const articles = listNews({ limit: 6 });

  const SECTIONS = [
    {
      icon: BookOpen,
      title: 'Academia',
      body: `${TRACKS.length} rutas educativas que van del primer concepto a la creación de una estrategia propia.`,
      href: '#rutas',
      cta: 'Ver las rutas',
    },
    {
      icon: ScrollText,
      title: 'Glosario',
      body: 'Definiciones claras de los términos que aparecen en el análisis y en la gestión del riesgo.',
      href: '/glosario',
      cta: 'Abrir el glosario',
    },
    {
      icon: LineChart,
      title: 'Mercados',
      body: 'Todos los instrumentos disponibles, con su horario, volatilidad y spread virtual.',
      href: '/mercados',
      cta: 'Ver los mercados',
    },
    {
      icon: ShieldAlert,
      title: 'Prevención del fraude',
      body: 'Cómo reconocer una estafa financiera antes de entregar dinero o datos personales.',
      href: '/crear-cuenta',
      cta: 'Acceder a la ruta',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <header>
        <Badge tone="blue">Recursos</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">Centro de recursos</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Material educativo abierto. Todo lo que publicamos aquí puede leerse sin necesidad de crear una cuenta.
        </p>
      </header>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full p-5 transition-colors hover:border-[var(--color-blue)]">
              <span className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-blue-soft)] text-[var(--color-blue)]">
                <s.icon className="size-4.5" aria-hidden="true" />
              </span>
              <h2 className="mt-3.5 text-[15px] font-semibold tracking-tight">{s.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-muted)]">{s.body}</p>
              <p className="mt-3 text-[12px] font-medium text-[var(--color-blue)]">{s.cta} →</p>
            </Card>
          </Link>
        ))}
      </div>

      <section id="articulos" className="mt-14 scroll-mt-24">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Newspaper className="size-5 text-[var(--color-muted)]" aria-hidden="true" />
          Artículos educativos
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Card key={a.id} className="p-5">
              <span className="num text-[10px] text-[var(--color-subtle)]">{a.readingMinutes} min</span>
              <h3 className="mt-2 text-[14px] font-semibold leading-snug">{a.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-muted)]">{a.summary}</p>
              <p className="mt-3 text-[11px] text-[var(--color-subtle)]">{a.tags.join(' · ')}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-[var(--color-subtle)]">
          Los artículos completos están disponibles dentro de la plataforma.{' '}
          <Link href="/crear-cuenta" className="text-[var(--color-blue)] hover:underline">
            Crea tu cuenta gratis
          </Link>{' '}
          para leerlos.
        </p>
      </section>

      <section id="rutas" className="mt-14 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight">Rutas educativas</h2>
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => {
            const s = trackStats(t);
            return (
              <Card key={t.slug} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={t.level === 'BASICO' ? 'positive' : t.level === 'INTERMEDIO' ? 'blue' : 'violet'}>
                    {t.level === 'BASICO' ? 'Básico' : t.level === 'INTERMEDIO' ? 'Intermedio' : 'Avanzado'}
                  </Badge>
                  <span className="num text-[10px] text-[var(--color-subtle)]">
                    {s.lessons} · {s.minutes} min
                  </span>
                </div>
                <h3 className="mt-2.5 text-[13px] font-semibold">{t.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{t.summary}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
