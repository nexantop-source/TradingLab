#!/usr/bin/env node

/**
 * TradingLab 13A — generador reproducible del sistema de marca.
 *
 * Uso:
 *   node scripts/build-tradinglab-brand-system.mjs [simbolo.svg]
 *   node scripts/build-tradinglab-brand-system.mjs --input simbolo.svg --output carpeta
 *
 * El SVG de entrada debe contener geometria vectorial (dos planos es lo ideal).
 * Los lockups convierten "TradingLab" a contornos con Poppins SemiBold mediante
 * fontTools, disponible en el entorno de produccion de los artes maestros.
 */

import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const finalRoot = path.join(
  projectRoot,
  'identidad visual',
  'logo-master-13A-final-2026-08-29',
);

const COLORS = Object.freeze({
  ink: '#071324',
  blue: '#185ADB',
  paper: '#F7F9FC',
  black: '#000000',
});

const DEFAULT_INPUT = path.join(finalRoot, 'tradinglab-symbol-master.svg');
const DEFAULT_OUTPUT = path.join(finalRoot, 'brand-system');
const DEFAULT_FONT = 'C:\\Windows\\Fonts\\Poppins-SemiBold.ttf';
const ICON_SIZES = [2048, 1024, 512, 256, 128, 64, 48, 32, 24, 16];
const AVATAR_SIZES = [1024, 512, 256, 128, 64, 32];

function parseArguments(argv) {
  const options = {input: null, output: null, font: null};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--input' || token === '-i') {
      options.input = argv[++index];
    } else if (token === '--output' || token === '-o') {
      options.output = argv[++index];
    } else if (token === '--font') {
      options.font = argv[++index];
    } else if (token === '--help' || token === '-h') {
      console.log('Uso: node scripts/build-tradinglab-brand-system.mjs [simbolo.svg] [--output carpeta] [--font Poppins-SemiBold.ttf]');
      process.exit(0);
    } else if (token.startsWith('-')) {
      throw new Error(`Argumento desconocido: ${token}`);
    } else {
      positional.push(token);
    }
  }

  return {
    input: path.resolve(options.input ?? positional[0] ?? DEFAULT_INPUT),
    output: path.resolve(options.output ?? DEFAULT_OUTPUT),
    font: path.resolve(options.font ?? DEFAULT_FONT),
  };
}

