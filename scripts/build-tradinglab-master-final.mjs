// TradingLab 13A — deterministic Bézier master builder.
//
// The approved raster is sampled only as geometry. Its two color planes are
// isolated, a controlled optical aperture is opened at the center, and the
// resulting contours are fitted with cubic Bézier curves. No bitmap is ever
// embedded in the SVG master.

import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'identidad visual', 'refinamiento-logo-13-2026-08-29', '13A-core.png');
const traceSource = path.join(root, 'identidad visual', 'logo-master-13A-final-2026-08-29', 'source', 'trace-source-duotone-white.png');
const output = path.join(root, 'identidad visual', 'logo-master-13A-final-2026-08-29', 'vector-candidate');

const COLORS = Object.freeze({ink: '#071324', blue: '#185ADB', paper: '#F7F9FC'});
const VIEWBOX = 1000;
const MARK_SIZE = 800;
const CURVE_ERROR = 2.15;
const MIN_LOOP_AREA = 90;

const add = (a, b) => ({x: a.x + b.x, y: a.y + b.y});
const subtract = (a, b) => ({x: a.x - b.x, y: a.y - b.y});
const scalePoint = (point, amount) => ({x: point.x * amount, y: point.y * amount});
const dot = (a, b) => a.x * b.x + a.y * b.y;
const magnitude = point => Math.hypot(point.x, point.y);
const distance = (a, b) => magnitude(subtract(a, b));
const normalize = point => {
  const length = magnitude(point);
  return length > 1e-9 ? scalePoint(point, 1 / length) : {x: 0, y: 0};
};
const negate = point => ({x: -point.x, y: -point.y});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Number(value.toFixed(2));

function hexRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16));
}

function rgbDistanceSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function polygonArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function pointInConvexPolygon(point, polygon) {
  let sign = 0;
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-7) continue;
    const currentSign = Math.sign(cross);
    if (sign && currentSign !== sign) return false;
    sign = currentSign;
  }
  return true;
}

function boundaryLoops(mask, width, height) {
  const outgoing = new Map();
  const key = (x, y) => `${x},${y}`;
  const addEdge = (x1, y1, x2, y2) => {
    const start = key(x1, y1);
    const list = outgoing.get(start) ?? [];
    list.push({x: x2, y: y2});
    outgoing.set(start, list);
  };
  const on = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) addEdge(x, y, x + 1, y);
      if (!on(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!on(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!on(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  }

  const loops = [];
  while (outgoing.size) {
    const [startKey, candidates] = outgoing.entries().next().value;
    const [startX, startY] = startKey.split(',').map(Number);
    const first = candidates.pop();
    if (!candidates.length) outgoing.delete(startKey);
    const loop = [{x: startX, y: startY}, first];
    let current = first;
    let guard = 0;

    while ((current.x !== startX || current.y !== startY) && guard++ < width * height * 2) {
      const currentKey = key(current.x, current.y);
      const nextCandidates = outgoing.get(currentKey);
      if (!nextCandidates?.length) break;
      const next = nextCandidates.pop();
      if (!nextCandidates.length) outgoing.delete(currentKey);
      loop.push(next);
      current = next;
    }

    if (loop.length > 8 && current.x === startX && current.y === startY) {
      loop.pop();
      loops.push(loop);
    }
  }
  return loops;
}

function removeCollinear(points) {
  if (points.length < 4) return points;
  const result = [];
  for (let index = 0; index < points.length; index++) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const first = subtract(current, previous);
    const second = subtract(next, current);
    if (Math.abs(first.x * second.y - first.y * second.x) > 1e-8) result.push(current);
  }
  return result;
}

function smoothClosed(points, radius = 2) {
  const weights = radius === 2 ? [1, 4, 6, 4, 1] : [1, 2, 1];
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  return points.map((_, index) => {
    let x = 0;
    let y = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const point = points[(index + offset + points.length) % points.length];
      const weight = weights[offset + radius];
      x += point.x * weight;
      y += point.y * weight;
    }
    return {x: x / weightTotal, y: y / weightTotal};
  });
}

