import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LearningScene, MarketScene, PracticeScene } from '../src/components/pwa/welcome/WelcomeScenes';

// Logo depends on the app-only @tl/ui barrel; scene rendering does not need its providers.
vi.mock('../src/components/Logo', () => ({ Logo: () => null }));
// This repository's Vitest uses classic JSX; Next uses the automatic runtime.
beforeAll(() => vi.stubGlobal('React', React));
afterAll(() => vi.unstubAllGlobals());

describe('signed-out interactive introduction', () => {
  it('uses local, recognizable identities with no invented financial quotes', () => {
    const html = renderToStaticMarkup(createElement(MarketScene, { reduce: true }));
    expect(html).toContain('/assets/instruments/btc.svg');
    expect(html).toContain('/assets/instruments/apple.svg');
    expect(html).toContain('/assets/instruments/eth.svg');
    expect(html).toContain('Descubrir Euro / dólar');
    expect(html).not.toMatch(/(?:src|href)="https?:/);
    expect(html).not.toContain('rentabilidad');
  });

  it('labels the preview as hypothetical, virtual and not an order', () => {
    const html = renderToStaticMarkup(createElement(PracticeScene, { reduce: true }));
    expect(html).toContain('Prueba interactiva, no crea una operación');
    expect(html).toContain('USD virtuales');
    expect(html).toContain('Trayectoria hipotética');
    expect(html).toContain('SIN DINERO REAL');
    expect(html).toContain('data-demo-direction="neutral"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).not.toContain('<form');
  });

  it('shows learning and reflection without pretending that a guest has made progress', () => {
    const html = renderToStaticMarkup(createElement(LearningScene, { reduce: true }));
    expect(html).toContain('VISTA PREVIA');
    expect(html).toContain('Lo que observé');
    expect(html).toContain('Lo que aprendí');
    expect(html).not.toContain('completada');
    expect(html).not.toContain('guardado');
  });

  it.each([MarketScene, PracticeScene, LearningScene])('renders stable, static artwork when motion is reduced', Component => {
    const first = renderToStaticMarkup(createElement(Component, { reduce: true }));
    const second = renderToStaticMarkup(createElement(Component, { reduce: true }));
    expect(first).toBe(second);
    expect(first).not.toContain('opacity:0');
  });
});
