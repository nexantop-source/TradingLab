/** Completed second boundaries only, with neither pre-entry nor future samples.
 * Bounded to the entry minute: later minutes use the normal OHLC history.
 */
export function entryMinuteSampleTimes(openedAt: number, observedAt: number): number[] {
  if (!Number.isFinite(openedAt) || !Number.isFinite(observedAt) || observedAt < openedAt) return [];
  const nextMinute = Math.floor(openedAt / 60_000) * 60_000 + 60_000;
  const first = Math.ceil(openedAt / 1000) * 1000;
  const last = Math.min(Math.floor(observedAt / 1000) * 1000, nextMinute - 1000);
  const samples: number[] = [];
  for (let time = first; time <= last; time += 1000) samples.push(time);
  return samples;
}