function resampleClosed(points, spacing = 2.2) {
  const result = [points[0]];
  let previous = points[0];
  let carried = 0;
  for (let index = 1; index <= points.length; index++) {
    const target = points[index % points.length];
    let segmentStart = previous;
    let segmentLength = distance(segmentStart, target);
    while (carried + segmentLength >= spacing && segmentLength > 1e-9) {
      const ratio = (spacing - carried) / segmentLength;
      const next = add(segmentStart, scalePoint(subtract(target, segmentStart), ratio));
      result.push(next);
      segmentStart = next;
      segmentLength = distance(segmentStart, target);
      carried = 0;
    }
    carried += segmentLength;
    previous = target;
  }
  if (result.length > 1 && distance(result[0], result.at(-1)) < spacing * 0.35) result.pop();
  return result;
}

function bezierPoint(curve, t) {
  const mt = 1 - t;
  const b0 = mt ** 3;
  const b1 = 3 * t * mt ** 2;
  const b2 = 3 * t ** 2 * mt;
  const b3 = t ** 3;
  return {
    x: curve[0].x * b0 + curve[1].x * b1 + curve[2].x * b2 + curve[3].x * b3,
    y: curve[0].y * b0 + curve[1].y * b1 + curve[2].y * b2 + curve[3].y * b3,
  };
}

function bezierDerivative(curve, t) {
  const mt = 1 - t;
  return add(
    add(scalePoint(subtract(curve[1], curve[0]), 3 * mt ** 2), scalePoint(subtract(curve[2], curve[1]), 6 * mt * t)),
    scalePoint(subtract(curve[3], curve[2]), 3 * t ** 2),
  );
}

function bezierSecondDerivative(curve, t) {
  return add(
    scalePoint(add(subtract(curve[2], scalePoint(curve[1], 2)), curve[0]), 6 * (1 - t)),
    scalePoint(add(subtract(curve[3], scalePoint(curve[2], 2)), curve[1]), 6 * t),
  );
}

function chordLengthParameterize(points) {
  const parameters = [0];
  for (let index = 1; index < points.length; index++) {
    parameters.push(parameters.at(-1) + distance(points[index], points[index - 1]));
  }
  const total = parameters.at(-1) || 1;
  return parameters.map(value => value / total);
}

function generateBezier(points, parameters, leftTangent, rightTangent) {
  const start = points[0];
  const end = points.at(-1);
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;

  for (let index = 0; index < points.length; index++) {
    const u = parameters[index];
    const mt = 1 - u;
    const b0 = mt ** 3;
    const b1 = 3 * u * mt ** 2;
    const b2 = 3 * u ** 2 * mt;
    const b3 = u ** 3;
    const a0 = scalePoint(leftTangent, b1);
    const a1 = scalePoint(rightTangent, b2);
    const base = add(scalePoint(start, b0 + b1), scalePoint(end, b2 + b3));
    const residual = subtract(points[index], base);
    c00 += dot(a0, a0);
    c01 += dot(a0, a1);
    c11 += dot(a1, a1);
    x0 += dot(a0, residual);
    x1 += dot(a1, residual);
  }

  const determinant = c00 * c11 - c01 * c01;
  let alphaLeft = Math.abs(determinant) > 1e-12 ? (x0 * c11 - x1 * c01) / determinant : 0;
  let alphaRight = Math.abs(determinant) > 1e-12 ? (c00 * x1 - c01 * x0) / determinant : 0;
  const segmentLength = distance(start, end);
  const epsilon = 1e-6 * Math.max(1, segmentLength);
  if (!Number.isFinite(alphaLeft) || !Number.isFinite(alphaRight) || alphaLeft < epsilon || alphaRight < epsilon) {
    alphaLeft = segmentLength / 3;
    alphaRight = segmentLength / 3;
  }
  const maximumHandle = Math.max(segmentLength / 3, segmentLength * 1.35);
  alphaLeft = Math.min(alphaLeft, maximumHandle);
  alphaRight = Math.min(alphaRight, maximumHandle);

  // A fitted handle must not escape the local contour envelope. This matters
  // most at the two narrow evidence folds, where unconstrained least-squares
  // handles can create a tiny loop even while the sampled error stays low.
  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  const envelope = 0.35;
  const constrain = point => ({
    x: clamp(point.x, minX - envelope, maxX + envelope),
    y: clamp(point.y, minY - envelope, maxY + envelope),
  });
  return [
    start,
    constrain(add(start, scalePoint(leftTangent, alphaLeft))),
    constrain(add(end, scalePoint(rightTangent, alphaRight))),
    end,
  ];
}

