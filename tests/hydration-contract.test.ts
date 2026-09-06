import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT } from '../src/packages/ui/theme-bootstrap';

describe('production document hydration contract', () => {
  it('serializes the head bootstrap from a shared module, never a client reference', () => {
    const root = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
    const bootstrap = readFileSync(new URL('../src/packages/ui/theme-bootstrap.ts', import.meta.url), 'utf8');
    expect(root).toContain("import { THEME_INIT_SCRIPT } from '@tl/ui/theme-bootstrap'");
    expect(root).not.toContain("from '@tl/ui/ThemeProvider'");
    expect(bootstrap).not.toMatch(/^['"]use client['"]/m);
    expect(typeof THEME_INIT_SCRIPT).toBe('string');
  });

  it('preserves the early stored theme and reduced-motion choice', () => {
    const attributes: Record<string, string> = {};
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: { getItem: (key: string) => key === 'tl-theme' ? 'light' : 'true' },
      window: { matchMedia: () => ({ matches: false }) },
      document: { documentElement: { setAttribute: (key: string, value: string) => { attributes[key] = value; } } },
    });
    expect(attributes).toEqual({ 'data-theme': 'light', 'data-theme-preference': 'light', 'data-reduce-motion': 'true' });
  });

  it('diagnostic recovery capture preserves the original error callback exactly once', async () => {
    const install = createRequire(import.meta.url)('../scripts/qa-hydration-recovery.cjs');
    let initializer: (() => void) | undefined;
    await install({ addInitScript: async (fn: () => void) => { initializer = fn; } });
    const logs: unknown[][] = [];
    const realm = { console: { error: (...args: unknown[]) => logs.push(args) }, location: { pathname: '/precios' } };
    runInNewContext(`(${initializer!.toString()})();`, realm);
    const hook = (realm as typeof realm & { __REACT_DEVTOOLS_GLOBAL_HOOK__: { onCommitFiberRoot(id: number, root: unknown): void } }).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const calls: unknown[][] = [];
    const root = { onRecoverableError(...args: unknown[]) { calls.push(args); return 'original-result'; } };
    hook.onCommitFiberRoot(1, root);
    hook.onCommitFiberRoot(1, root);
    const error = new Error('418');
    const info = { componentStack: 'a > body > html' };
    expect(root.onRecoverableError(error, info)).toBe('original-result');
    expect(calls).toEqual([[error, info]]);
    expect(logs).toHaveLength(1);
    expect(JSON.parse(String(logs[0][1])).componentStack).toBe(info.componentStack);
  });
});
