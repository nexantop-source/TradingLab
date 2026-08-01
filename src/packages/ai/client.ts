import type { AIEducationalAnalysis } from '@tl/types';
import { aiAnalysisSchema, AI_ANALYSIS_JSON_SCHEMA } from './schema';
import { getPrompt } from './prompts';

/**
 * Cliente de la Responses API de OpenAI.
 *
 * Solo puede ejecutarse en el servidor. La clave nunca sale del backend: no
 * hay ninguna ruta que la devuelva ni ninguna variable `NEXT_PUBLIC_` que la
 * contenga.
 */

export interface AICallParams {
  promptVersionId: string;
  /** Bloques de contexto ya construidos y saneados por el backend. */
  contextBlocks: string[];
  instruction: string;
  /** Presupuesto máximo de tokens de salida. */
  maxOutputTokens?: number;
}

export interface AICallResult {
  analysis: AIEducationalAnalysis;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  model: string;
  costUsd: number;
  latencyMs: number;
}

export class AIUnavailableError extends Error {
  constructor(message: string, readonly reason: 'NO_KEY' | 'UPSTREAM' | 'INVALID_OUTPUT' | 'TIMEOUT' | 'MODERATED') {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

/** Precios por millón de tokens. Se usan para estimar coste por usuario y plan. */
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_USD_PER_MTOK[model] ?? PRICING_USD_PER_MTOK['gpt-4.1-mini'];
  return Number(((inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output).toFixed(6));
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10);
}

/** Moderación de entrada. Falla de forma segura: ante error, deja pasar y registra. */
export async function moderateInput(text: string): Promise<{ flagged: boolean; categories: string[] }> {
  if (!isAIConfigured()) return { flagged: false, categories: [] };
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  try {
    const res = await fetch(`${base}/moderations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { flagged: false, categories: [] };
    const json = (await res.json()) as {
      results?: Array<{ flagged: boolean; categories: Record<string, boolean> }>;
    };
    const r = json.results?.[0];
    if (!r) return { flagged: false, categories: [] };
    return {
      flagged: r.flagged,
      categories: Object.entries(r.categories ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k),
    };
  } catch {
    return { flagged: false, categories: [] };
  }
}

/**
 * Llamada al modelo con salida estructurada obligatoria.
 * Reintenta una vez ante fallo transitorio de red o de validación.
 */
export async function callEducationalModel(params: AICallParams): Promise<AICallResult> {
  if (!isAIConfigured()) {
    throw new AIUnavailableError('No hay credencial de OpenAI configurada.', 'NO_KEY');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const prompt = getPrompt(params.promptVersionId);
  const started = Date.now();

  const body = {
    model,
    input: [
      { role: 'system', content: prompt.system },
      {
        role: 'user',
        content: `${params.contextBlocks.join('\n\n')}\n\nTAREA\n${params.instruction}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'analisis_educativo',
        strict: true,
        schema: AI_ANALYSIS_JSON_SCHEMA,
      },
    },
    max_output_tokens: params.maxOutputTokens ?? 1800,
    // Temperatura baja: el objetivo es consistencia pedagógica, no creatividad.
    temperature: 0.3,
    store: false,
  };

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${base}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });

      if (!res.ok) {
        const detail = await res.text();
        if (res.status === 429 || res.status >= 500) {
          lastError = new AIUnavailableError(`Proveedor de IA no disponible (${res.status}).`, 'UPSTREAM');
          continue;
        }
        throw new AIUnavailableError(`Error del proveedor de IA (${res.status}): ${detail.slice(0, 300)}`, 'UPSTREAM');
      }

      const json = (await res.json()) as {
        output_text?: string;
        output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
        usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
      };

      const raw =
        json.output_text ??
        json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text ??
        null;

      if (!raw) throw new AIUnavailableError('La respuesta del modelo llegó vacía.', 'INVALID_OUTPUT');

      const parsed = aiAnalysisSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        lastError = new AIUnavailableError(
          `La respuesta no cumple el esquema: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
          'INVALID_OUTPUT',
        );
        continue;
      }

      const inputTokens = json.usage?.input_tokens ?? 0;
      const outputTokens = json.usage?.output_tokens ?? 0;

      return {
        analysis: parsed.data,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: json.usage?.total_tokens ?? inputTokens + outputTokens,
        },
        model,
        costUsd: estimateCost(model, inputTokens, outputTokens),
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      lastError = err;
      if (err instanceof AIUnavailableError && err.reason === 'UPSTREAM') continue;
      if (err instanceof Error && err.name === 'TimeoutError') {
        lastError = new AIUnavailableError('El proveedor de IA no respondió a tiempo.', 'TIMEOUT');
        continue;
      }
      break;
    }
  }

  if (lastError instanceof AIUnavailableError) throw lastError;
  throw new AIUnavailableError(
    lastError instanceof Error ? lastError.message : 'Fallo desconocido al llamar al modelo.',
    'UPSTREAM',
  );
}

export { estimateCost };