function computeMaxError(points, curve, parameters) {
  let split = Math.floor(points.length / 2);
  let maximum = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const delta = subtract(bezierPoint(curve, parameters[index]), points[index]);
    const error = dot(delta, delta);
    if (error >= maximum) {
      maximum = error;
      split = index;
    }
  }
  return {maximum, split};
}

function newtonRaphsonRootFind(curve, point, parameter) {
  const position = bezierPoint(curve, parameter);
  const first = bezierDerivative(curve, parameter);
  const second = bezierSecondDerivative(curve, parameter);
  const delta = subtract(position, point);
  const numerator = dot(delta, first);
  const denominator = dot(first, first) + dot(delta, second);
  return Math.abs(denominator) < 1e-12 ? parameter : parameter - numerator / denominator;
}

function reparameterize(points, parameters, curve) {
  return parameters.map((parameter, index) => clamp(newtonRaphsonRootFind(curve, points[index], parameter), 0, 1));
}

function fitCubic(points, leftTangent, rightTangent, error, curves) {
  if (points.length === 2) {
    const handle = distance(points[0], points[1]) / 3;
    curves.push([
      points[0],
      add(points[0], scalePoint(leftTangent, handle)),
      add(points[1], scalePoint(rightTangent, handle)),
      points[1],
    ]);
    return;
  }

  let parameters = chordLengthParameterize(points);
  let curve = generateBezier(points, parameters, leftTangent, rightTangent);
  let fit = computeMaxError(points, curve, parameters);
  const squaredError = error ** 2;
  if (fit.maximum <= squaredError) {
    curves.push(curve);
    return;
  }

  if (fit.maximum <= squaredError * 6) {
    for (let iteration = 0; iteration < 5; iteration++) {
      parameters = reparameterize(points, parameters, curve);
      curve = generateBezier(points, parameters, leftTangent, rightTangent);
      fit = computeMaxError(points, curve, parameters);
      if (fit.maximum <= squaredError) {
        curves.push(curve);
        return;
      }
    }
  }

  const split = clamp(fit.split, 1, points.length - 2);
  let centerTangent = normalize(subtract(points[split - 1], points[split + 1]));
  if (magnitude(centerTangent) < 1e-9) centerTangent = normalize(subtract(points[split], points[split + 1]));
  fitCubic(points.slice(0, split + 1), leftTangent, centerTangent, error, curves);
  fitCubic(points.slice(split), negate(centerTangent), rightTangent, error, curves);
}

function fitOpenCurve(points, error) {
  if (points.length < 2) return [];
  const curves = [];
  const leftTangent = normalize(subtract(points[1], points[0]));
  const rightTangent = normalize(subtract(points.at(-2), points.at(-1)));
  fitCubic(points, leftTangent, rightTangent, error, curves);
  return curves;
}

function fitClosedCurve(points, error) {
  if (points.length < 4) return [];
  let farthest = 1;
  let maximum = -1;
  for (let index = 1; index < points.length; index++) {
    const current = distance(points[0], points[index]);
    if (current > maximum) {
      maximum = current;
      farthest = index;
    }
  }
  const firstHalf = points.slice(0, farthest + 1);
  const secondHalf = [...points.slice(farthest), points[0]];
  return [...fitOpenCurve(firstHalf, error), ...fitOpenCurve(secondHalf, error)];
}

function curvesToPath(curves) {
  if (!curves.length) return '';
  const start = curves[0][0];
  const commands = [`M${round(start.x)} ${round(start.y)}`];
  for (const curve of curves) {
    commands.push(`C${round(curve[1].x)} ${round(curve[1].y)} ${round(curve[2].x)} ${round(curve[2].y)} ${round(curve[3].x)} ${round(curve[3].y)}`);
  }
  commands.push('Z');
  return commands.join(' ');
}

