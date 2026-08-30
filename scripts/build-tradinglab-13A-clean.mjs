import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const output = path.join(root, 'identidad visual', 'logo-master-13A-final-2026-08-29', 'manual-clean');

const COLORS = {
  ink: '#071324',
  blue: '#185ADB',
  paper: '#F7F9FC',
};

// The upper plane is hand-authored with ten anchors. The lower plane and its
// connector are exact 180-degree rotations, giving the mark deliberate balance.
// Each connector contributes four anchors, so every plane stays at 14 anchors.
const upperBand = [
  'M180 390',
  'C180 360 195 335 220 318',
  'L548 100',
  'C580 79 620 101 620 140',
  'L620 300',
  'C620 324 610 345 590 360',
  'L500 405',
  'L395 500',
  'L240 615',
  'C214 633 180 615 180 583',
  'Z',
].join(' ');

const upperConnector = 'M500 405 L605 500 L617 491 L518 396 Z';
const lowerBand = [
  'M820 610',
  'C820 640 805 665 780 682',
  'L452 900',
  'C420 921 380 899 380 860',
  'L380 700',
  'C380 676 390 655 410 640',
  'L500 595',
  'L605 500',
  'L760 385',
  'C786 367 820 385 820 417',
  'Z',
].join(' ');

const lowerConnector = 'M500 595 L395 500 L383 509 L482 604 Z';

const upperPath = `${upperBand} ${upperConnector}`;
const lowerPath = `${lowerBand} ${lowerConnector}`;

// Optical micro variant for 16–24 px: the aperture is 20% larger while the
// external silhouette stays unchanged. This preserves the evidence fold at UI scale.
const microUpperBand = [
  'M180 390',
  'C180 360 195 335 220 318',
  'L548 100',
  'C580 79 620 101 620 140',
  'L620 300',
  'C620 324 610 345 590 360',
  'L500 386',
  'L374 500',
  'L240 615',
  'C214 633 180 615 180 583',
  'Z',
].join(' ');
const microUpperConnector = 'M500 386 L626 500 L640 489 L518 381 Z';
const microLowerBand = [
  'M820 610',
  'C820 640 805 665 780 682',
  'L452 900',
  'C420 921 380 899 380 860',
  'L380 700',
  'C380 676 390 655 410 640',
  'L500 614',
  'L626 500',
  'L760 385',
  'C786 367 820 385 820 417',
  'Z',
].join(' ');
const microLowerConnector = 'M500 614 L374 500 L360 511 L482 619 Z';
const microUpperPath = `${microUpperBand} ${microUpperConnector}`;
const microLowerPath = `${microLowerBand} ${microLowerConnector}`;

function symbolSvg(upperFill, lowerFill, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  <path id="plane-upper" d="${upperPath}" fill="${upperFill}"/>
  <path id="plane-lower" d="${lowerPath}" fill="${lowerFill}"/>
</svg>\n`;
}

function microSymbolSvg(upperFill, lowerFill, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  <path id="plane-upper" d="${microUpperPath}" fill="${upperFill}"/>
  <path id="plane-lower" d="${microLowerPath}" fill="${lowerFill}"/>
</svg>\n`;
}

const assets = {
  'tradinglab-symbol-master.svg': symbolSvg(COLORS.ink, COLORS.ink, 'TradingLab 13A master symbol'),
  'tradinglab-symbol-duotone.svg': symbolSvg(COLORS.ink, COLORS.blue, 'TradingLab 13A duotone symbol'),
  'tradinglab-symbol-inverse.svg': symbolSvg(COLORS.paper, COLORS.paper, 'TradingLab 13A inverse symbol'),
  'tradinglab-symbol-black.svg': symbolSvg('#000000', '#000000', 'TradingLab 13A black symbol'),
  'tradinglab-symbol-micro.svg': microSymbolSvg(COLORS.ink, COLORS.ink, 'TradingLab 13A micro symbol'),
  'tradinglab-symbol-duotone-micro.svg': microSymbolSvg(COLORS.ink, COLORS.blue, 'TradingLab 13A duotone micro symbol'),
};

await fs.mkdir(output, {recursive: true});
for (const [name, content] of Object.entries(assets)) {
  await fs.writeFile(path.join(output, name), content, 'utf8');
}

await sharp(Buffer.from(assets['tradinglab-symbol-duotone.svg']))
  .resize(1800, 1800)
  .flatten({background: COLORS.paper})
  .png()
  .toFile(path.join(output, 'tradinglab-symbol-duotone-on-paper.png'));

await sharp(Buffer.from(assets['tradinglab-symbol-master.svg']))
  .resize(1800, 1800)
  .flatten({background: COLORS.paper})
  .png()
  .toFile(path.join(output, 'tradinglab-symbol-master-on-paper.png'));

const sizes = [16, 24, 32, 48, 64, 128];
const boardWidth = 1800;
const boardHeight = 680;
const cells = [];
for (let index = 0; index < sizes.length; index++) {
  const size = sizes[index];
  const zoom = Math.max(2, Math.floor(180 / size));
  const sizeSvg = size <= 24 ? assets['tradinglab-symbol-duotone-micro.svg'] : assets['tradinglab-symbol-duotone.svg'];
  const actual = await sharp(Buffer.from(sizeSvg))
    .resize(size, size)
    .png()
    .toBuffer();
  const enlarged = await sharp(actual)
    .resize(size * zoom, size * zoom, {kernel: 'nearest'})
    .png()
    .toBuffer();
  const left = 90 + index * 280;
  cells.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320">
      <rect width="240" height="320" rx="24" fill="#FFFFFF" stroke="#D9E1EC" stroke-width="2"/>
      <text x="120" y="286" text-anchor="middle" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="24" font-weight="600">${size}px · ${zoom}×</text>
    </svg>`),
    left,
    top: 240,
  });
  cells.push({input: enlarged, left: left + Math.round((240 - size * zoom) / 2), top: 280});
}

await sharp({create: {width: boardWidth, height: boardHeight, channels: 4, background: COLORS.paper}})
  .composite([
    {
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="220">
        <text x="90" y="86" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="50" font-weight="700">13A · redibujo manual</text>
        <text x="90" y="138" fill="#718096" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="26">14 anclas por plano · rombo exacto · conectores paralelos · prueba de píxel real</text>
        <line x1="90" y1="182" x2="1710" y2="182" stroke="${COLORS.blue}" stroke-width="3"/>
      </svg>`),
      left: 0,
      top: 0,
    },
    ...cells,
  ])
  .png()
  .toFile(path.join(output, 'tradinglab-symbol-reduction-sheet.png'));

const report = {
  geometry: 'hand-authored rotationally balanced cubic Bezier construction',
  viewBox: '0 0 1000 1000',
  paths: 2,
  anchorsPerPlane: 14,
  curvesPerPlane: 4,
  centerDiamond: {top: [500, 405], right: [605, 500], bottom: [500, 595], left: [395, 500]},
  microCenterDiamond: {top: [500, 386], right: [626, 500], bottom: [500, 614], left: [374, 500]},
  connectorThickness: 18,
  palette: COLORS,
  pureVector: true,
};
await fs.writeFile(path.join(output, 'construction-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({output, report}, null, 2));
