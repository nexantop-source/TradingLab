import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const ADS_ROOT = path.join(ROOT, 'publicidad');
const LOGO_ROOT = path.join(ROOT, 'identidad visual', 'logos');
const DISCLAIMER = 'Simulación educativa · Saldo DEMO sin valor monetario · No es asesoramiento financiero.';

const formatByName = new Map([
  ['cuadrado-1080x1080.svg', [1080, 1080]],
  ['vertical-1080x1350.svg', [1080, 1350]],
  ['horizontal-1200x628.svg', [1200, 628]],
]);

const logoSizes = new Map([
  ['tradinglab-logo-principal.svg', [1200, 360]],
  ['tradinglab-logo-horizontal.svg', [1000, 220]],
  ['tradinglab-simbolo.svg', [512, 512]],
  ['tradinglab-monocromo-positivo.svg', [1200, 360]],
  ['tradinglab-monocromo-negativo.svg', [1200, 360]],
  ['tradinglab-favicon.svg', [512, 512]],
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function pngFor(svgPath) {
  return svgPath.replace(/\.svg$/i, '.png');
}

async function render(svgPath, width, height) {
  await sharp(svgPath, { density: 216 })
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(pngFor(svgPath));
}

function exactSvgSize(source, width, height) {
  return source.includes(`width="${width}"`) &&
    source.includes(`height="${height}"`) &&
    source.includes(`viewBox="0 0 ${width} ${height}"`);
}

async function validatePair(svgPath, width, height, isAd) {
  const source = await readFile(svgPath, 'utf8');
  if (!exactSvgSize(source, width, height)) {
    throw new Error(`Dimensiones SVG incorrectas: ${path.relative(ROOT, svgPath)}`);
  }
  if (isAd && !source.includes(DISCLAIMER)) {
    throw new Error(`Disclaimer ausente: ${path.relative(ROOT, svgPath)}`);
  }
  const pngPath = pngFor(svgPath);
  const metadata = await sharp(pngPath).metadata();
  if (metadata.width !== width || metadata.height !== height || metadata.format !== 'png') {
    throw new Error(`PNG inválido: ${path.relative(ROOT, pngPath)}`);
  }
  const digest = createHash('sha256').update(await readFile(pngPath)).digest('hex');
  return { file: path.relative(ROOT, pngPath).replaceAll('\\', '/'), width, height, sha256: digest };
}

const adSvgs = (await walk(ADS_ROOT)).filter((file) => formatByName.has(path.basename(file)));
if (adSvgs.length !== 15) throw new Error(`Se esperaban 15 SVG publicitarios; encontrados: ${adSvgs.length}`);

for (const svgPath of adSvgs) {
  const [width, height] = formatByName.get(path.basename(svgPath));
  await render(svgPath, width, height);
}

const logoSvgs = (await walk(LOGO_ROOT)).filter((file) => logoSizes.has(path.basename(file)));
if (logoSvgs.length !== 6) throw new Error(`Se esperaban 6 SVG de logo; encontrados: ${logoSvgs.length}`);
for (const svgPath of logoSvgs) {
  const [width, height] = logoSizes.get(path.basename(svgPath));
  await render(svgPath, width, height);
}

const manifest = [];
for (const svgPath of adSvgs.sort()) {
  const [width, height] = formatByName.get(path.basename(svgPath));
  manifest.push(await validatePair(svgPath, width, height, true));
}
for (const svgPath of logoSvgs.sort()) {
  const [width, height] = logoSizes.get(path.basename(svgPath));
  await validatePair(svgPath, width, height, false);
}

console.log(JSON.stringify({ ok: true, ads: manifest.length, logos: logoSvgs.length, assets: manifest }, null, 2));
