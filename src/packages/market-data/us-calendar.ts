// NYSE cash-session calendar: https://www.nyse.com/trade/hours-calendars
const ny = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function newYorkTime(at: number) {
  const p = Object.fromEntries(ny.formatToParts(at).map(p => [p.type, p.value]));
  const date = Date.UTC(+p.year, +p.month - 1, +p.day);
  return { date, year: +p.year, day: new Date(date).getUTCDay(), minute: +p.hour * 60 + +p.minute };
}
export function newYorkInstant(date: number, minute: number): number {
  const probe = date + 12 * 3600000;
  const offset = newYorkTime(probe).minute - 12 * 60;
  return date + (minute - offset) * 60000;
}
const day = 86400000;
const nth = (y: number, m: number, weekday: number, n: number) => {
  const first = Date.UTC(y, m, 1);
  return first + ((weekday - new Date(first).getUTCDay() + 7) % 7 + 7 * (n - 1)) * day;
};
const observed = (date: number) => date + (new Date(date).getUTCDay() === 6 ? -day : new Date(date).getUTCDay() === 0 ? day : 0);
function easter(y: number) {
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const v=h+l-7*m+114; return Date.UTC(y,Math.floor(v/31)-1,v%31+1);
}
const calendars = new Map<number, Set<number>>();
export function usEquityHoliday(date: number): boolean {
  const y = new Date(date).getUTCFullYear();
  if (!calendars.has(y)) {
    const memorial = Date.UTC(y, 5, 0);
    const holidays = new Set([observed(Date.UTC(y,0,1)), nth(y,0,1,3), nth(y,1,1,3), easter(y)-2*day,
      memorial-((new Date(memorial).getUTCDay()+6)%7)*day, observed(Date.UTC(y,6,4)), nth(y,8,1,1), nth(y,10,4,4), observed(Date.UTC(y,11,25))]);
    if (y >= 2022) holidays.add(observed(Date.UTC(y,5,19)));
    // NYSE does not observe Saturday New Year's Day on the preceding Dec 31.
    if (y === 2025) holidays.add(Date.UTC(2025,0,9)); // Carter national day of mourning.
    calendars.set(y, holidays);
  }
  return calendars.get(y)!.has(date);
}
export function usEquityCloseMinute(date: number): number {
  const d = new Date(date), y = d.getUTCFullYear();
  if (date === nth(y,10,4,4)+day || (d.getUTCMonth()===11 && d.getUTCDate()===24) || (d.getUTCMonth()===6 && d.getUTCDate()===3)) return 13*60;
  return 16*60;
}
