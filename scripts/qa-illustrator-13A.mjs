import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const assetRoot = path.join(root, 'identidad visual', 'logo-master-13A-final-2026-08-29');
const qaRoot = path.join(assetRoot, 'qa-illustrator');

const COLORS = {
  ink: '#071324',
  blue: '#185ADB',
  paper: '#F7F9FC',
  muted: '#718096',
  line: '#D9E1EC',
  white: '#FFFFFF',
};

const sizes = [16, 24, 32, 48, 64];
const boardWidth = 1800;
const boardHeight = 1120;
const masterSvg = await fs.readFile(path.join(assetRoot, 'tradinglab-symbol-master.svg'));
const inverseSvg = await fs.readFile(path.join(assetRoot, 'tradinglab-symbol-inverse.svg'));
const duotoneSvg = await fs.readFile(path.join(assetRoot, 'tradinglab-symbol-duotone.svg'));

await fs.mkdir(qaRoot, {recursive: true});

const escapeXml = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[char]));

function labelSvg(text, width, height, color = COLORS.ink, size = 28, weight = 600) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${width / 2}" y="${height * 0.68}" text-anchor="middle" fill="${color}"
      font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(text)}</text>
  </svg>`);
}

async function render(svg, size) {
  return sharp(svg, {density: 320}).resize(size, size, {fit: 'contain'}).png().toBuffer();
}

async function zoomed(svg, size, factor) {
  const actual = await render(svg, size);
  return sharp(actual).resize(size * factor, size * factor, {kernel: 'nearest'}).png().toBuffer();
}

const canvas = sharp({
  create: {width: boardWidth, height: boardHeight, channels: 4, background: COLORS.paper},
});

const composites = [];
composites.push({
  input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="${boardHeight}">
    <rect width="${boardWidth}" height="${boardHeight}" fill="${COLORS.paper}"/>
    <text x="80" y="92" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="52" font-weight="700">TradingLab 13A · QA de reducción</text>
    <text x="80" y="142" fill="${COLORS.muted}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="26">Píxel real ampliado con vecino más cercano · master, duotono e inverso</text>
    <line x1="80" y1="178" x2="1720" y2="178" stroke="${COLORS.blue}" stroke-width="3"/>
  </svg>`),
  left: 0,
  top: 0,
});

const cardWidth = 300;
const cardHeight = 250;
const startX = 80;
const gap = 30;
const rows = [
  {name: 'Master / Paper', svg: masterSvg, top: 230, background: COLORS.white, label: COLORS.ink},
  {name: 'Inverse / Deep Ink', svg: inverseSvg, top: 550, background: COLORS.ink, label: COLORS.paper},
];

for (const row of rows) {
  composites.push({input: labelSvg(row.name, 280, 50, COLORS.ink, 24, 600), left: 80, top: row.top - 58});
  for (let index = 0; index < sizes.length; index++) {
    const size = sizes[index];
    const left = startX + index * (cardWidth + gap);
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}">
        <rect width="${cardWidth}" height="${cardHeight}" rx="26" fill="${row.background}" stroke="${row.background === COLORS.white ? COLORS.line : '#152640'}" stroke-width="2"/>
      </svg>`),
      left,
      top: row.top,
    });
    const factor = Math.max(2, Math.floor(160 / size));
    const preview = await zoomed(row.svg, size, factor);
    composites.push({
      input: preview,
      left: left + Math.round((cardWidth - size * factor) / 2),
      top: row.top + 30,
    });
    composites.push({input: labelSvg(`${size}px · ${factor}×`, cardWidth, 48, row.label, 22, 600), left, top: row.top + cardHeight - 58});
  }
}

const duoSize = 250;
const duo = await render(duotoneSvg, duoSize);
composites.push({
  input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="220">
    <rect width="1640" height="220" rx="30" fill="${COLORS.white}" stroke="${COLORS.line}" stroke-width="2"/>
    <text x="330" y="84" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="34" font-weight="700">Extensión digital / motion</text>
    <text x="330" y="130" fill="${COLORS.muted}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="25">El plano inferior usa Decision Blue; el master oficial sigue siendo monocromático.</text>
    <circle cx="335" cy="172" r="12" fill="${COLORS.ink}"/><text x="360" y="182" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="23">Deep Ink ${COLORS.ink}</text>
    <circle cx="650" cy="172" r="12" fill="${COLORS.blue}"/><text x="675" y="182" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="23">Decision Blue ${COLORS.blue}</text>
  </svg>`),
  left: 80,
  top: 860,
});
composites.push({input: duo, left: 110, top: 845});

await canvas.composite(composites).png().toFile(path.join(qaRoot, 'tradinglab-13A-reduction-sheet.png'));
console.log(path.join(qaRoot, 'tradinglab-13A-reduction-sheet.png'));
