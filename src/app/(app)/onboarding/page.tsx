import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { OnboardingFlow } from './OnboardingFlow';
import { ASSESSMENT, EDUCATIONAL_GOALS, WEEKLY_AVAILABILITY } from '@/content/assessment';
import { TRACKS, trackStats } from '@/content/academy';
import { checkoutPath, parseCheckoutIntent } from '@/lib/checkout-intent';

export const metadata: Metadata = { title: 'Configuración inicial' };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const intent = parseCheckoutIntent(await searchParams);
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  if (auth.user.onboardingCompleted) redirect(intent ? checkoutPath(intent) : '/panel');

  return (
    <OnboardingFlow
      userName={auth.user.name}
      checkoutIntent={intent}
      questions={ASSESSMENT.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options.map((o) => o.label),
      }))}
      goals={EDUCATIONAL_GOALS.map((g) => ({ value: g.value, label: g.label }))}
      availability={WEEKLY_AVAILABILITY.map((a) => ({ value: a.value, label: a.label }))}
      tracks={TRACKS.map((t) => {
        const s = trackStats(t);
        return { slug: t.slug, title: t.title, summary: t.summary, lessons: s.lessons, minutes: s.minutes };
      })}
    />
  );
}
