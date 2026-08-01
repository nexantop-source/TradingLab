import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { handleError } from '@/lib/api';

/**
 * Portabilidad de datos.
 *
 * Devuelve toda la información del usuario en JSON, incluida la traza de
 * auditoría de cada simulación. No incluye el hash de la contraseña ni los
 * identificadores internos de sesión.
 */
export async function GET() {
  try {
    const { user } = await requireAuth();

    const [profile, account, ledger, simulations, journal, progress, attempts, certificates, aiAnalyses, consents] =
      await Promise.all([
        db.profile.findUnique({ where: { userId: user.id } }),
        db.demoAccount.findFirst({ where: { userId: user.id } }),
        db.demoBalanceLedger.findMany({
          where: { demoAccount: { userId: user.id } },
          orderBy: { createdAt: 'asc' },
        }),
        db.simulation.findMany({ where: { userId: user.id }, orderBy: { openedAt: 'asc' } }),
        db.journalEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
        db.userProgress.findMany({ where: { userId: user.id }, include: { lesson: { select: { slug: true, title: true } } } }),
        db.quizAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
        db.certificate.findMany({ where: { userId: user.id } }),
        db.aIAnalysis.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }),
        db.consent.findMany({ where: { userId: user.id }, include: { document: { select: { slug: true, version: true } } } }),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      notice:
        'Exportación de datos de TradingLab. El saldo y los resultados están expresados en centavos de dólar virtual (VUSD) y no tienen valor económico.',
      cuenta: {
        nombre: user.name,
        correo: user.email,
        idioma: user.locale,
        zonaHoraria: user.timezone,
        plan: user.plan,
      },
      perfil: profile
        ? {
            nivelExperiencia: profile.experienceLevel,
            mercadosDeInteres: fromJson<string[]>(profile.marketInterests, []),
            objetivoEducativo: profile.educationalGoal,
            disponibilidadSemanal: profile.weeklyAvailability,
            puntuacionEvaluacionInicial: profile.riskKnowledgeScore,
          }
        : null,
      cuentaDemo: account ? { saldoCentavosVirtuales: account.balanceCents, divisa: account.currency } : null,
      libroMayor: ledger.map((l) => ({
        fecha: l.createdAt.toISOString(),
        importeCentavos: l.amountCents,
        saldoResultanteCentavos: l.balanceAfterCents,
        motivo: l.reason,
        referencia: l.reference,
        nota: l.memo,
      })),
      simulaciones: simulations.map((s) => ({
        id: s.id,
        modo: s.mode,
        instrumento: s.symbol,
        direccion: s.direction,
        estado: s.status,
        desenlace: s.outcome,
        precioEntrada: s.entryPrice,
        precioSalida: s.exitPrice,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        apalancamientoSimulado: s.leverage,
        montoVirtualCentavos: s.stakeCents,
        resultadoVirtualCentavos: s.pnlCents,
        abiertaEn: s.openedAt.toISOString(),
        cerradaEn: s.closedAt?.toISOString() ?? null,
        motivoEscrito: s.rationale,
        versionDelMotor: s.engineVersion,
        proveedorDePrecioEntrada: s.priceSourceProvider,
        marcaTemporalPrecioEntrada: s.priceSourceTimestamp.toISOString(),
        contextoCongelado: fromJson(s.contextSnapshot, null),
        trazaDeLiquidacion: fromJson<string[]>(s.settlementAudit, []),
      })),
      diario: journal.map((j) => ({
        fecha: j.createdAt.toISOString(),
        titulo: j.title,
        hipotesis: j.hypothesis,
        motivoEntrada: j.entryReason,
        emocionAntes: j.emotionBefore,
        emocionDespues: j.emotionAfter,
        nivelRiesgo: j.riskLevel,
        error: j.mistake,
        leccion: j.lesson,
        etiquetas: fromJson<string[]>(j.tags, []),
      })),
      progresoAcademico: progress.map((p) => ({
        leccion: p.lesson.title,
        slug: p.lesson.slug,
        estado: p.status,
        completadaEn: p.completedAt?.toISOString() ?? null,
      })),
      intentosDeCuestionario: attempts.map((a) => ({
        fecha: a.createdAt.toISOString(),
        puntuacion: a.score,
        superado: a.passed,
      })),
      certificados: certificates.map((c) => ({
        ruta: c.trackTitle,
        codigoVerificacion: c.verificationCode,
        emitidoEn: c.issuedAt.toISOString(),
      })),
      analisisIa: aiAnalyses.map((a) => ({
        fecha: a.createdAt.toISOString(),
        tipo: a.kind,
        instrumento: a.symbol,
        motor: a.engine,
        versionPrompt: a.promptVersionId,
        contenido: fromJson(a.payload, null),
      })),
      consentimientos: consents.map((c) => ({
        tipo: c.kind,
        concedido: c.granted,
        documento: c.document.slug,
        version: c.document.version,
        fecha: c.createdAt.toISOString(),
      })),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tradinglab-datos-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
