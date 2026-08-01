import { z } from 'zod';
import { UNCERTAINTY_LEVELS } from '@tl/types';

/**
 * Esquema de la respuesta del entrenador educativo.
 *
 * Se usa dos veces:
 *  1. Como `json_schema` en la llamada a la Responses API de OpenAI, para que
 *     el modelo esté obligado a producir esta forma.
 *  2. Como validación en el servidor al recibir la respuesta. Si no valida,
 *     no se muestra al usuario ni se persiste.
 */

export const aiAnalysisSchema = z.object({
  contextSummary: z.string().min(20).max(700),
  observedTrend: z.string().min(10).max(400),
  bullishEvidence: z.array(z.string().min(5).max(300)).min(1).max(6),
  bearishEvidence: z.array(z.string().min(5).max(300)).min(1).max(6),
  relevantIndicators: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        reading: z.string().min(1).max(80),
        interpretation: z.string().min(5).max(300),
      }),
    )
    .max(8),
  risks: z.array(z.string().min(5).max(300)).min(1).max(6),
  bullishScenario: z.string().min(20).max(600),
  bearishScenario: z.string().min(20).max(600),
  invalidationConditions: z.array(z.string().min(5).max(300)).min(1).max(5),
  questionsForStudent: z.array(z.string().min(8).max(250)).min(2).max(5),
  recommendedLesson: z
    .object({
      slug: z.string().min(1).max(80),
      title: z.string().min(1).max(120),
      reason: z.string().min(5).max(300),
    })
    .nullable(),
  uncertaintyLevel: z.enum(UNCERTAINTY_LEVELS),
  sourcesUsed: z.array(z.string().min(2).max(200)).max(10),
  educationalDisclaimer: z.string().min(20).max(500),
});

export type AIAnalysisPayload = z.infer<typeof aiAnalysisSchema>;

/**
 * Mismo esquema en JSON Schema, para `text.format` de la Responses API.
 * OpenAI exige `additionalProperties: false` y que todas las claves estén en
 * `required` cuando `strict: true`.
 */
export const AI_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'contextSummary',
    'observedTrend',
    'bullishEvidence',
    'bearishEvidence',
    'relevantIndicators',
    'risks',
    'bullishScenario',
    'bearishScenario',
    'invalidationConditions',
    'questionsForStudent',
    'recommendedLesson',
    'uncertaintyLevel',
    'sourcesUsed',
    'educationalDisclaimer',
  ],
  properties: {
    contextSummary: { type: 'string', description: 'Resumen neutro de lo que el estudiante está viendo.' },
    observedTrend: { type: 'string', description: 'Tendencia observada en los datos entregados. Describir, no predecir.' },
    bullishEvidence: { type: 'array', items: { type: 'string' }, description: 'Evidencias compatibles con un escenario alcista.' },
    bearishEvidence: { type: 'array', items: { type: 'string' }, description: 'Evidencias compatibles con un escenario bajista.' },
    relevantIndicators: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'reading', 'interpretation'],
        properties: {
          name: { type: 'string' },
          reading: { type: 'string', description: 'Valor exacto recibido en el contexto. Nunca inventar.' },
          interpretation: { type: 'string' },
        },
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
    bullishScenario: { type: 'string' },
    bearishScenario: { type: 'string' },
    invalidationConditions: { type: 'array', items: { type: 'string' } },
    questionsForStudent: { type: 'array', items: { type: 'string' } },
    recommendedLesson: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['slug', 'title', 'reason'],
      properties: {
        slug: { type: 'string' },
        title: { type: 'string' },
        reason: { type: 'string' },
      },
    },
    uncertaintyLevel: { type: 'string', enum: ['ALTA', 'MEDIA', 'BAJA'] },
    sourcesUsed: { type: 'array', items: { type: 'string' } },
    educationalDisclaimer: { type: 'string' },
  },
} as const;