function makeSvg(upperPath, lowerPath, monochrome = false) {
  const lowerColor = monochrome ? COLORS.ink : COLORS.blue;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-labelledby="title desc">
  <title id="title">TradingLab 13A ${monochrome ? 'monochrome' : 'duotone'} symbol</title>
  <desc id="desc">Two interlocking evidence planes forming a controlled central aperture.</desc>
  <path id="plane-upper" d="${upperPath}" fill="${COLORS.ink}"/>
  <path id="plane-lower" d="${lowerPath}" fill="${lowerColor}"/>
</svg>\n`;
}

function calculateBounds(alpha, width, height, threshold = 128) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('No opaque source pixels found.');
  return {minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1};
}

function alphaPlane(raw, channels) {
  const alpha = new Uint8Array(raw.length / channels);
  for (let index = 0; index < alpha.length; index++) alpha[index] = raw[index * channels + 3];
  return alpha;
}

async function normalizedSourceBuffer(bounds) {
  const sourceScale = MARK_SIZE / Math.max(bounds.width, bounds.height);
  const renderedWidth = Math.max(1, Math.round(bounds.width * sourceScale));
  const renderedHeight = Math.max(1, Math.round(bounds.height * sourceScale));
  const left = Math.floor((VIEWBOX - renderedWidth) / 2);
  const top = Math.floor((VIEWBOX - renderedHeight) / 2);
  return sharp(source)
    .extract({left: bounds.minX, top: bounds.minY, width: bounds.width, height: bounds.height})
    .resize(renderedWidth, renderedHeight, {fit: 'fill'})
    .extend({left, right: VIEWBOX - renderedWidth - left, top, bottom: VIEWBOX - renderedHeight - top, background: {r: 0, g: 0, b: 0, alpha: 0}})
    .ensureAlpha()
    .png()
    .toBuffer();
}

function silhouetteMetrics(referenceRaw, candidateRaw, width, height) {
  let intersection = 0;
  let union = 0;
  let referenceArea = 0;
  let candidateArea = 0;
  let referenceCenterNegative = 0;
  let candidateCenterNegative = 0;
  let centerPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4 + 3;
      const reference = referenceRaw[index] >= 128;
      const candidate = candidateRaw[index] >= 128;
      if (reference) referenceArea++;
      if (candidate) candidateArea++;
      if (reference && candidate) intersection++;
      if (reference || candidate) union++;
      if (x >= 360 && x < 640 && y >= 360 && y < 640) {
        centerPixels++;
        if (!reference) referenceCenterNegative++;
        if (!candidate) candidateCenterNegative++;
      }
    }
  }
  return {
    silhouetteIou: round(intersection / union),
    sourceOpaquePixels: referenceArea,
    candidateOpaquePixels: candidateArea,
    centralNegativePixelsSource: referenceCenterNegative,
    centralNegativePixelsCandidate: candidateCenterNegative,
    centralNegativeAreaGainPercent: round((candidateCenterNegative / referenceCenterNegative - 1) * 100),
    centerSamplePixels: centerPixels,
  };
}

async function reductionSheet(svg) {
  const width = 1600;
  const height = 640;
  const tiles = [384, 192, 96, 48, 24];
  const xPositions = [80, 570, 860, 1080, 1245];
  const composites = [];
  for (let index = 0; index < tiles.length; index++) {
    const size = tiles[index];
    const icon = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    composites.push({input: icon, left: xPositions[index], top: Math.round((height - size) / 2)});
  }
  return sharp({create: {width, height, channels: 4, background: COLORS.paper}})
    .composite(composites)
    .png()
    .toBuffer();
}

await fs.mkdir(output, {recursive: true});

const {data: sourceRaw, info: sourceInfo} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject: true});
const sourceAlpha = alphaPlane(sourceRaw, sourceInfo.channels);
const sourceBounds = calculateBounds(sourceAlpha, sourceInfo.width, sourceInfo.height);
const geometryScale = MARK_SIZE / Math.max(sourceBounds.width, sourceBounds.height);
const geometryOffsetX = (VIEWBOX - sourceBounds.width * geometryScale) / 2 - sourceBounds.minX * geometryScale;
const geometryOffsetY = (VIEWBOX - sourceBounds.height * geometryScale) / 2 - sourceBounds.minY * geometryScale;
const toViewBox = point => ({x: point.x * geometryScale + geometryOffsetX, y: point.y * geometryScale + geometryOffsetY});

const {data: traceRaw, info: traceInfo} = await sharp(traceSource).removeAlpha().raw().toBuffer({resolveWithObject: true});
if (traceInfo.width !== sourceInfo.width || traceInfo.height !== sourceInfo.height) throw new Error('Trace source dimensions do not match the approved raster.');

const inkRgb = hexRgb(COLORS.ink);
const blueRgb = hexRgb(COLORS.blue);
const whiteRgb = [255, 255, 255];
const upperMask = new Uint8Array(traceInfo.width * traceInfo.height);
const lowerMask = new Uint8Array(traceInfo.width * traceInfo.height);

// Measured negative-space diamond, expanded 5.5% around its optical center.
// The expansion is deliberately small (roughly 4–5 viewBox units per edge):
// enough to survive 24 px without changing the selected 13A silhouette.
const originalAperture = [
  {x: 491.2, y: 422.5},
  {x: 580.1, y: 508.5},
  {x: 480.9, y: 590.0},
  {x: 390.5, y: 503.7},
];
const apertureCenter = originalAperture.reduce((sum, point) => add(sum, point), {x: 0, y: 0});
apertureCenter.x /= originalAperture.length;
apertureCenter.y /= originalAperture.length;
const apertureExpansion = 1.055;
const opticalAperture = originalAperture.map(point => add(apertureCenter, scalePoint(subtract(point, apertureCenter), apertureExpansion)));
const foldKeepOutRadius = 18;

for (let y = 0; y < traceInfo.height; y++) {
  for (let x = 0; x < traceInfo.width; x++) {
    const pixelIndex = y * traceInfo.width + x;
    const rawIndex = pixelIndex * traceInfo.channels;
    const rgb = [traceRaw[rawIndex], traceRaw[rawIndex + 1], traceRaw[rawIndex + 2]];
    const inkDistance = rgbDistanceSq(rgb, inkRgb);
    const blueDistance = rgbDistanceSq(rgb, blueRgb);
    const whiteDistance = rgbDistanceSq(rgb, whiteRgb);
    const normalized = toViewBox({x: x + 0.5, y: y + 0.5});
    const insideExpandedAperture = pointInConvexPolygon(normalized, opticalAperture);
    const insideOriginalAperture = pointInConvexPolygon(normalized, originalAperture);
    const nearestFoldCorner = Math.min(...originalAperture.map(point => distance(point, normalized)));
    // Cut only the newly added edge band. The four fold tips have a keep-out
    // radius so their intentional tapered overlap remains connected and crisp.
    if (insideExpandedAperture && !insideOriginalAperture && nearestFoldCorner > foldKeepOutRadius) continue;
    if (inkDistance < whiteDistance && inkDistance <= blueDistance) upperMask[pixelIndex] = 1;
    if (blueDistance < whiteDistance && blueDistance < inkDistance) lowerMask[pixelIndex] = 1;
  }
}

function vectorizeMask(mask, name) {
  const sourceLoops = boundaryLoops(mask, traceInfo.width, traceInfo.height)
    .filter(loop => Math.abs(polygonArea(loop)) >= MIN_LOOP_AREA)
    .sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  if (!sourceLoops.length) throw new Error(`No usable ${name} contour found.`);

  const fitted = sourceLoops.map(loop => {
    const normalized = loop.map(toViewBox);
    const smoothed = smoothClosed(normalized, 2);
    const sampled = resampleClosed(smoothed, 2.2);
    const simplified = removeCollinear(sampled);
    const curves = fitClosedCurve(simplified, CURVE_ERROR);
    return {curves, sourcePoints: loop.length, fittedPoints: simplified.length, area: Math.abs(polygonArea(loop))};
  });
  return {
    path: fitted.map(item => curvesToPath(item.curves)).join(' '),
    loops: fitted.length,
    sourcePoints: fitted.reduce((sum, item) => sum + item.sourcePoints, 0),
    fittedInputPoints: fitted.reduce((sum, item) => sum + item.fittedPoints, 0),
    curves: fitted.reduce((sum, item) => sum + item.curves.length, 0),
    sourceAreaPixels: round(fitted.reduce((sum, item) => sum + item.area, 0)),
  };
}

const upper = vectorizeMask(upperMask, 'upper-plane');
const lower = vectorizeMask(lowerMask, 'lower-plane');
const duotoneSvg = makeSvg(upper.path, lower.path, false);
const monochromeSvg = makeSvg(upper.path, lower.path, true);

const forbiddenSvgFeatures = /<(?:image|filter|mask|clipPath|pattern|linearGradient|radialGradient|polygon|polyline|text)\b/i;
const pathCount = (duotoneSvg.match(/<path\b/g) ?? []).length;
const cubicCount = (duotoneSvg.match(/\bC-?\d/g) ?? []).length;
if (forbiddenSvgFeatures.test(duotoneSvg)) throw new Error('SVG purity check failed: forbidden feature found.');
if (pathCount !== 2) throw new Error(`SVG purity check failed: expected 2 paths, found ${pathCount}.`);
if (cubicCount !== upper.curves + lower.curves) throw new Error('SVG curve count does not match fitted geometry.');
if (/<image\b|(?:href|xlink:href)=/i.test(duotoneSvg)) throw new Error('SVG contains an embedded or linked image.');

const duotonePath = path.join(output, 'tradinglab-13A-duotone.svg');
const monochromePath = path.join(output, 'tradinglab-13A-monochrome.svg');
const previewPath = path.join(output, 'tradinglab-13A-preview-2048.png');
const reductionPath = path.join(output, 'tradinglab-13A-reduction-sheet.png');
const reportPath = path.join(output, 'vectorization-report.json');

await fs.writeFile(duotonePath, duotoneSvg, 'utf8');
await fs.writeFile(monochromePath, monochromeSvg, 'utf8');
await sharp(Buffer.from(duotoneSvg)).resize(2048, 2048).png().toFile(previewPath);
await fs.writeFile(reductionPath, await reductionSheet(duotoneSvg));

const referenceBuffer = await normalizedSourceBuffer(sourceBounds);
const referenceRaw = await sharp(referenceBuffer).ensureAlpha().raw().toBuffer();
const candidateRaw = await sharp(Buffer.from(duotoneSvg)).resize(VIEWBOX, VIEWBOX).ensureAlpha().raw().toBuffer();
const comparison = silhouetteMetrics(referenceRaw, candidateRaw, VIEWBOX, VIEWBOX);

const report = {
  source: path.relative(root, source),
  traceSource: path.relative(root, traceSource),
  method: 'binary color-plane isolation + measured optical aperture + closed cubic Bezier least-squares fitting',
  palette: COLORS,
  viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
  sourceDimensions: {width: sourceInfo.width, height: sourceInfo.height},
  sourceBounds,
  curveFitMaximumErrorViewBoxUnits: CURVE_ERROR,
  opticalAperture: {
    center: {x: round(apertureCenter.x), y: round(apertureCenter.y)},
    radialExpansionPercent: round((apertureExpansion - 1) * 100),
    foldKeepOutRadiusViewBoxUnits: foldKeepOutRadius,
    originalVertices: originalAperture,
    adjustedVertices: opticalAperture.map(point => ({x: round(point.x), y: round(point.y)})),
  },
  geometry: {upper, lower, totalCurves: upper.curves + lower.curves, totalAnchorNodes: upper.curves + lower.curves},
  comparison,
  validation: {
    pureVector: true,
    pathCount,
    cubicBezierCount: cubicCount,
    embeddedImages: 0,
    filters: 0,
    masks: 0,
    linkedResources: 0,
    reductionSizesTested: [384, 192, 96, 48, 24],
  },
};

await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

// Remove the temporary crop that was used only for geometry inspection.
await fs.rm(path.join(output, 'source-center-inspection.png'), {force: true});

console.log(JSON.stringify({output, files: [duotonePath, monochromePath, previewPath, reductionPath, reportPath], report}, null, 2));