function number(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error(`Numero SVG no valido: ${value}`);
  return parsed;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cleanNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function measurePathData(pathData) {
  const arity = {M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0};
  const tokens = pathData.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  let command = null;
  let parameterCount = 0;
  let endpointGroups = 0;
  let curveSegments = 0;

  const flush = () => {
    if (!command || arity[command.toUpperCase()] === 0) {
      parameterCount = 0;
      return;
    }
    const groups = Math.floor(parameterCount / arity[command.toUpperCase()]);
    endpointGroups += groups;
    if (/[CSQTA]/.test(command.toUpperCase())) curveSegments += groups;
    parameterCount = 0;
  };

  for (const token of tokens) {
    if (/^[A-Za-z]$/.test(token)) {
      flush();
      command = token;
    } else {
      parameterCount += 1;
    }
  }
  flush();

  // Illustrator cierra estos trazados repitiendo el primer punto antes de Z.
  // Descontarlo produce el numero de anclas editables que muestra Illustrator.
  const closesPath = /[zZ]\s*$/.test(pathData);
  return {
    estimatedAnchors: Math.max(0, endpointGroups - (closesPath ? 1 : 0)),
    curveSegments,
  };
}

function parseSvg(source) {
  if (/<(?:image|script|foreignObject|text)\b/i.test(source)) {
    throw new Error('El maestro debe ser SVG vectorial puro: no se admiten image, script, foreignObject ni text.');
  }
  if (/\b(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(source)) {
    throw new Error('El maestro no puede depender de recursos externos.');
  }

  const svgMatch = source.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!svgMatch) throw new Error('No se encontro un elemento <svg> valido.');

  const viewBoxMatch = svgMatch[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (!viewBoxMatch) throw new Error('El SVG maestro necesita viewBox.');
  const viewBox = viewBoxMatch[1].trim().split(/[\s,]+/).map(number);
  if (viewBox.length !== 4 || viewBox[2] <= 0 || viewBox[3] <= 0) {
    throw new Error(`viewBox no valido: ${viewBoxMatch[1]}`);
  }

  let markup = svgMatch[2]
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(?:title|desc|metadata)\b[\s\S]*?<\/(?:title|desc|metadata)>/gi, '')
    .trim();

  const shapePattern = /<(path|polygon|polyline|rect|circle|ellipse)\b/gi;
  const shapes = [...markup.matchAll(shapePattern)];
  if (shapes.length < 2) {
    throw new Error(`Se esperaban al menos dos formas vectoriales; se encontraron ${shapes.length}.`);
  }

  const pathTags = [...markup.matchAll(/<path\b[^>]*>/gi)].map((match) => match[0]);
  const pathMetrics = pathTags.map((tag) => {
    const data = tag.match(/\bd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? '';
    return measurePathData(data);
  });

  return {
    markup,
    viewBox,
    shapeCount: shapes.length,
    pathCount: pathTags.length,
    anchorCount: pathMetrics.reduce((sum, metrics) => sum + metrics.estimatedAnchors, 0),
    curveCount: pathMetrics.reduce((sum, metrics) => sum + metrics.curveSegments, 0),
  };
}

function setAttribute(tag, name, value) {
  const attribute = new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, 'i');
  const styleFill = /style\s*=\s*(["'])(.*?)\1/i;

  if (name === 'fill' && styleFill.test(tag)) {
    tag = tag.replace(styleFill, (full, quote, styles) => {
      const next = /(^|;)\s*fill\s*:/i.test(styles)
        ? styles.replace(/(^|;)\s*fill\s*:[^;]*/i, `$1fill:${value}`)
        : `${styles.replace(/;?\s*$/, ';')}fill:${value};`;
      return `style=${quote}${next}${quote}`;
    });
  }

  if (attribute.test(tag)) return tag.replace(attribute, ` ${name}="${value}"`);
  return tag.replace(/\s*\/?\s*>$/, (ending) => ` ${name}="${value}"${ending}`);
}

function colorizeMarkup(markup, mode) {
  const hasExplicitBlue = /(?:fill\s*=\s*["']|fill\s*:)[^;"']*#?185adb/i.test(markup);
  let shapeIndex = 0;

  return markup.replace(
    /<(path|polygon|polyline|rect|circle|ellipse)\b[^>]*>/gi,
    (tag) => {
      const idClass = `${tag.match(/\bid\s*=\s*["']([^"']*)["']/i)?.[1] ?? ''} ${tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? ''}`;
      const fillToken = tag.match(/\bfill\s*=\s*["']([^"']*)["']/i)?.[1]
        ?? tag.match(/(?:^|;)\s*fill\s*:\s*([^;"']+)/i)?.[1]
        ?? '';
      const lowerByName = /lower|plane[-_ ]?2|blue|azul/i.test(idClass);
      const lowerByColor = /185adb/i.test(fillToken);
      const isLower = lowerByName || lowerByColor || (!hasExplicitBlue && shapeIndex > 0);
      shapeIndex += 1;

      let fill = COLORS.ink;
      if (mode === 'duotone') fill = isLower ? COLORS.blue : COLORS.ink;
      if (mode === 'avatar') fill = isLower ? COLORS.blue : COLORS.paper;
      if (mode === 'black') fill = COLORS.black;
      if (mode === 'inverse') fill = COLORS.paper;
      return setAttribute(tag, 'fill', fill);
    },
  );
}

function svgDocument({title, viewBox, body, width, height, description}) {
  const [x, y, w, h] = viewBox;
  const dimensions = width && height ? ` width="${width}" height="${height}"` : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg"${dimensions} viewBox="${cleanNumber(x)} ${cleanNumber(y)} ${cleanNumber(w)} ${cleanNumber(h)}" role="img" aria-labelledby="title desc">`,
    `  <title id="title">${escapeXml(title)}</title>`,
    `  <desc id="desc">${escapeXml(description)}</desc>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

function fitTransform(sourceViewBox, target) {
  const [sourceX, sourceY, sourceW, sourceH] = sourceViewBox;
  const scale = Math.min(target.width / sourceW, target.height / sourceH);
  const tx = target.x + (target.width - sourceW * scale) / 2 - sourceX * scale;
  const ty = target.y + (target.height - sourceH * scale) / 2 - sourceY * scale;
  return `translate(${cleanNumber(tx)} ${cleanNumber(ty)}) scale(${cleanNumber(scale)})`;
}

function placedSymbol(markup, sourceViewBox, target, label = 'Simbolo TradingLab 13A') {
  return `<g aria-label="${escapeXml(label)}" transform="${fitTransform(sourceViewBox, target)}">\n${markup}\n</g>`;
}

function buildSymbolSvg(parsed, mode) {
  const labels = {
    master: 'Simbolo TradingLab 13A monocromatico',
    duotone: 'Simbolo TradingLab 13A duotono',
    black: 'Simbolo TradingLab 13A negro',
    inverse: 'Simbolo TradingLab 13A inverso',
  };
  const body = placedSymbol(
    colorizeMarkup(parsed.markup, mode),
    parsed.viewBox,
    {x: 0, y: 0, width: 1000, height: 1000},
  );
  return svgDocument({
    title: labels[mode],
    description: 'Version vectorial oficial del concepto 13A. Geometria editable, sin imagenes incrustadas.',
    viewBox: [0, 0, 1000, 1000],
    width: 1000,
    height: 1000,
    body,
  });
}

const FONTTOOLS_SCRIPT = String.raw`
import json
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

font_path, content = sys.argv[1], sys.argv[2]
font = TTFont(font_path)
glyph_set = font.getGlyphSet()
cmap = font.getBestCmap()
metrics = font['hmtx'].metrics
path_pen = SVGPathPen(glyph_set)
bounds_pen = BoundsPen(glyph_set)
cursor = 0
tracking = -8
glyph_names = []

for index, character in enumerate(content):
    glyph_name = cmap.get(ord(character))
    if glyph_name is None:
        raise ValueError(f'No existe el glifo U+{ord(character):04X}')
    glyph_names.append(glyph_name)
    transform = (1, 0, 0, 1, cursor, 0)
    glyph_set[glyph_name].draw(TransformPen(path_pen, transform))
    glyph_set[glyph_name].draw(TransformPen(bounds_pen, transform))
    cursor += metrics[glyph_name][0]
    if index < len(content) - 1:
        cursor += tracking

head = font['head']
hhea = font['hhea']
result = {
    'path': path_pen.getCommands(),
    'bounds': list(bounds_pen.bounds),
    'advanceWidth': cursor,
    'unitsPerEm': head.unitsPerEm,
    'ascent': hhea.ascent,
    'descent': hhea.descent,
    'glyphs': glyph_names,
    'fontFamily': 'Poppins',
    'fontStyle': 'SemiBold',
}
print(json.dumps(result, ensure_ascii=False))
`;

function extractWordmark(fontPath) {
  const commands = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let lastError;
  for (const command of commands) {
    try {
      const output = execFileSync(command, ['-c', FONTTOOLS_SCRIPT, fontPath, 'TradingLab'], {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      });
      const result = JSON.parse(output);
      if (!result.path || !Array.isArray(result.bounds)) throw new Error('fontTools no devolvio contornos.');
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`No fue posible convertir Poppins SemiBold a contornos: ${lastError?.message ?? 'error desconocido'}`);
}

function fitWordmark(wordmark, target) {
  const [xMin, yMin, xMax, yMax] = wordmark.bounds;
  const width = xMax - xMin;
  const height = yMax - yMin;
  const scale = Math.min(target.width / width, target.height / height);
  const usedWidth = width * scale;
  const usedHeight = height * scale;
  const left = target.x + (target.width - usedWidth) / 2;
  const top = target.y + (target.height - usedHeight) / 2;
  const tx = left - xMin * scale;
  const ty = top + yMax * scale;
  return {
    transform: `translate(${cleanNumber(tx)} ${cleanNumber(ty)}) scale(${cleanNumber(scale)} ${cleanNumber(-scale)})`,
    scale,
    usedWidth,
    usedHeight,
  };
}

function outlinedWordmark(wordmark, target, fill) {
  const fitted = fitWordmark(wordmark, target);
  return {
    markup: `<path aria-label="TradingLab" fill="${fill}" d="${wordmark.path}" transform="${fitted.transform}"/>`,
    ...fitted,
  };
}

function buildHorizontalLockup(parsed, wordmark, inverse = false) {
  const symbolMode = inverse ? 'inverse' : 'duotone';
  const symbol = placedSymbol(
    colorizeMarkup(parsed.markup, symbolMode),
    parsed.viewBox,
    {x: 60, y: 60, width: 600, height: 600},
  );
  const word = outlinedWordmark(
    wordmark,
    {x: 760, y: 182, width: 1660, height: 356},
    inverse ? COLORS.paper : COLORS.ink,
  );
  return svgDocument({
    title: `TradingLab 13A — lockup horizontal${inverse ? ' inverso' : ''}`,
    description: 'Simbolo 13A y wordmark Poppins SemiBold convertido a contornos.',
    viewBox: [0, 0, 2500, 720],
    width: 2500,
    height: 720,
    body: `${symbol}\n${word.markup}`,
  });
}

function buildStackedLockup(parsed, wordmark, inverse = false) {
  const symbolMode = inverse ? 'inverse' : 'duotone';
  const symbol = placedSymbol(
    colorizeMarkup(parsed.markup, symbolMode),
    parsed.viewBox,
    {x: 150, y: 50, width: 900, height: 900},
  );
  const word = outlinedWordmark(
    wordmark,
    {x: 160, y: 1050, width: 880, height: 230},
    inverse ? COLORS.paper : COLORS.ink,
  );
  return svgDocument({
    title: `TradingLab 13A — lockup apilado${inverse ? ' inverso' : ''}`,
    description: 'Simbolo 13A y wordmark Poppins SemiBold convertido a contornos.',
    viewBox: [0, 0, 1200, 1340],
    width: 1200,
    height: 1340,
    body: `${symbol}\n${word.markup}`,
  });
}

function buildAvatar(parsed) {
  const symbol = placedSymbol(
    colorizeMarkup(parsed.markup, 'avatar'),
    parsed.viewBox,
    {x: 145, y: 145, width: 710, height: 710},
  );
  return svgDocument({
    title: 'Avatar TradingLab 13A',
    description: 'Avatar oscuro de esquinas redondeadas con simbolo oficial 13A.',
    viewBox: [0, 0, 1000, 1000],
    width: 1000,
    height: 1000,
    body: `<rect x="36" y="36" width="928" height="928" rx="224" fill="${COLORS.ink}"/>\n${symbol}`,
  });
}

function buildQaSheet(parsed, wordmark) {
  const duotone = colorizeMarkup(parsed.markup, 'duotone');
  const master = colorizeMarkup(parsed.markup, 'master');
  const inverse = colorizeMarkup(parsed.markup, 'inverse');
  const black = colorizeMarkup(parsed.markup, 'black');

  const panels = [
    {x: 80, label: 'DUOTONO / PAPER', bg: COLORS.paper, mark: duotone},
    {x: 650, label: 'MONOCROMO / BLANCO', bg: '#FFFFFF', mark: master},
    {x: 1220, label: 'INVERSO / INK', bg: COLORS.ink, mark: inverse},
    {x: 1790, label: 'INVERSO / AZUL', bg: COLORS.blue, mark: inverse},
  ].map((panel) => `
    <g>
      <rect x="${panel.x}" y="210" width="530" height="530" rx="28" fill="${panel.bg}" stroke="#D8DEE8" stroke-width="2"/>
      ${placedSymbol(panel.mark, parsed.viewBox, {x: panel.x + 82, y: 292, width: 366, height: 366})}
      <text x="${panel.x + 26}" y="702" fill="${panel.bg === COLORS.ink || panel.bg === COLORS.blue ? COLORS.paper : COLORS.ink}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.6">${panel.label}</text>
    </g>`).join('\n');

  const horizontalSymbol = placedSymbol(duotone, parsed.viewBox, {x: 130, y: 858, width: 360, height: 360});
  const horizontalWord = outlinedWordmark(wordmark, {x: 540, y: 930, width: 1020, height: 216}, COLORS.ink).markup;
  const inverseSymbol = placedSymbol(inverse, parsed.viewBox, {x: 1670, y: 875, width: 320, height: 320});
  const inverseWord = outlinedWordmark(wordmark, {x: 1980, y: 960, width: 310, height: 120}, COLORS.paper).markup;

  const reductionSizes = [16, 24, 32, 48, 64];
  let cursor = 100;
  const reductions = reductionSizes.map((size) => {
    const markup = placedSymbol(duotone, parsed.viewBox, {x: cursor, y: 1420 - size, width: size, height: size}, `${size} px`);
    const label = `<text x="${cursor}" y="1460" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="22">${size}px</text>`;
    cursor += Math.max(150, size + 95);
    return `${markup}\n${label}`;
  }).join('\n');

  const loupeSizes = [16, 24, 32, 48].map((size, index) => {
    const x = 1040 + index * 300;
    return `
      <g>
        <rect x="${x}" y="1320" width="250" height="180" rx="18" fill="#FFFFFF" stroke="#D8DEE8" stroke-width="2"/>
        ${placedSymbol(duotone, parsed.viewBox, {x: x + 67, y: 1335, width: 116, height: 116}, `${size} px ampliado`)}
        <text x="${x + 84}" y="1482" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="22" font-weight="700">${size}px × QA</text>
      </g>`;
  }).join('\n');

  return svgDocument({
    title: 'Hoja QA — sistema de marca TradingLab 13A',
    description: 'Pruebas de contraste, lockups y reducciones del logo oficial 13A.',
    viewBox: [0, 0, 2400, 1600],
    width: 2400,
    height: 1600,
    body: `
  <rect width="2400" height="1600" fill="#EEF2F7"/>
  <text x="80" y="92" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="54" font-weight="700">TradingLab · sistema oficial 13A</text>
  <text x="80" y="142" fill="#526073" font-family="Arial, sans-serif" font-size="26">Contraste · composición · reducción · contornos vectoriales</text>
  ${panels}
  <rect x="80" y="810" width="1510" height="450" rx="28" fill="#FFFFFF" stroke="#D8DEE8" stroke-width="2"/>
  <text x="118" y="862" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.5">LOCKUP HORIZONTAL / POSITIVO</text>
  ${horizontalSymbol}
  ${horizontalWord}
  <rect x="1630" y="810" width="690" height="450" rx="28" fill="${COLORS.ink}"/>
  <text x="1668" y="862" fill="${COLORS.paper}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="1.5">INVERSO</text>
  ${inverseSymbol}
  ${inverseWord}
  <text x="80" y="1346" fill="${COLORS.ink}" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="1.5">REDUCCIONES A TAMAÑO REAL</text>
  ${reductions}
  ${loupeSizes}
  <text x="80" y="1550" fill="#526073" font-family="Arial, sans-serif" font-size="22">Recomendado: 24 px o más · 16 px solo como favicon de contingencia</text>
  <path d="M915 1320V1510" stroke="#CCD4E0" stroke-width="2"/>
  <g opacity="0">${black}</g>`,
  });
}

async function writeText(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, contents, 'utf8');
}

async function renderPng(svg, destination, options = {}) {
  const image = sharp(Buffer.from(svg), {density: 192});
  const resized = options.width || options.height
    ? image.resize({
        width: options.width,
        height: options.height,
        fit: options.fit ?? 'contain',
        withoutEnlargement: false,
      })
    : image;
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await resized.png({compressionLevel: 9, adaptiveFiltering: true}).toFile(destination);
}

async function sha256(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const results = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await collectFiles(absolute));
    else results.push(absolute);
  }
  return results;
}

async function validateProductionSvg(filePath, {allowText = false} = {}) {
  const source = await fs.readFile(filePath, 'utf8');
  const failures = [];
  if (/<image\b/i.test(source)) failures.push('contiene <image>');
  if (/<script\b/i.test(source)) failures.push('contiene <script>');
  if (/<foreignObject\b/i.test(source)) failures.push('contiene <foreignObject>');
  if (!allowText && /<text\b/i.test(source)) failures.push('contiene <text> dependiente de fuente');
  if (/\b(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(source)) failures.push('referencia un recurso externo');
  if (failures.length) throw new Error(`${path.basename(filePath)}: ${failures.join(', ')}`);
  return {
    file: path.basename(filePath),
    paths: [...source.matchAll(/<path\b/gi)].length,
    bytes: Buffer.byteLength(source),
    hasText: /<text\b/i.test(source),
    hasImage: /<image\b/i.test(source),
  };
}

function readme({input, font, inputMetrics, wordmark, validation, assetCount}) {
  return `# TradingLab — sistema de marca oficial 13A

Este paquete convierte la selección **13A** en un sistema de producción reproducible. El símbolo representa dos planos de una misma decisión: primero aprender y validar; después ejecutar en un entorno real. No comunica ganancias garantizadas.

## Archivos principales

- \`svg/tradinglab-symbol-master.svg\`: versión monocromática principal.
- \`svg/tradinglab-symbol-duotone.svg\`: ink + blue; versión distintiva recomendada.
- \`svg/tradinglab-symbol-black.svg\`: reproducción técnica a una tinta.
- \`svg/tradinglab-symbol-inverse.svg\`: uso sobre fondos oscuros.
- \`svg/tradinglab-lockup-horizontal.svg\` y \`svg/tradinglab-lockup-stacked.svg\`: wordmark Poppins SemiBold convertido a contornos; no requieren la fuente instalada.
- \`svg/tradinglab-avatar.svg\`: avatar cuadrado con esquinas redondeadas.
- \`png/\`: renders transparentes de símbolo en 2048, 1024, 512, 256, 128, 64, 48, 32, 24 y 16 px; además de lockups y avatar.
- \`qa/tradinglab-13A-qa.png\`: hoja visual de contraste, composición y reducciones.
- \`manifest.json\`: procedencia, métricas, hashes y validaciones.

## Paleta

| Token | Hex | Uso |
| --- | --- | --- |
| Ink | \`${COLORS.ink}\` | Marca principal, tipografía, fondos oscuros |
| Blue | \`${COLORS.blue}\` | Segundo plano del símbolo y acento |
| Paper | \`${COLORS.paper}\` | Fondos claros e inversión |

## Reglas rápidas

- Use el duotono sobre Paper o blanco. Sobre Ink/Blue, use el inverso.
- Mantenga un margen libre mínimo de **1/8 del ancho del símbolo** por cada lado.
- Tamaño digital recomendado del símbolo: **24 px o más**. La variante de 16 px se reserva para favicon o contingencia técnica.
- No cambie la relación entre los dos planos, no añada sombras ni estire el conjunto.
- En los lockups, no reescriba el wordmark: ya está convertido a geometría vectorial.

## Motion

Para el video promocional, anime primero el plano superior (aprendizaje/análisis), haga una pausa breve de validación y revele después el plano azul (ejecución real). Duración sugerida del reveal: 0,8–1,2 s, con easing preciso y sin rebote caricaturesco. Mantenga el mensaje **“Aprende. Practica. Luego opera en real.”** y evite claims de rentabilidad o ganancias aseguradas.

## Trazabilidad

- Maestro de entrada: \`${path.relative(projectRoot, input).replaceAll('\\', '/')}\`
- ViewBox de entrada: \`${inputMetrics.viewBox.join(' ')}\`
- Formas / paths de entrada: **${inputMetrics.shapeCount} / ${inputMetrics.pathCount}**
- Anclas vectoriales estimadas: **${inputMetrics.anchorCount}**
- Curvas detectadas: **${inputMetrics.curveCount}**
- Wordmark: **${wordmark.fontFamily} ${wordmark.fontStyle}**, ${wordmark.glyphs.length} glifos, convertido desde \`${font.replaceAll('\\', '/')}\`
- SVG de producción validados: **${validation.length}**
- Archivos totales generados: **${assetCount}**

## Regenerar

\`\`\`powershell
node scripts/build-tradinglab-brand-system.mjs "ruta\\al\\simbolo-maestro.svg"
\`\`\`

Puede indicar otra salida con \`--output\` y otra instalación de Poppins SemiBold con \`--font\`.
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [inputSource] = await Promise.all([
    fs.readFile(options.input, 'utf8'),
    fs.access(options.font),
  ]);
  const parsed = parseSvg(inputSource);
  const wordmark = extractWordmark(options.font);

  await fs.mkdir(options.output, {recursive: true});
  const svgDir = path.join(options.output, 'svg');
  const pngDir = path.join(options.output, 'png');
  const qaDir = path.join(options.output, 'qa');

  const symbols = {
    master: buildSymbolSvg(parsed, 'master'),
    duotone: buildSymbolSvg(parsed, 'duotone'),
    black: buildSymbolSvg(parsed, 'black'),
    inverse: buildSymbolSvg(parsed, 'inverse'),
  };
  const horizontal = buildHorizontalLockup(parsed, wordmark, false);
  const horizontalInverse = buildHorizontalLockup(parsed, wordmark, true);
  const stacked = buildStackedLockup(parsed, wordmark, false);
  const stackedInverse = buildStackedLockup(parsed, wordmark, true);
  const avatar = buildAvatar(parsed);
  const qa = buildQaSheet(parsed, wordmark);

  const svgFiles = {
    'tradinglab-symbol-master.svg': symbols.master,
    'tradinglab-symbol-duotone.svg': symbols.duotone,
    'tradinglab-symbol-black.svg': symbols.black,
    'tradinglab-symbol-inverse.svg': symbols.inverse,
    'tradinglab-lockup-horizontal.svg': horizontal,
    'tradinglab-lockup-horizontal-inverse.svg': horizontalInverse,
    'tradinglab-lockup-stacked.svg': stacked,
    'tradinglab-lockup-stacked-inverse.svg': stackedInverse,
    'tradinglab-avatar.svg': avatar,
  };

  await Promise.all(Object.entries(svgFiles).map(([name, contents]) => writeText(path.join(svgDir, name), contents)));
  await writeText(path.join(qaDir, 'tradinglab-13A-qa.svg'), qa);

  const renders = [];
  for (const [variant, svg] of Object.entries(symbols)) {
    for (const size of ICON_SIZES) {
      const destination = path.join(pngDir, 'symbols', variant, `tradinglab-symbol-${variant}-${size}.png`);
      renders.push(renderPng(svg, destination, {width: size, height: size}));
    }
  }
  for (const size of AVATAR_SIZES) {
    renders.push(renderPng(avatar, path.join(pngDir, 'avatar', `tradinglab-avatar-${size}.png`), {width: size, height: size}));
  }
  renders.push(
    renderPng(horizontal, path.join(pngDir, 'lockups', 'tradinglab-lockup-horizontal-2500.png'), {width: 2500}),
    renderPng(horizontal, path.join(pngDir, 'lockups', 'tradinglab-lockup-horizontal-1250.png'), {width: 1250}),
    renderPng(horizontalInverse, path.join(pngDir, 'lockups', 'tradinglab-lockup-horizontal-inverse-2500.png'), {width: 2500}),
    renderPng(stacked, path.join(pngDir, 'lockups', 'tradinglab-lockup-stacked-1200.png'), {width: 1200}),
    renderPng(stackedInverse, path.join(pngDir, 'lockups', 'tradinglab-lockup-stacked-inverse-1200.png'), {width: 1200}),
    renderPng(qa, path.join(qaDir, 'tradinglab-13A-qa.png'), {width: 2400, height: 1600}),
  );
  await Promise.all(renders);

  const productionSvgPaths = Object.keys(svgFiles).map((name) => path.join(svgDir, name));
  const validation = await Promise.all(productionSvgPaths.map((filePath) => validateProductionSvg(filePath)));

  const alphaSample = path.join(pngDir, 'symbols', 'duotone', 'tradinglab-symbol-duotone-256.png');
  const alphaMetadata = await sharp(alphaSample).metadata();
  const alphaStats = await sharp(alphaSample).stats();
  if (!alphaMetadata.hasAlpha || alphaStats.channels.length < 4 || alphaStats.channels[3].min !== 0) {
    throw new Error('La prueba PNG no conserva transparencia real.');
  }

  const currentFiles = await collectFiles(options.output);
  const trackedFiles = currentFiles.filter((filePath) => {
    const relative = path.relative(options.output, filePath).replaceAll('\\', '/');
    return relative !== 'manifest.json' && relative !== 'README.md';
  });
  const manifestEntries = await Promise.all(trackedFiles.map(async (filePath) => {
    const stat = await fs.stat(filePath);
    return {
      file: path.relative(options.output, filePath).replaceAll('\\', '/'),
      bytes: stat.size,
      sha256: await sha256(filePath),
    };
  }));

  const manifest = {
    brand: 'TradingLab',
    officialSelection: '13A',
    generatedAt: new Date().toISOString(),
    source: path.relative(projectRoot, options.input).replaceAll('\\', '/'),
    sourceSha256: await sha256(options.input),
    palette: COLORS,
    input: {
      viewBox: parsed.viewBox,
      shapes: parsed.shapeCount,
      paths: parsed.pathCount,
      estimatedAnchors: parsed.anchorCount,
      curves: parsed.curveCount,
      embeddedImages: 0,
    },
    wordmark: {
      font: `${wordmark.fontFamily} ${wordmark.fontStyle}`,
      source: options.font.replaceAll('\\', '/'),
      glyphs: wordmark.glyphs,
      outlined: true,
      bounds: wordmark.bounds,
      advanceWidth: wordmark.advanceWidth,
    },
    exports: {
      transparentSymbolPngSizes: ICON_SIZES,
      avatarPngSizes: AVATAR_SIZES,
      svgProductionValidation: validation,
      alphaSample: {
        file: path.relative(options.output, alphaSample).replaceAll('\\', '/'),
        hasAlpha: alphaMetadata.hasAlpha,
        alphaMin: alphaStats.channels[3].min,
        alphaMax: alphaStats.channels[3].max,
      },
    },
    files: manifestEntries,
  };

  await writeText(path.join(options.output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeText(path.join(options.output, 'README.md'), readme({
    input: options.input,
    font: options.font,
    inputMetrics: {...parsed, markup: undefined},
    wordmark,
    validation,
    assetCount: manifestEntries.length + 2,
  }));

  const finalFiles = await collectFiles(options.output);
  console.log(JSON.stringify({
    status: 'ok',
    selection: '13A',
    input: options.input,
    output: options.output,
    inputPaths: parsed.pathCount,
    inputAnchors: parsed.anchorCount,
    inputCurves: parsed.curveCount,
    wordmarkOutlined: true,
    productionSvgValidated: validation.length,
    filesGenerated: finalFiles.length,
    qa: path.join(qaDir, 'tradinglab-13A-qa.png'),
  }, null, 2));
}

main().catch((error) => {
  console.error(`ERROR: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
