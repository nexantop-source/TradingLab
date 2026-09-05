import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { WelcomeExperience } from '@/components/pwa/WelcomeExperience';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tu laboratorio, contigo' };
export default async function AppEntry() {
  const auth = await getAuth();
  if (auth) redirect(auth.user.onboardingCompleted ? '/panel' : '/onboarding');
  return <WelcomeExperience />;
}
