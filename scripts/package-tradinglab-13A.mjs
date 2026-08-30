#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(
  projectRoot,
  'identidad visual',
  'logo-master-13A-final-2026-08-29',
);
const deliveryRoot = path.join(sourceRoot, 'delivery', 'TradingLab-13A-Final');

async function copy(source, destination) {
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await fs.copyFile(source, destination);
}

async function copyTree(source, destination) {
  await fs.mkdir(destination, {recursive: true});
  await fs.cp(source, destination, {recursive: true, force: true});
}

async function renderSquare(source, destination, size) {
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await sharp(source, {density: 240})
    .resize(size, size, {fit: 'contain'})
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toFile(destination);
}

async function listFiles(root, directory = root) {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else files.push(absolute);
  }
  return files;
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

await fs.mkdir(deliveryRoot, {recursive: true});

await copyTree(
  path.join(sourceRoot, 'brand-system'),
  path.join(deliveryRoot, 'Brand-System'),
);
await copyTree(
  path.join(sourceRoot, 'final-editables-ai'),
  path.join(deliveryRoot, 'Editables-AI'),
);

const masterFiles = [
  ['brand-system/svg/tradinglab-symbol-master.svg', 'Logo-Master/tradinglab-symbol-master.svg'],
  ['brand-system/svg/tradinglab-symbol-duotone.svg', 'Logo-Master/tradinglab-symbol-duotone.svg'],
  ['brand-system/svg/tradinglab-symbol-black.svg', 'Logo-Master/tradinglab-symbol-black.svg'],
  ['brand-system/svg/tradinglab-symbol-inverse.svg', 'Logo-Master/tradinglab-symbol-inverse.svg'],
  ['brand-system/svg/tradinglab-lockup-horizontal.svg', 'Logo-Master/tradinglab-lockup-horizontal.svg'],
  ['brand-system/svg/tradinglab-lockup-stacked.svg', 'Logo-Master/tradinglab-lockup-stacked.svg'],
  ['brand-system/png/symbols/duotone/tradinglab-symbol-duotone-2048.png', 'Logo-Master/tradinglab-symbol-duotone-2048.png'],
  ['brand-system/png/lockups/tradinglab-lockup-horizontal-2500.png', 'Logo-Master/tradinglab-lockup-horizontal-2500.png'],
  ['final-editables-ai/tradinglab-symbol-master.ai', 'Logo-Master/tradinglab-symbol-master.ai'],
  ['final-editables-ai/tradinglab-symbol-duotone.ai', 'Logo-Master/tradinglab-symbol-duotone.ai'],
  ['final-editables-ai/tradinglab-lockup-horizontal.ai', 'Logo-Master/tradinglab-lockup-horizontal.ai'],
  ['final-editables-ai/tradinglab-lockup-stacked.ai', 'Logo-Master/tradinglab-lockup-stacked.ai'],
];

for (const [source, destination] of masterFiles) {
  await copy(path.join(sourceRoot, source), path.join(deliveryRoot, destination));
}

const microSources = [
  ['tradinglab-symbol-micro.svg', 'mono'],
  ['tradinglab-symbol-duotone-micro.svg', 'duotone'],
];
for (const [fileName, variant] of microSources) {
  const source = path.join(sourceRoot, 'manual-clean', fileName);
  await copy(source, path.join(deliveryRoot, 'Micro-16-24px', fileName));
  for (const size of [16, 24, 32, 64]) {
    await renderSquare(
      source,
      path.join(deliveryRoot, 'Micro-16-24px', 'png', variant, fileName.replace('.svg', `-${size}.png`)),
      size,
    );
  }
}

await copy(
  path.join(sourceRoot, 'manual-clean', 'tradinglab-symbol-reduction-sheet.png'),
  path.join(deliveryRoot, 'QA', 'tradinglab-13A-reductions-micro.png'),
);
await copy(
  path.join(sourceRoot, 'brand-system', 'qa', 'tradinglab-13A-qa.png'),
  path.join(deliveryRoot, 'QA', 'tradinglab-13A-system-qa.png'),
);
await copy(
  path.join(sourceRoot, 'manual-clean', 'construction-report.json'),
  path.join(deliveryRoot, 'Source', 'construction-report.json'),
);
await copy(
  path.join(projectRoot, 'scripts', 'build-tradinglab-13A-clean.mjs'),
  path.join(deliveryRoot, 'Source', 'build-tradinglab-13A-clean.mjs'),
);
await copy(
  path.join(projectRoot, 'scripts', 'build-tradinglab-brand-system.mjs'),
  path.join(deliveryRoot, 'Source', 'build-tradinglab-brand-system.mjs'),
);

const readme = `# TradingLab — logo master 13A

Selección oficial: **13A**. El símbolo representa una transición deliberada: aprender y validar primero; operar en real después. No comunica ganancias garantizadas.

## Qué usar

- **Logo-Master/**: archivos principales listos para diseño, web, redes y motion.
- **Editables-AI/**: versiones editables guardadas desde Adobe Illustrator, compatibles con Illustrator CC y PDF.
- **Brand-System/**: sistema completo en SVG y PNG, lockups, avatar, QA y manifiesto técnico.
- **Micro-16-24px/**: variante óptica para favicon o tamaños de 16–24 px. Use el master normal desde 32 px.
- **QA/**: pruebas de contraste, fondos, composición y reducción.
- **Source/**: geometría y scripts reproducibles del master.

## Paleta

- Deep Ink: \`#071324\`
- Decision Blue: \`#185ADB\`
- Paper: \`#F7F9FC\`

## Reglas

- El master oficial es la versión monocromática; el duotono es la extensión distintiva para digital y motion.
- Mantenga un margen libre mínimo de 1/8 del ancho del símbolo.
- No cambie las proporciones, el rombo central ni el ángulo de los planos.
- No añada sombras, biseles ni contornos al símbolo.
- Use la variante micro únicamente a 16–24 px; no la escale para piezas grandes.
- Wordmark: Poppins SemiBold convertido a contornos, por lo que no requiere la fuente instalada.

## Dirección de motion

Anime primero el plano superior Ink como aprendizaje/análisis; marque una pausa breve de validación; revele después el plano inferior Blue como ejecución real. Mensaje rector: **“Aprende. Practica. Luego opera en real.”**

Master aprobado el 29 de agosto de 2026 tras revisión geométrica y óptica independiente.
`;
await fs.writeFile(path.join(deliveryRoot, 'LEEME.md'), readme, 'utf8');

const files = (await listFiles(deliveryRoot))
  .filter((filePath) => path.basename(filePath) !== 'FILE-MANIFEST.json')
  .sort((left, right) => left.localeCompare(right));
const entries = [];
for (const filePath of files) {
  const stat = await fs.stat(filePath);
  entries.push({
    path: path.relative(deliveryRoot, filePath).replaceAll('\\', '/'),
    bytes: stat.size,
    sha256: await sha256(filePath),
  });
}

const manifest = {
  brand: 'TradingLab',
  selection: '13A',
  status: 'master-final',
  generatedAt: new Date().toISOString(),
  colors: {ink: '#071324', blue: '#185ADB', paper: '#F7F9FC'},
  files: entries,
};
await fs.writeFile(
  path.join(deliveryRoot, 'FILE-MANIFEST.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({
  status: 'ok',
  deliveryRoot,
  files: entries.length + 1,
}, null, 2));
