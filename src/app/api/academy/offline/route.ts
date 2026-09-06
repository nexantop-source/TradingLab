import { createHash } from 'node:crypto';
import { handleError, ok } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { planAtLeast } from '@tl/types/plans';
import type { LessonBlock, PlanId } from '@tl/types';

/**
 * Paquete de lecciones descargable para leer sin conexión.
 *
 * Devuelve **solo** las lecciones publicadas a las que el plan vigente de la
 * cuenta da acceso: el filtro es el mismo `minPlan` que protege la ruta de
 * lectura, así que descargar no puede convertirse en una vía para saltarse el
 * muro de pago.
 *
 * No incluye progreso, notas, cuestionarios ni ningún dato personal: es
 * material de estudio, y por eso puede vivir en el dispositivo. Los bloques
 * que dependen de mercado en vivo se cuentan pero no se sirven, porque sin
 * conexión no hay precio que dibujar y fingirlo sería inventar un gráfico.
 */
export async function GET() {
  try {
    const { user } = await requireAuth();

    const lessons = await db.lesson.findMany({
      where: { published: true },
      orderBy: [{ position: 'asc' }],
      select: {
        slug: true,
        title: true,
        summary: true,
        blocks: true,
        estimatedMinutes: true,
        position: true,
        minPlan: true,
        module: {
          select: {
            course: {
              select: { title: true, published: true, track: { select: { title: true, published: true } } },
            },
          },
        },
      },
    });

    const entitled = lessons.filter(
      (lesson) =>
        planAtLeast(user.plan, lesson.minPlan as PlanId) &&
        lesson.module.course.published &&
        lesson.module.course.track.published,
    );

    const payload = entitled.map((lesson) => {
      const blocks = fromJson<LessonBlock[]>(lesson.blocks, []);
      const readable = blocks.filter((block) => block.type !== 'chart');
      return {
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        blocks: readable,
        liveBlocks: blocks.length - readable.length,
        estimatedMinutes: lesson.estimatedMinutes,
        position: lesson.position,
        trackTitle: lesson.module.course.track.title,
        courseTitle: lesson.module.course.title,
      };
    });

    return ok({
      lessons: payload,
      // Identifica la descarga sin exponer el identificador de la cuenta: si
      // otra persona entra en el mismo dispositivo, el ámbito no coincide y el
      // contenido descargado se borra antes de escribir nada.
      scope: createHash('sha256').update(`${user.id}:${user.plan}`).digest('hex').slice(0, 16),
      generatedAt: Date.now(),
    });
  } catch (error) {
    return handleError(error);
  }
}
