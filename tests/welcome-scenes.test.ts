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

  it('llueven activos de todas las familias, y la marca cae con ellos', () => {
    const html = renderToStaticMarkup(createElement(MarketScene, { reduce: false }));
    // Cripto, acciones, fondos cotizados, divisas y materias primas: la escena
    // promete un mundo de mercados y tiene que enseñar uno, no solo monedas.
    for (const icon of ['btc.svg', 'apple.svg', 'spdr-sandp500-etf-tr.svg', 'flag-eu.svg', 'metal-gold.svg', 'vanguard.svg']) {
      expect(html).toContain(`/assets/instruments/${icon}`);
    }
    expect(html).toContain('rain-brand');
    expect(html).toContain('rain-floor');
    expect(html).not.toMatch(/(?:src|href)="https?:/);
  });

  it('la marca cae la última: primero el mercado, después la herramienta', () => {
    const html = renderToStaticMarkup(createElement(MarketScene, { reduce: false }));
    // Solo el montón: la lluvia de fondo tiene sus propios retardos largos y
    // no forma parte de la escena que se construye a la vista.
    const corte = html.indexOf('rain-brand');
    const pila = html.slice(html.indexOf('rain-piece'), corte);
    const retardos = [...pila.matchAll(/--rain-delay:([0-9.]+)s/g)].map(m => Number(m[1]));
    expect(retardos.length).toBeGreaterThan(10);
    const retardoMarca = Number(/--rain-delay:([0-9.]+)s/.exec(html.slice(corte))![1]);
    expect(retardoMarca).toBeGreaterThan(Math.max(...retardos));
  });

  it('deja tocar en la pila los mismos instrumentos que en las fichas', () => {
    const html = renderToStaticMarkup(createElement(MarketScene, { reduce: false }));
    // Cada instrumento aparece dos veces -en la lluvia y en su ficha- y las dos
    // seleccionan lo mismo; comportarse distinto sería desconcertante.
    expect(html.match(/aria-label="Descubrir Bitcoin"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Descubrir Euro \/ dólar"/g)).toHaveLength(2);
  });

  it('no anima ni deja piezas en el aire cuando se pide menos movimiento', () => {
    const html = renderToStaticMarkup(createElement(MarketScene, { reduce: true }));
    expect(html).toContain('data-reduce="true"');
    // Sin animación, una pieza con retardo o altura de caída quedaría flotando
    // sobre el montón para siempre.
    expect(html).not.toContain('--rain-delay');
    expect(html).not.toContain('--rain-drop');
    expect(html).not.toContain('rain-drizzle');
  });

  it.each([MarketScene, PracticeScene, LearningScene])('renders stable, static artwork when motion is reduced', Component => {
    const first = renderToStaticMarkup(createElement(Component, { reduce: true }));
    const second = renderToStaticMarkup(createElement(Component, { reduce: true }));
    expect(first).toBe(second);
    expect(first).not.toContain('opacity:0');
  });
});
