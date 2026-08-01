import { FORBIDDEN_CLAIMS, DISCLAIMERS } from '@tl/types/compliance';
import type { AIEducationalAnalysis } from '@tl/types';

/**
 * Guardarraíles de salida.
 *
 * Segunda línea de defensa después del prompt y del esquema estructurado.
 * Se ejecuta sobre **toda** respuesta antes de mostrarla o persistirla,
 * incluida la del analizador determinístico local.
 */

export interface GuardrailReport {
  passed: boolean;
  /** Motivos por los que se bloqueó o se marcó la respuesta. */
  violations: Array<{ rule: string; detail: string; severity: 'BLOCK' | 'FLAG' }>;
}

/**
 * Órdenes imperativas de compra o venta.
 *
 * El verbo y el adverbio de urgencia rara vez van pegados: lo habitual es
 * «compra EUR/USD ahora». Por eso se busca la coincidencia dentro de la misma
 * oración, no en palabras contiguas. La segunda regla cubre el imperativo a
 * principio de frase aunque no haya urgencia explícita.
 */
const IMPERATIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  {
    re: /\b(compra|vende|comprá|vendé)\b[^.!?\n]{0,60}\b(ahora|ya|inmediatamente|hoy mismo)\b/i,
    label: 'orden imperativa con urgencia',
  },
  {
    re: /(?:^|[.!?\n]\s*)(compra|vende|comprá|vendé)\s+\S+/i,
    label: 'orden imperativa de compra o venta',
  },
  { re: /\bdeb(es|erías)\s+(comprar|vender|entrar|abrir\s+una\s+posición)\b/i, label: 'instrucción directiva de operar' },
  { re: /\bte\s+recomiendo\s+(comprar|vender|invertir)\b/i, label: 'recomendación directa de operar' },
  { re: /\bentra\s+(ahora|ya)\b/i, label: 'llamada a entrar de inmediato' },
  { re: /\bes\s+el\s+momento\s+de\s+(comprar|vender)\b/i, label: 'urgencia de mercado' },
];

/** Afirmaciones de certeza sobre el futuro. */
const CERTAINTY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(va\s+a|vas?\s+a)\s+(subir|bajar|caer|dispararse)\b/i, label: 'predicción en futuro simple' },
  { re: /\bseguro\s+que\s+(sube|baja|subirá|bajará)\b/i, label: 'certeza sobre la dirección' },
  { re: /\b(sin\s+duda|con\s+certeza|garantizado|garantizada)\b/i, label: 'lenguaje de certeza' },
  { re: /\bsiempre\s+(sube|baja|funciona)\b/i, label: 'generalización absoluta' },
  { re: /\b100\s*%\s+(seguro|de\s+acierto|efectivo)\b/i, label: 'afirmación de infalibilidad' },
];

/** Conductas de riesgo personal. */
const HARM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(pide|solicita|saca)\s+un\s+(préstamo|crédito)\b/i, label: 'inducción a endeudarse' },
  { re: /\bcon\s+(el\s+)?dinero\s+(del\s+)?(alquiler|arriendo|comida|renta)\b/i, label: 'uso de dinero de necesidades básicas' },
  { re: /\brecupera(r)?\s+(las\s+)?p[eé]rdidas\s+(operando|con\s+m[aá]s)\b/i, label: 'incentivo a recuperar pérdidas' },
  { re: /\b(dobla|aumenta|sube)\s+(el\s+)?(riesgo|tama[nñ]o)\s+(despu[eé]s\s+de|tras)\s+(perder|una\s+p[eé]rdida)\b/i, label: 'martingala' },
  { re: /\bsoy\s+(tu\s+)?(asesor|consultor)\s+financiero\b/i, label: 'suplantación de asesor autorizado' },
];

function scanText(text: string): GuardrailReport['violations'] {
  const violations: GuardrailReport['violations'] = [];
  const lower = text.toLowerCase();

  for (const claim of FORBIDDEN_CLAIMS) {
    if (lower.includes(claim)) {
      violations.push({ rule: 'expresion-prohibida', detail: `Contiene "${claim}".`, severity: 'BLOCK' });
    }
  }
  for (const p of [...IMPERATIVE_PATTERNS, ...CERTAINTY_PATTERNS, ...HARM_PATTERNS]) {
    const m = text.match(p.re);
    if (m) {
      violations.push({ rule: p.label, detail: `Fragmento detectado: "${m[0]}".`, severity: 'BLOCK' });
    }
  }
  return violations;
}

