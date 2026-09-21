import { easter } from './us-calendar';
// Colombian holidays (Ley 51/1983); USD/COP local spot reference, not offshore NDF.
const cache = new Map<number, Set<number>>();
export function colombiaHoliday(at: number): boolean {
  const local = new Date(at - 5 * 3600000);
  const y = local.getUTCFullYear(), date = Date.UTC(y, local.getUTCMonth(), local.getUTCDate());
  if (!cache.has(y)) {
    const monday = (d: number) => d + (8 - new Date(d).getUTCDay()) % 7 * 86400000;
    const dates = new Set([Date.UTC(y,0,1),Date.UTC(y,4,1),Date.UTC(y,6,20),Date.UTC(y,7,7),Date.UTC(y,11,8),Date.UTC(y,11,25)]);
    for (const [m,d] of [[0,6],[2,19],[5,29],[7,15],[9,12],[10,1],[10,11]]) dates.add(monday(Date.UTC(y,m,d)));
    const e = easter(y);
    for (const days of [-3,-2]) dates.add(e+days*86400000);
    for (const days of [39,60,68]) dates.add(monday(e+days*86400000));
    cache.set(y,dates);
  }
  return cache.get(y)!.has(date);
}
