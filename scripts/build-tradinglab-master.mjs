import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'identidad visual', 'refinamiento-logo-13-2026-08-29', '13A-core.png');
const output = path.join(root, 'identidad visual', 'logo-master-13A-2026-08-29');
const pngDir = path.join(output, 'png');

const COLORS = {
  ink: '#071324',
  blue: '#185ADB',
  paper: '#F7F9FC',
};

const threshold = 128;
const simplifyTolerance = 1.25;

const {data, info} = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({resolveWithObject: true});

const {width, height, channels} = info;
const fullMask = new Uint8Array(width * height);
let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const alpha = data[(y * width + x) * channels + 3];
    if (alpha >= threshold) {
      fullMask[y * width + x] = 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

if (maxX < minX || maxY < minY) throw new Error('No opaque mark pixels found.');

const centerX = (minX + maxX) / 2;
const centerY = (minY + maxY) / 2;
const splitValue = centerX + centerY;
const upperSeed = new Uint8Array(fullMask.length);
const lowerSeed = new Uint8Array(fullMask.length);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (!fullMask[index]) continue;
    if (x + y <= splitValue) upperSeed[index] = 1;
    else lowerSeed[index] = 1;
  }
}

function largestComponent(mask, w, h) {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let best = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    const component = [];
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++];
      component.push(index);
      const x = index % w;
      const y = Math.floor(index / w);
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < w) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - w);
      if (y + 1 < h) neighbors.push(index + w);
      for (const next of neighbors) {
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }

    if (component.length > best.length) best = component;
  }

  const kept = new Uint8Array(mask.length);
  for (const index of best) kept[index] = 1;
  return {mask: kept, area: best.length};
}

function boundaryLoops(mask, w, h) {
  const outgoing = new Map();
  const key = (x, y) => `${x},${y}`;
  const addEdge = (x1, y1, x2, y2) => {
    const k = key(x1, y1);
    const list = outgoing.get(k) ?? [];
    list.push({x: x2, y: y2});
    outgoing.set(k, list);
  };
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) addEdge(x, y, x + 1, y);
      if (!on(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!on(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!on(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  }

  const loops = [];
  while (outgoing.size) {
    const [startKey, starts] = outgoing.entries().next().value;
    const [sx, sy] = startKey.split(',').map(Number);
    const firstEnd = starts.pop();
    if (!starts.length) outgoing.delete(startKey);
    const loop = [{x: sx, y: sy}, firstEnd];
    let current = firstEnd;
    let guard = 0;

    while ((current.x !== sx || current.y !== sy) && guard++ < w * h * 2) {
      const currentKey = key(current.x, current.y);
      const candidates = outgoing.get(currentKey);
      if (!candidates?.length) break;
      const next = candidates.pop();
      if (!candidates.length) outgoing.delete(currentKey);
      loop.push(next);
      current = next;
    }

    if (loop.length > 4 && current.x === sx && current.y === sy) loops.push(loop);
  }
  return loops;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const px = start.x + t * dx;
  const py = start.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function rdp(points, tolerance) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let splitIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i], points[0], points.at(-1));
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points.at(-1)];
  const left = rdp(points.slice(0, splitIndex + 1), tolerance);
  const right = rdp(points.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosed(points, tolerance) {
  const ring = points.at(-1).x === points[0].x && points.at(-1).y === points[0].y
    ? points.slice(0, -1)
    : points.slice();
  let anchor = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i].x < ring[anchor].x || (ring[i].x === ring[anchor].x && ring[i].y < ring[anchor].y)) anchor = i;
  }
  const rotated = [...ring.slice(anchor), ...ring.slice(0, anchor)];
  let farthest = 1;
  let farthestDistance = -1;
  for (let i = 1; i < rotated.length; i++) {
    const d = (rotated[i].x - rotated[0].x) ** 2 + (rotated[i].y - rotated[0].y) ** 2;
    if (d > farthestDistance) {
      farthestDistance = d;
      farthest = i;
    }
  }
  const first = rdp(rotated.slice(0, farthest + 1), tolerance);
  const second = rdp([...rotated.slice(farthest), rotated[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
}

const upper = largestComponent(upperSeed, width, height);
const lower = largestComponent(lowerSeed, width, height);

function outerPath(mask) {
  const loops = boundaryLoops(mask, width, height);
  if (!loops.length) throw new Error('No boundary loops found.');
  const outer = loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0];
  return simplifyClosed(outer, simplifyTolerance);
}

const upperPoints = outerPath(upper.mask);
const lowerPoints = outerPath(lower.mask);

const boundsWidth = maxX - minX + 1;
const boundsHeight = maxY - minY + 1;
const scale = 800 / Math.max(boundsWidth, boundsHeight);
const offsetX = (1000 - boundsWidth * scale) / 2 - minX * scale;
const offsetY = (1000 - boundsHeight * scale) / 2 - minY * scale;

const transformPoint = ({x, y}) => ({x: x * scale + offsetX, y: y * scale + offsetY});
const number = value => Number(value.toFixed(2));
const toPath = points => points
  .map(transformPoint)
  .map((point, index) => `${index ? 'L' : 'M'}${number(point.x)} ${number(point.y)}`)
  .join(' ') + ' Z';

const upperPath = toPath(upperPoints);
const lowerPath = toPath(lowerPoints);

function symbolSvg(upperFill, lowerFill, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  <path id="plane-upper" d="${upperPath}" fill="${upperFill}"/>
  <path id="plane-lower" d="${lowerPath}" fill="${lowerFill}"/>
</svg>\n`;
}

function horizontalLockupSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="700" viewBox="0 0 2200 700" role="img" aria-labelledby="title">
  <title id="title">TradingLab horizontal logo</title>
  <g transform="translate(40 40) scale(.62)">
    <path d="${upperPath}" fill="${COLORS.ink}"/>
    <path d="${lowerPath}" fill="${COLORS.ink}"/>
  </g>
  <text x="730" y="420" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="250" font-weight="600" letter-spacing="-9">TradingLab</text>
</svg>\n`;
}

function stackedLockupSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1250" viewBox="0 0 1200 1250" role="img" aria-labelledby="title">
  <title id="title">TradingLab stacked logo</title>
  <g transform="translate(180 40) scale(.84)">
    <path d="${upperPath}" fill="${COLORS.ink}"/>
    <path d="${lowerPath}" fill="${COLORS.ink}"/>
  </g>
  <text x="600" y="1110" text-anchor="middle" fill="${COLORS.ink}" font-family="Poppins, Segoe UI, Arial, sans-serif" font-size="180" font-weight="600" letter-spacing="-7">TradingLab</text>
</svg>\n`;
}

function avatarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="${COLORS.ink}"/>
  <g transform="translate(112 112) scale(.8)">
    <path d="${upperPath}" fill="${COLORS.paper}"/>
    <path d="${lowerPath}" fill="${COLORS.paper}"/>
  </g>
</svg>\n`;
}