/** Recorre todos los campos de texto de un análisis. */
function collectText(a: AIEducationalAnalysis): string {
  return [
    a.contextSummary,
    a.observedTrend,
    ...a.bullishEvidence,
    ...a.bearishEvidence,
    ...a.relevantIndicators.flatMap((i) => [i.name, i.reading, i.interpretation]),
    ...a.risks,
    a.bullishScenario,
    a.bearishScenario,
    ...a.invalidationConditions,
    ...a.questionsForStudent,
    a.recommendedLesson?.reason ?? '',
    ...a.sourcesUsed,
    a.educationalDisclaimer,
  ].join('\n');
}

/**
 * Verifica que el modelo no haya inventado lecturas de indicadores.
 * Cada `reading` debe corresponderse con un valor presente en el contexto.
 */
function checkIndicatorFabrication(
  a: AIEducationalAnalysis,
  allowedValues: Record<string, number | null>,
): GuardrailReport['violations'] {
  const violations: GuardrailReport['violations'] = [];
  const allowedNumbers = new Set(
    Object.values(allowedValues)
      .filter((v): v is number => v != null)
      .flatMap((v) => [v.toFixed(2), v.toFixed(4), String(Number(v.toFixed(2))), String(Number(v.toFixed(4)))]),
  );
  if (allowedNumbers.size === 0) return violations;

  for (const ind of a.relevantIndicators) {
    const numbers = ind.reading.match(/-?\d+(?:[.,]\d+)?/g);
    if (!numbers) continue;
    for (const raw of numbers) {
      const normalized = raw.replace(',', '.');
      const n = Number(normalized);
      if (!Number.isFinite(n)) continue;
      const matches = Array.from(allowedNumbers).some((allowed) => {
        const av = Number(allowed);
        if (!Number.isFinite(av)) return false;
        const tol = Math.max(Math.abs(av) * 0.005, 0.0001);
        return Math.abs(av - n) <= tol;
      });
      if (!matches) {
        violations.push({
          rule: 'lectura-de-indicador-no-verificable',
          detail: `El indicador "${ind.name}" cita el valor ${raw}, que no coincide con ninguna lectura entregada en el contexto.`,
          severity: 'FLAG',
        });
      }
    }
  }
  return violations;
}

export function runGuardrails(
  analysis: AIEducationalAnalysis,
  options?: { allowedIndicatorValues?: Record<string, number | null> },
): GuardrailReport {
  const violations = scanText(collectText(analysis));

  if (options?.allowedIndicatorValues) {
    violations.push(...checkIndicatorFabrication(analysis, options.allowedIndicatorValues));
  }

  // Requisitos estructurales del criterio de aceptación #10.
  if (analysis.risks.length === 0) {
    violations.push({ rule: 'sin-riesgos', detail: 'El análisis no enumera ningún riesgo.', severity: 'BLOCK' });
  }
  if (analysis.invalidationConditions.length === 0) {
    violations.push({
      rule: 'sin-invalidacion',
      detail: 'El análisis no indica condiciones de invalidación.',
      severity: 'BLOCK',
    });
  }
  if (!analysis.uncertaintyLevel) {
    violations.push({ rule: 'sin-incertidumbre', detail: 'Falta el nivel de incertidumbre.', severity: 'BLOCK' });
  }
  if (analysis.bullishEvidence.length === 0 || analysis.bearishEvidence.length === 0) {
    violations.push({
      rule: 'analisis-unilateral',
      detail: 'El análisis debe presentar evidencias en ambos sentidos.',
      severity: 'BLOCK',
    });
  }

  return { passed: !violations.some((v) => v.severity === 'BLOCK'), violations };
}

/** Normaliza el aviso educativo: siempre presente y con el texto aprobado. */
export function enforceDisclaimer(analysis: AIEducationalAnalysis): AIEducationalAnalysis {
  const current = analysis.educationalDisclaimer?.trim() ?? '';
  return {
    ...analysis,
    educationalDisclaimer: current.length >= 20 ? current : DISCLAIMERS.ai,
  };
}

/**
 * Sanea la entrada del usuario antes de incluirla en el prompt.
 * Neutraliza intentos evidentes de inyección de instrucciones.
 */
export function sanitizeUserInput(text: string, maxLength = 1200): string {
  return text
    .slice(0, maxLength)
    .replace(/\bignora (todas )?(las )?(instrucciones|reglas)\b/gi, '[texto retirado]')
    .replace(/\bignore (all )?(previous )?(instructions|rules)\b/gi, '[texto retirado]')
    .replace(/\bsystem\s*:/gi, 'sistema -')
    .replace(/\bdeveloper\s*:/gi, 'desarrollador -')
    .replace(/<\/?(system|assistant|user)>/gi, '')
    .trim();
}
