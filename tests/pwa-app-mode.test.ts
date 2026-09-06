import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { APP_MODE_INIT_SCRIPT } from '../src/components/pwa/appMode';
function launch(pathname: string, media: boolean, ios = false, search = '', hash = '') {
  const dataset: Record<string, string> = {};
  const replacements: string[] = [];
  runInNewContext(APP_MODE_INIT_SCRIPT, { matchMedia: () => ({ matches: media }), navigator: { standalone: ios }, document: { documentElement: { dataset } }, location: { pathname, search, hash, replace: (url: string) => replacements.push(url) } });
  return { dataset, replacements };
}
describe('installed presentation and launch repair', () => {
  it('keeps the normal mobile website unchanged', () => {
    expect(launch('/', false)).toEqual({ dataset: { appMode: 'browser' }, replacements: [] });
  });
  it('repairs legacy home-screen launches before painting marketing content', () => {
    expect(launch('/', true).replacements).toEqual(['/app']);
    expect(launch('/', false, true).replacements).toEqual(['/app']);
    expect(launch('/', true).dataset.appLaunch).toBe('true');
  });
  it('preserves launch queries without accepting an external destination', () => {
    expect(launch('/', true, false, '?next=https://external.invalid', '#start').replacements).toEqual(['/app?next=https://external.invalid#start']);
  });
  it.each(['/app', '/panel', '/entrar', '/crear-cuenta', '/onboarding', '/perfil', '/pago', '/precios', '/legal/terminos', '/terminal'])('never interrupts a deep link to %s', path => {
    expect(launch(path, true).replacements).toEqual([]);
    expect(launch(path, true).dataset.appMode).toBe('standalone');
  });
});
