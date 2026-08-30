#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = 'C:/Users/brame/Desktop/Work/TradingLab/identidad visual/logo-master-13A-final-2026-08-29/delivery/TradingLab-13A-Final';
const issues = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const files = await walk(root);
const required = [
  'LEEME.md',
  'FILE-MANIFEST.json',
  'Logo-Master/tradinglab-symbol-master.ai',
  'Logo-Master/tradinglab-symbol-master.svg',
  'Logo-Master/tradinglab-symbol-duotone-2048.png',
  'Logo-Master/tradinglab-lockup-horizontal.ai',
  'Logo-Master/tradinglab-lockup-horizontal.svg',
  'Micro-16-24px/tradinglab-symbol-micro.svg',
  'Micro-16-24px/png/duotone/tradinglab-symbol-duotone-micro-16.png',
  'QA/tradinglab-13A-system-qa.png',
];
for (const item of required) {
  try {
    await fs.access(path.join(root, item));
  } catch {
    issues.push(`Falta archivo requerido: ${item}`);
  }
}

const svgFiles = files.filter((filePath) => filePath.endsWith('.svg'));
for (const filePath of svgFiles) {
  const markup = await fs.readFile(filePath, 'utf8');
  if (!/<svg\b/i.test(markup)) issues.push(`SVG invalido: ${relative(filePath)}`);
  const forbidden = markup.match(/<(?:image|text|filter|mask|foreignObject)\b|(?:xlink:)?href\s*=/i);
  const isQaArtwork = relative(filePath).startsWith('Brand-System/qa/');
  if (forbidden && !isQaArtwork) issues.push(`SVG con dependencia o elemento prohibido (${forbidden[0]}): ${relative(filePath)}`);
}

const masterMarkup = await fs.readFile(path.join(root, 'Logo-Master', 'tradinglab-symbol-master.svg'), 'utf8');
const masterPaths = (masterMarkup.match(/<path\b/g) ?? []).length;
const masterCurves = (masterMarkup.match(/[Cc](?=[-+\d.])/g) ?? []).length;
if (masterPaths !== 2) issues.push(`El master debe tener 2 paths; tiene ${masterPaths}`);
if (masterCurves !== 8) issues.push(`El master debe tener 8 curvas cubicas; tiene ${masterCurves}`);

const pngFiles = files.filter((filePath) => filePath.endsWith('.png'));
for (const filePath of pngFiles) {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) issues.push(`PNG sin dimensiones: ${relative(filePath)}`);
  const sizeMatch = path.basename(filePath).match(/-(16|24|32|48|64|128|256|512|1024|1200|1250|2048|2500)\.png$/);
  if (sizeMatch) {
    const expected = Number(sizeMatch[1]);
    if (metadata.width !== expected && metadata.height !== expected) {
      issues.push(`PNG no coincide con su etiqueta ${expected}: ${relative(filePath)} (${metadata.width}x${metadata.height})`);
    }
  }
}

const aiFiles = files.filter((filePath) => filePath.endsWith('.ai'));
for (const filePath of aiFiles) {
  const data = await fs.readFile(filePath);
  const header = data.subarray(0, 12).toString('latin1');
  if (!header.startsWith('%PDF-') && !header.startsWith('%!PS-Adobe')) {
    issues.push(`AI sin cabecera Illustrator/PDF: ${relative(filePath)}`);
  }
}

const manifest = JSON.parse(await fs.readFile(path.join(root, 'FILE-MANIFEST.json'), 'utf8'));
for (const entry of manifest.files) {
  const filePath = path.join(root, entry.path);
  const data = await fs.readFile(filePath);
  if (data.length !== entry.bytes) issues.push(`Bytes no coinciden: ${entry.path}`);
  if (hash(data) !== entry.sha256) issues.push(`SHA-256 no coincide: ${entry.path}`);
}
if (manifest.files.length !== files.length - 1) {
  issues.push(`Manifest tiene ${manifest.files.length} entradas para ${files.length - 1} archivos rastreables`);
}

const report = {
  status: issues.length === 0 ? 'PASS' : 'FAIL',
  files: files.length,
  svgFiles: svgFiles.length,
  pngFiles: pngFiles.length,
  aiFiles: aiFiles.length,
  masterPaths,
  masterCurves,
  manifestEntries: manifest.files.length,
  issues,
};
console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
