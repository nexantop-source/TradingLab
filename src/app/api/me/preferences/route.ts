import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { preferencesSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = preferencesSchema.parse(await req.json());

    if (input.locale || input.timezone) {
      await db.user.update({
        where: { id: user.id },
        data: {
          ...(input.locale ? { locale: input.locale } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
        },
      });
    }

    const profileData = {
      ...(input.theme ? { theme: input.theme } : {}),
      ...(input.reduceMotion != null ? { reduceMotion: input.reduceMotion } : {}),
      ...(input.highContrast != null ? { highContrast: input.highContrast } : {}),
      ...(input.emailOptIn != null ? { emailOptIn: input.emailOptIn } : {}),
      ...(input.studyReminderOptIn != null ? { studyReminderOptIn: input.studyReminderOptIn } : {}),
      ...(input.studyReminderHour != null ? { studyReminderHour: input.studyReminderHour } : {}),
    };

    if (Object.keys(profileData).length > 0) {
      await db.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...profileData },
        update: profileData,
      });
    }

    return ok({ updated: true });
  } catch (error) {
    return handleError(error);
  }
}
