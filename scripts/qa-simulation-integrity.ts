/** Real service + ledger transactions in a newly created isolated SQLite DB.
 * node --conditions=react-server --import tsx scripts/qa-simulation-integrity.ts
 * No product accounts, real balances, payment keys or network calls are used.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import type { CreateSimulationInput, LedgerRow } from '../src/packages/simulation-engine';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'tradinglab-simulation-integrity-'));
  const filename = join(directory, 'isolated.db');
  new DatabaseSync(filename).close();
  Object.assign(process.env, { DATABASE_URL: `file:${filename.replaceAll('\\', '/')}`, DATABASE_PROVIDER: 'sqlite', MARKET_DATA_PROVIDER: 'synthetic', REQUIRE_REAL_MARKET_DATA: 'false', CHECKPOINT_DISABLE: '1' });
  globalThis.fetch = async () => { throw Error('NETWORK_BLOCKED_IN_SIMULATION_QA'); };
  const init = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'], { env: process.env, encoding: 'utf8' });
  assert.equal(init.status, 0, `Isolated schema creation failed: ${init.stderr}`);
  const { db } = await import('../src/lib/db');
  try {
    const { createSimulation, closeSimulationById, settleDueSimulations } = await import('../src/lib/simulation-service');
    const { ensureDemoAccount, post, postMany, resetBalance } = await import('../src/lib/demo-account');
    const { marketData } = await import('../src/packages/market-data');
    const { verifyLedger, SimulationError, LedgerError } = await import('../src/packages/simulation-engine');
    const provider = marketData();
    const fixedAt = Date.UTC(2026, 8, 5, 16, 0, 0);
    const quote = provider.getQuote.bind(provider);
    const candles = provider.getCandles.bind(provider);
    const priceAt = provider.getPriceAt.bind(provider);
    provider.getQuote = (symbol) => quote(symbol, fixedAt);
    provider.getCandles = (params) => candles({ ...params, to: fixedAt });
    let gate: (() => Promise<void>) | null = null;
    provider.getPriceAt = async (symbol, at) => {
      if (gate) await gate();
      return priceAt(symbol, at);
    };
    const armConcurrentClose = () => {
      let arrived = 0;
      let release!: () => void;
      const ready = new Promise<void>(resolveReady => { release = resolveReady; });
      gate = async () => { if (++arrived === 2) { gate = null; release(); } await ready; };
    };
    const fixture = async (label: string) => {
      const user = await db.user.create({ data: { email: `${label}@example.invalid`, name: 'Isolated simulation QA', passwordHash: 'NO_LOGIN' } });
      const account = await ensureDemoAccount(user.id);
      return { userId: user.id, accountId: account.id };
    };
    const input = (stakeCents: number, mode: 'POSITION' | 'HYPOTHESIS' = 'POSITION'): CreateSimulationInput => {
      const common = { symbol: 'BTCUSD', direction: 'BULLISH' as const, stakeCents, rationale: 'Hipótesis ficticia para verificar integridad local.', confidence: 'MEDIUM' as const, perceivedRisk: 3, timeframe: '1m' as const, visibleIndicators: [], chartType: 'line', acknowledgedSimulation: true as const };
      return mode === 'HYPOTHESIS' ? { ...common, mode, durationMinutes: 1 } : { ...common, mode, orderType: 'MARKET', leverage: 1, limitPrice: null, stopLoss: null, takeProfit: null, trailingStopDistance: null };
    };
    const open = (userId: string, stake: number, mode: 'POSITION' | 'HYPOTHESIS' = 'POSITION') => createSimulation({ userId, plan: 'PREMIUM', timezone: 'America/Bogota', input: input(stake, mode) });
    const checkLedger = async (accountId: string) => {
      const rows = await db.$queryRaw<LedgerRow[]>`SELECT amountCents, balanceAfterCents, reason, createdAt FROM DemoBalanceLedger WHERE demoAccountId = ${accountId} ORDER BY rowid`;
      const result = verifyLedger(rows);
      assert(result.ok, 'Each ledger running balance must be consistent in insertion order');
      assert.equal(result.computedBalanceCents, (await db.demoAccount.findUniqueOrThrow({ where: { id: accountId } })).balanceCents);
    };
    const oneWinner = (results: PromiseSettledResult<unknown>[]) => {
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
      assert(rejected.reason instanceof SimulationError || rejected.reason instanceof LedgerError, 'Race returns a controlled domain error');
    };
    const checks: string[] = [];

    const low = await fixture('low-balance');
    await post({ demoAccountId: low.accountId, amountCents: -999_900, reason: 'ADMIN_ADJUSTMENT', memo: 'Isolated fixture only' });
    const initialLedger = await db.demoBalanceLedger.count({ where: { demoAccountId: low.accountId } });
    await assert.rejects(open(low.userId, 10_000), error => error instanceof LedgerError && error.code === 'INSUFFICIENT_VIRTUAL_BALANCE');
    assert.equal(await db.simulation.count({ where: { userId: low.userId } }), 0, 'Insufficient balance must leave no orphan OPEN row');
    assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: low.accountId } }), initialLedger);
    await assert.rejects(postMany(low.accountId, [{ amountCents: -90, reason: 'ADMIN_ADJUSTMENT' }, { amountCents: -90, reason: 'ADMIN_ADJUSTMENT' }]));
    await assert.rejects(post({ demoAccountId: low.accountId, amountCents: 0.5, reason: 'ADMIN_ADJUSTMENT' }));
    await checkLedger(low.accountId); checks.push('low_balance_open_rollback_no_orphan', 'multi_post_rollback_and_integer_cents');

    const parallel = await fixture('parallel-opens');
    const opened = await Promise.allSettled([open(parallel.userId, 600_000), open(parallel.userId, 600_000)]);
    oneWinner(opened);
    assert.equal(await db.simulation.count({ where: { userId: parallel.userId, status: 'OPEN' } }), 1);
    assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: parallel.accountId, reason: 'SIMULATION_MARGIN_HOLD' } }), 1);
    assert((await db.demoAccount.findUniqueOrThrow({ where: { id: parallel.accountId } })).balanceCents >= 0);
    await checkLedger(parallel.accountId); checks.push('parallel_opens_no_overspend');

    for (const mode of ['POSITION', 'HYPOTHESIS'] as const) {
      const row = await fixture(`double-close-${mode.toLowerCase()}`);
      const created = await open(row.userId, 20_000, mode);
      const closeParams = { userId: row.userId, simulationId: created.simulationId, at: fixedAt + 60_000 };
      armConcurrentClose();
      const closed = await Promise.allSettled([closeSimulationById(closeParams), closeSimulationById(closeParams)]);
      oneWinner(closed);
      assert.equal((await db.simulation.findUniqueOrThrow({ where: { id: created.simulationId } })).status, 'CLOSED');
      assert.equal(await db.demoBalanceLedger.count({ where: { reference: created.simulationId, reason: 'SIMULATION_SETTLEMENT' } }), 1);
      const settledBalance = (await db.demoAccount.findUniqueOrThrow({ where: { id: row.accountId } })).balanceCents;
      await assert.rejects(closeSimulationById(closeParams));
      assert.equal((await db.demoAccount.findUniqueOrThrow({ where: { id: row.accountId } })).balanceCents, settledBalance);
      await checkLedger(row.accountId); checks.push(`${mode.toLowerCase()}_concurrent_and_repeated_close_exactly_once`);
    }

    const partial = await fixture('partial-close');
    const created = await open(partial.userId, 20_000);
    armConcurrentClose();
    const partials = await Promise.allSettled([closeSimulationById({ userId: partial.userId, simulationId: created.simulationId, fraction: 0.5, at: fixedAt + 60_000 }), closeSimulationById({ userId: partial.userId, simulationId: created.simulationId, fraction: 0.5, at: fixedAt + 60_000 })]);
    oneWinner(partials);
    const remainder = await db.simulation.findUniqueOrThrow({ where: { id: created.simulationId } });
    assert.equal(remainder.status, 'OPEN'); assert.equal(remainder.stakeCents, 10_000); assert.equal(remainder.quantity, created.quantity * 0.5);
    assert(remainder.settlementAudit?.includes('fraccion=0.5'));
    await closeSimulationById({ userId: partial.userId, simulationId: created.simulationId, at: fixedAt + 120_000 });
    assert.equal(await db.demoBalanceLedger.count({ where: { reference: created.simulationId, reason: 'SIMULATION_SETTLEMENT' } }), 2);
    await checkLedger(partial.accountId); checks.push('concurrent_partial_claim_and_remaining_close');

    const rollback = await fixture('settlement-rollback');
    const rollbackSim = await open(rollback.userId, 20_000);
    const balance = (await db.demoAccount.findUniqueOrThrow({ where: { id: rollback.accountId } })).balanceCents;
    await post({ demoAccountId: rollback.accountId, amountCents: 2_147_483_647 - balance, reason: 'ADMIN_ADJUSTMENT', memo: 'Isolated overflow fixture' });
    await assert.rejects(closeSimulationById({ userId: rollback.userId, simulationId: rollbackSim.simulationId, at: fixedAt }), error => error instanceof LedgerError);
    assert.equal((await db.simulation.findUniqueOrThrow({ where: { id: rollbackSim.simulationId } })).status, 'OPEN');
    assert.equal(await db.demoBalanceLedger.count({ where: { reference: rollbackSim.simulationId, reason: 'SIMULATION_SETTLEMENT' } }), 0);
    await checkLedger(rollback.accountId); checks.push('failed_ledger_rolls_back_close_claim');

    const reset = await fixture('reset-claim');
    await post({ demoAccountId: reset.accountId, amountCents: -100_000, reason: 'ADMIN_ADJUSTMENT' });
    const resets = await Promise.allSettled([resetBalance(reset.userId, 'FREE'), resetBalance(reset.userId, 'FREE')]);
    oneWinner(resets);
    assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: reset.accountId, reason: 'BALANCE_RESET' } }), 1);
    await checkLedger(reset.accountId); checks.push('reset_no_lost_update_or_duplicate_counter');

    const freshUser = await db.user.create({ data: { email: 'first-account-race@example.invalid', name: 'Isolated first account', passwordHash: 'NO_LOGIN' } });
    const accounts = await Promise.allSettled([ensureDemoAccount(freshUser.id), ensureDemoAccount(freshUser.id)]);
    assert(accounts.some(result => result.status === 'fulfilled'));
    assert.equal(await db.demoAccount.count({ where: { userId: freshUser.id } }), 1);
    const onlyAccount = await db.demoAccount.findFirstOrThrow({ where: { userId: freshUser.id } });
    assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: onlyAccount.id, reason: 'ACCOUNT_OPENING' } }), 1);
    await checkLedger(onlyAccount.id); checks.push('concurrent_first_account_single_opening_balance');

    const quota = await fixture('parallel-daily-quota');
    await db.simulation.createMany({ data: Array.from({ length: 4 }, () => ({
      userId: quota.userId, demoAccountId: quota.accountId, mode: 'POSITION', symbol: 'BTCUSD', assetClass: 'CRYPTO',
      status: 'CLOSED', outcome: 'NEUTRAL', stakeCents: 100, quantity: 0, entryPrice: 100,
      rationale: 'Historical isolated quota fixture, no money movement.', engineVersion: '1.0.0',
      priceSourceProvider: 'synthetic-v1', priceSourceTimestamp: new Date(fixedAt), contextSnapshot: '{}',
    })) });
    const quotaCandles = provider.getCandles;
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const bothPastInitialCheck = new Promise<void>(resolveReady => { releaseFirst = resolveReady; });
    const firstFinished = new Promise<void>(resolveReady => { releaseSecond = resolveReady; });
    provider.getCandles = async params => {
      if (params.timeframe === '1m') await bothPastInitialCheck;
      else { releaseFirst(); await firstFinished; }
      return quotaCandles(params);
    };
    try {
      // Both requests pass the initial count of 4. Commit the first before
      // releasing the second: a CAS balance check alone cannot protect quota.
      const first = createSimulation({ userId: quota.userId, plan: 'FREE', timezone: 'UTC', input: input(10_000) });
      void first.then(releaseSecond, releaseSecond);
      const second = createSimulation({ userId: quota.userId, plan: 'FREE', timezone: 'UTC', input: { ...input(10_000), timeframe: '5m' } });
      const attempts = await Promise.allSettled([first, second]);
      oneWinner(attempts);
      const rejected = attempts.find(result => result.status === 'rejected') as PromiseRejectedResult;
      assert(rejected.reason instanceof SimulationError && rejected.reason.code === 'LIMIT_REACHED');
      assert.equal(await db.simulation.count({ where: { userId: quota.userId } }), 5);
      assert.equal(await db.simulation.count({ where: { userId: quota.userId, status: 'OPEN' } }), 1);
      assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: quota.accountId, reason: 'SIMULATION_MARGIN_HOLD' } }), 1);
      assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: quota.accountId, reason: 'SIMULATION_FEE' } }), 1);
      await checkLedger(quota.accountId);
      checks.push('parallel_last_daily_allowance_one_open_no_extra_debit');
    } finally { provider.getCandles = quotaCandles; }

    // A controlled local provider gives an entry-minute excursion followed by
    // recovery. The live close quote differs from the protective trigger level.
    const originalNow = Date.now;
    const baselineQuote = await quote('BTCUSD', fixedAt);
    const entryMinute = fixedAt;
    const openedAt = entryMinute + 10_450;
    const observedAt = entryMinute + 25_900;
    try {
      Date.now = () => observedAt;
      for (const protection of ['STOP_LOSS', 'TAKE_PROFIT'] as const) {
        const manualUser = await fixture(`entry-manual-${protection.toLowerCase()}`);
        const automaticUser = await fixture(`entry-auto-${protection.toLowerCase()}`);
        const manual = await open(manualUser.userId, 20_000);
        const automatic = await open(automaticUser.userId, 20_000);
        const sign = protection === 'STOP_LOSS' ? -1 : 1;
        const level = manual.entryPrice + sign * 100;
        const levels = protection === 'STOP_LOSS' ? { stopLoss: level, takeProfit: null } : { takeProfit: level, stopLoss: null };
        await db.simulation.updateMany({ where: { id: { in: [manual.simulationId, automatic.simulationId] } }, data: { ...levels, openedAt: new Date(openedAt) } });
        const sampledAt: number[] = [];
        provider.getCandles = async params => ({
          symbol: params.symbol, timeframe: params.timeframe,
          // Whole entry candle is intentionally polluted by pre-entry extrema.
          candles: [{ t: entryMinute, o: manual.entryPrice, h: manual.entryPrice + 500, l: manual.entryPrice - 500, c: manual.entryPrice, v: 0 }],
          provenance: { ...baselineQuote.provenance, sourceTimestamp: entryMinute, receivedTimestamp: params.to ?? observedAt },
        });
        provider.getPriceAt = async (_symbol, timestamp) => {
          sampledAt.push(timestamp);
          const second = Math.floor((timestamp - entryMinute) / 1000);
          const crossed = second >= 17 && second <= 19;
          return { price: manual.entryPrice + (crossed ? sign * 120 : 0), provenance: { ...baselineQuote.provenance, sourceTimestamp: timestamp, receivedTimestamp: timestamp } };
        };
        // Even a partial/manual request must honor an already observed trigger.
        const manualClose = await closeSimulationById({ userId: manualUser.userId, simulationId: manual.simulationId, fraction: 0.5, reason: 'PARTIAL', at: observedAt });
        assert.equal(await settleDueSimulations(automaticUser.userId), 1, 'Entry-minute trigger must be detected without waiting for the next minute');
        const autoRow = await db.simulation.findUniqueOrThrow({ where: { id: automatic.simulationId } });
        const manualRow = await db.simulation.findUniqueOrThrow({ where: { id: manual.simulationId } });
        assert.equal(manualClose.closeReason, protection); assert.equal(autoRow.closeReason, protection);
        assert.equal(manualRow.status, 'CLOSED'); assert.equal(manualRow.stakeCents, 20_000);
        assert.equal(autoRow.exitPrice, manualClose.exitPrice, 'Manual and automatic use the same trigger level, not the recovered live quote');
        assert.equal(autoRow.pnlCents, manualClose.pnlCents);
        assert.notEqual(autoRow.exitPrice, manual.entryPrice);
        assert.equal(autoRow.closedAt?.getTime(), observedAt);
        assert.equal(manualRow.closedAt?.getTime(), observedAt);
        assert.equal(autoRow.settlementAudit, manualRow.settlementAudit);
        assert(autoRow.settlementAudit?.includes(`disparoNivelMedio=${level}`));
        assert(autoRow.settlementAudit?.includes('minutoEntrada_segundosCompletos'));
        assert(sampledAt.every(time => time >= openedAt && time <= observedAt), 'Never inspect pre-entry or future prices');
        assert(sampledAt.filter(time => time !== observedAt).every(time => time % 1000 === 0 && time <= Math.floor(observedAt / 1000) * 1000), 'Entry fragment samples only completed aligned seconds');
        await checkLedger(manualUser.accountId); await checkLedger(automaticUser.accountId);
        checks.push(`${protection.toLowerCase()}_entry_minute_manual_auto_price_audit_consistency`);
      }

      // No post-entry crossing: pre-entry high/low must never liquidate a position.
      const safe = await fixture('pre-entry-extreme');
      const safeSim = await open(safe.userId, 20_000);
      await db.simulation.update({ where: { id: safeSim.simulationId }, data: { openedAt: new Date(openedAt), stopLoss: safeSim.entryPrice - 100, takeProfit: safeSim.entryPrice + 100 } });
      provider.getPriceAt = async (_symbol, timestamp) => ({ price: safeSim.entryPrice, provenance: { ...baselineQuote.provenance, sourceTimestamp: timestamp, receivedTimestamp: timestamp } });
      assert.equal(await settleDueSimulations(safe.userId), 0);
      assert.equal((await db.simulation.findUniqueOrThrow({ where: { id: safeSim.simulationId } })).status, 'OPEN');
      assert.equal(await db.demoBalanceLedger.count({ where: { reference: safeSim.simulationId, reason: 'SIMULATION_SETTLEMENT' } }), 0);
      checks.push('pre_entry_extremes_cannot_trigger_protection');

      const originalStatus = provider.getMarketStatus.bind(provider);
      const legacy = await fixture('legacy-pre-open');
      const legacySim = await open(legacy.userId, 20_000);
      await db.simulation.update({ where: { id: legacySim.simulationId }, data: { openedAt: new Date(openedAt), stopLoss: legacySim.entryPrice - 100, takeProfit: legacySim.entryPrice + 100 } });
      try {
        provider.getMarketStatus = () => 'PRE_OPEN';
        const blocked = await fixture('new-pre-open-blocked');
        await assert.rejects(open(blocked.userId, 20_000), error => error instanceof SimulationError && error.code === 'MARKET_CLOSED');
        assert.equal(await db.simulation.count({ where: { userId: blocked.userId } }), 0);
        checks.push('server_rejects_pre_open_before_position_or_debit');

        provider.getPriceAt = async (_symbol, timestamp) => ({ price: legacySim.entryPrice, provenance: {
          ...baselineQuote.provenance, sourceTimestamp: entryMinute - 86_400_000, receivedTimestamp: timestamp,
          marketStatus: 'PRE_OPEN', freshness: 'MARKET_CLOSED',
        } });
        const legacyClose = await closeSimulationById({ userId: legacy.userId, simulationId: legacySim.simulationId, reason: 'MANUAL', at: observedAt });
        assert.equal(legacyClose.closeReason, 'MANUAL', 'Frozen pre-entry close is not a protective trigger');
        assert.equal((await db.simulation.findUniqueOrThrow({ where: { id: legacySim.simulationId } })).status, 'CLOSED');
        await checkLedger(legacy.accountId);
        checks.push('legacy_pre_open_frozen_fragment_can_close_manually');

        provider.getMarketStatus = originalStatus;
        for (const invalid of ['future', 'nan', 'negative', 'stale_open'] as const) {
          provider.getPriceAt = async (_symbol, timestamp) => ({ price: safeSim.entryPrice, provenance: {
            ...baselineQuote.provenance,
            sourceTimestamp: invalid === 'future' ? timestamp + 1000 : invalid === 'nan' ? NaN : invalid === 'negative' ? -1 : openedAt - 1000,
            receivedTimestamp: timestamp, marketStatus: 'OPEN', freshness: 'SIMULATED',
          } });
          await assert.rejects(closeSimulationById({ userId: safe.userId, simulationId: safeSim.simulationId, reason: 'MANUAL', at: observedAt }), error => error instanceof SimulationError && error.code === 'INVALID_INPUT');
          assert.equal((await db.simulation.findUniqueOrThrow({ where: { id: safeSim.simulationId } })).status, 'OPEN');
          assert.equal(await db.demoBalanceLedger.count({ where: { reference: safeSim.simulationId, reason: 'SIMULATION_SETTLEMENT' } }), 0);
        }
        checks.push('future_invalid_and_stale_open_observations_still_rejected');
      } finally { provider.getMarketStatus = originalStatus; }
    } finally { Date.now = originalNow; }

    provider.getQuote = symbol => quote(symbol, fixedAt);
    provider.getCandles = params => candles({ ...params, to: fixedAt });
    provider.getPriceAt = priceAt;
    const strict = await fixture('real-source-required');
    const strictLedger = await db.demoBalanceLedger.count({ where: { demoAccountId: strict.accountId } });
    process.env.REQUIRE_REAL_MARKET_DATA = 'true';
    try {
      await assert.rejects(open(strict.userId, 10000), error => error instanceof SimulationError && error.code === 'INVALID_INPUT');
      const sourceQuote = await quote('BTCUSD', fixedAt);
      for (const age of [11000, -5000]) {
        provider.getQuote = async () => ({ ...sourceQuote, provenance: { ...sourceQuote.provenance, synthetic: false, freshness: 'REALTIME', sourceTimestamp: Date.now() - age } });
        await assert.rejects(open(strict.userId, 10000), error => error instanceof SimulationError && error.code === 'INVALID_INPUT');
      }
      assert.equal(await db.simulation.count({ where: { userId: strict.userId } }), 0);
      assert.equal(await db.demoBalanceLedger.count({ where: { demoAccountId: strict.accountId } }), strictLedger);
      checks.push('real_only_rejects_synthetic_stale_future_before_debit');
    } finally { delete process.env.REQUIRE_REAL_MARKET_DATA; provider.getQuote = symbol => quote(symbol, fixedAt); }

    const timed = await fixture('timed-position');
    const timedInput = { ...input(10000), durationMinutes: 1 } as CreateSimulationInput;
    const timedOpen = await createSimulation({ userId: timed.userId, plan: 'PREMIUM', timezone: 'UTC', input: timedInput });
    assert(timedOpen.expiresAt);
    const expiration = Date.now() - 60000;
    await db.simulation.update({ where: { id: timedOpen.simulationId }, data: { openedAt: new Date(expiration - 60000), expiresAt: new Date(expiration) } });
    const observations: number[] = [];
    provider.getPriceAt = async (symbol, at) => { observations.push(at); return priceAt(symbol, at); };
    const timedClose = await closeSimulationById({ userId: timed.userId, simulationId: timedOpen.simulationId, fraction: 0.5 });
    assert.equal(timedClose.closeReason, 'EXPIRY');
    assert.deepEqual(observations, [expiration]);
    const timedRow = await db.simulation.findUniqueOrThrow({ where: { id: timedOpen.simulationId } });
    assert.equal(timedRow.closedAt!.getTime(), expiration);
    assert.equal(timedRow.status, 'CLOSED');
    assert.equal(timedRow.stakeCents, 10000);
    await checkLedger(timed.accountId);
    checks.push('expired_position_forces_full_close_at_original_deadline');
    const auto = await fixture('timed-auto');
    const autoOpen = await createSimulation({ userId: auto.userId, plan: 'PREMIUM', timezone: 'UTC', input: timedInput });
    await db.simulation.update({ where: { id: autoOpen.simulationId }, data: { openedAt: new Date(expiration - 60000), expiresAt: new Date(expiration) } });
    assert.equal(await settleDueSimulations(auto.userId), 1);
    assert.equal(await settleDueSimulations(auto.userId), 0);
    await checkLedger(auto.accountId);
    checks.push('timed_position_opportunistic_settlement_exactly_once');

    console.log(JSON.stringify({ passed: true, checks, database: 'isolated SQLite', externalRequests: 0, realMoneyMoved: 0, isolatedDirectory: directory }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error('Simulation integrity QA failed:', error); process.exitCode = 1; });