await fs.mkdir(output, {recursive: false});
await fs.mkdir(pngDir, {recursive: false});

const assets = {
  'tradinglab-symbol-master.svg': symbolSvg(COLORS.ink, COLORS.ink, 'TradingLab master symbol'),
  'tradinglab-symbol-duotone.svg': symbolSvg(COLORS.ink, COLORS.blue, 'TradingLab duotone symbol'),
  'tradinglab-symbol-inverse.svg': symbolSvg(COLORS.paper, COLORS.paper, 'TradingLab inverse symbol'),
  'tradinglab-symbol-black.svg': symbolSvg('#000000', '#000000', 'TradingLab black symbol'),
  'tradinglab-lockup-horizontal.svg': horizontalLockupSvg(),
  'tradinglab-lockup-stacked.svg': stackedLockupSvg(),
  'tradinglab-avatar-dark.svg': avatarSvg(),
};

for (const [name, content] of Object.entries(assets)) {
  await fs.writeFile(path.join(output, name), content, 'utf8');
}

for (const size of [2048, 1024, 512, 256, 128, 64, 32]) {
  await sharp(Buffer.from(assets['tradinglab-symbol-master.svg']))
    .resize(size, size)
    .png()
    .toFile(path.join(pngDir, `tradinglab-symbol-${size}.png`));
}

await sharp(Buffer.from(assets['tradinglab-symbol-duotone.svg']))
  .resize(1024, 1024)
  .png()
  .toFile(path.join(pngDir, 'tradinglab-symbol-duotone-1024.png'));

await sharp(Buffer.from(assets['tradinglab-symbol-inverse.svg']))
  .resize(1024, 1024)
  .png()
  .toFile(path.join(pngDir, 'tradinglab-symbol-inverse-1024.png'));

await sharp(Buffer.from(assets['tradinglab-lockup-horizontal.svg']))
  .png()
  .toFile(path.join(pngDir, 'tradinglab-lockup-horizontal.png'));

await sharp(Buffer.from(assets['tradinglab-lockup-stacked.svg']))
  .png()
  .toFile(path.join(pngDir, 'tradinglab-lockup-stacked.png'));

await sharp(Buffer.from(assets['tradinglab-avatar-dark.svg']))
  .png()
  .toFile(path.join(pngDir, 'tradinglab-avatar-dark.png'));

const report = {
  source: path.relative(root, input),
  threshold,
  simplifyTolerance,
  sourceDimensions: {width, height},
  sourceBounds: {minX, minY, maxX, maxY},
  componentAreas: {upper: upper.area, lower: lower.area},
  pathPoints: {upper: upperPoints.length, lower: lowerPoints.length},
  normalizedViewBox: '0 0 1000 1000',
  palette: COLORS,
  note: 'The master symbol contains two independently addressable plane paths for motion design.',
};

await fs.writeFile(path.join(output, 'vectorization-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({output, report, assets: Object.keys(assets)}, null, 2));
