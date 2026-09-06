import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El sistema de diseño se documentó una vez y derivó: la hoja de estilo acabó
 * con 36 tamaños de fuente, 33 radios y 312 colores literales, mientras el
 * documento describía otra cosa. Un documento no frena esa deriva; un test sí.
 *
 * Estas pruebas fallan cuando alguien vuelve a escribir una longitud o un color
 * a ojo en lugar de usar la escala.
 */

const CSS_DIR = join(process.cwd(), 'src/app');
const files = readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'));
const read = (file: string) => readFileSync(join(CSS_DIR, file), 'utf8');

/** Las superficies de la app instalada. La web pública tiene identidad propia. */
const APP_SURFACES = [
  'native-app.css',
  'native-home.css',
  'native-gestures.css',
  'mobile-app.css',
  'simple-terminal.css',
  'live-chart.css',
  'app-refinement.css',
  'welcome-scenes.css',
];

/** Declaraciones de los propios tokens: son la fuente, no un uso. */
const TOKEN_DEFINITION = /^\s*--[\w-]+\s*:/;

function declarations(css: string, property: string): string[] {
  const found: string[] = [];
  const pattern = new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;{}]+)`, 'g');
  for (const line of css.split('\n')) {
    if (TOKEN_DEFINITION.test(line)) continue;
    for (const match of line.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

describe('escala tipográfica', () => {
  it('ningún font-size se escribe en px: siempre var(--text-*) o clamp fluido', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const value of declarations(read(file), 'font-size')) {
        if (/\dpx/.test(value) && !value.includes('clamp(')) {
          offenders.push(`${file}: font-size: ${value.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no hay tipografía por debajo del suelo de 11 px', () => {
    const scale = read('globals.css').match(/--text-2xs:\s*(\d+)px/);
    expect(scale?.[1]).toBe('11');
  });
});

describe('escala de radios', () => {
  it('ningún border-radius se escribe en px: siempre var(--radius-*) o %', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const value of declarations(read(file), 'border-radius')) {
        if (/\dpx/.test(value)) offenders.push(`${file}: border-radius: ${value.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('paleta', () => {
  it('las superficies de la app no contienen colores literales', () => {
    const offenders: string[] = [];
    for (const file of APP_SURFACES) {
      const css = read(file);
      for (const [index, line] of css.split('\n').entries()) {
        // #ffffff explícito sobre un acento es legítimo: el token de texto
        // cambia con el tema y aquí el fondo es siempre el azul de acción.
        const hexes = line.match(/#[0-9a-fA-F]{3,8}\b/g)?.filter((h) => h.toLowerCase() !== '#ffffff');
        if (hexes?.length) offenders.push(`${file}:${index + 1} → ${hexes.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('el tema oscuro es acromático: el fondo no tiene tinte de color', () => {
    const css = read('globals.css');
    const bg = css.match(/--color-bg:\s*#([0-9a-f]{6})/i)?.[1];
    expect(bg).toBeDefined();
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(bg!.slice(i, i + 2), 16));
    // Una rampa neutra mantiene los tres canales prácticamente iguales.
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4);
  });
});

describe('materiales', () => {
  it('el cristal esmerilado se reserva al cromo flotante, no a tarjetas estáticas', () => {
    // Cabeceras, navegación, drawers, scrims, ::backdrop y paletas de comandos.
    const CHROME = /nav|header|drawer|scrim|backdrop|sheet|sidebar|toolbar|bottom|panel|welcome|supports|prefers|market-art/i;
    const offenders: string[] = [];
    for (const file of files) {
      const lines = read(file).split('\n');
      lines.forEach((line, index) => {
        if (!line.includes('backdrop-filter')) return;
        const selector = lines.slice(0, index + 1).reverse().find((l) => l.includes('{'));
        if (!CHROME.test(selector ?? '')) offenders.push(`${file}:${index + 1} → ${selector?.trim().slice(0, 70)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
