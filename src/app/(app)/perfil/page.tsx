import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { ensureDemoAccount } from '@/lib/demo-account';
import { getUsage } from '@/lib/entitlements';
import { entitlements, yearlyDiscountPercent } from '@tl/types/plans';
import { ProfileView } from './ProfileView';

export const metadata: Metadata = { title: 'Perfil y ajustes' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const [profile, subscription, account, usage, sessions, payments, certificates] = await Promise.all([
    db.profile.findUnique({ where: { userId: auth.user.id } }),
    db.subscription.findUnique({ where: { userId: auth.user.id }, include: { plan: true } }),
    ensureDemoAccount(auth.user.id),
    getUsage(auth.user.id),
    db.session.findMany({
      where: { userId: auth.user.id, revokedAt: null, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.payment.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, take: 12 }),
    db.certificate.findMany({ where: { userId: auth.user.id }, orderBy: { issuedAt: 'desc' } }),
  ]);

  const plan = entitlements(auth.user.plan);

  return (
    <ProfileView
      user={auth.user}
      profile={{
        theme: profile?.theme ?? 'system',
        reduceMotion: profile?.reduceMotion ?? false,
        highContrast: profile?.highContrast ?? false,
        emailOptIn: profile?.emailOptIn ?? false,
        experienceLevel: profile?.experienceLevel ?? 'PRINCIPIANTE',
        marketInterests: fromJson<string[]>(profile?.marketInterests ?? '[]', []),
        educationalGoal: profile?.educationalGoal ?? null,
        riskKnowledgeScore: profile?.riskKnowledgeScore ?? 0,
      }}
      subscription={
        subscription
          ? {
              planId: subscription.planId,
              planName: subscription.plan.name,
              status: subscription.status,
              interval: subscription.interval,
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
            }
          : null
      }
      balanceCents={account.balanceCents}
      resetsUsed={usage.balanceResetsThisMonth}
      resetsAllowed={plan.balanceResetsPerMonth}
      planFeatures={{
        name: plan.name,
        exportCsv: plan.features.exportCsv,
        exportPdf: plan.features.exportPdf,
        certificates: plan.features.certificates,
        priceMonthlyUsd: plan.priceMonthlyUsd,
        priceYearlyUsd: plan.priceYearlyUsd,
        yearlyDiscount: yearlyDiscountPercent(auth.user.plan),
      }}
      sessions={sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        current: s.id === auth.sessionId,
      }))}
      payments={payments.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        description: p.description,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }))}
      certificates={certificates.map((c) => ({
        id: c.id,
        trackTitle: c.trackTitle,
        verificationCode: c.verificationCode,
        verified: c.verified,
        issuedAt: c.issuedAt.toISOString(),
      }))}
    />
  );
}
