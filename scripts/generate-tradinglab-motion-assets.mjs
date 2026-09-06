#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = 'C:/Users/brame/Desktop/Work/TradingLab';
const outputRoot = path.join(projectRoot, 'motion', '13A-x-promo-2026-08-30');
const assetRoot = path.join(outputRoot, 'assets');
const audioRoot = path.join(assetRoot, 'audio');
const logoRoot = path.join(assetRoot, 'logo');

const COLORS = {
  ink: '#071324',
  blue: '#185ADB',
  paper: '#F7F9FC',
};

await fs.mkdir(audioRoot, {recursive: true});
await fs.mkdir(logoRoot, {recursive: true});
await fs.mkdir(path.join(outputRoot, 'renders'), {recursive: true});
await fs.mkdir(path.join(outputRoot, 'project'), {recursive: true});
await fs.mkdir(path.join(outputRoot, 'qa'), {recursive: true});

function planeSvg(title, pathData, fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-label="${title}">
  <path d="${pathData}" fill="${fill}"/>
</svg>\n`;
}

const upperPath = 'M180 390 C180 360 195 335 220 318 L548 100 C580 79 620 101 620 140 L620 300 C620 324 610 345 590 360 L500 405 L395 500 L240 615 C214 633 180 615 180 583 Z M500 405 L605 500 L617 491 L518 396 Z';
const lowerPath = 'M820 610 C820 640 805 665 780 682 L452 900 C420 921 380 899 380 860 L380 700 C380 676 390 655 410 640 L500 595 L605 500 L760 385 C786 367 820 385 820 417 Z M500 595 L395 500 L383 509 L482 604 Z';

const logoFiles = [
  ['tradinglab-plane-upper.svg', planeSvg('TradingLab 13A upper plane', upperPath, COLORS.ink)],
  ['tradinglab-plane-lower.svg', planeSvg('TradingLab 13A lower plane', lowerPath, COLORS.blue)],
];

for (const [name, markup] of logoFiles) {
  const svgPath = path.join(logoRoot, name);
  await fs.writeFile(svgPath, markup, 'utf8');
  await sharp(Buffer.from(markup), {density: 300})
    .resize(2048, 2048, {fit: 'contain'})
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toFile(path.join(logoRoot, name.replace('.svg', '-2048.png')));
}

await fs.copyFile(
  path.join(projectRoot, 'identidad visual', 'logo-master-13A-final-2026-08-29', 'brand-system', 'png', 'lockups', 'tradinglab-lockup-horizontal-inverse-2500.png'),
  path.join(logoRoot, 'tradinglab-lockup-horizontal-inverse-2500.png'),
);
await fs.copyFile(
  path.join(projectRoot, 'identidad visual', 'logo-master-13A-final-2026-08-29', 'brand-system', 'png', 'lockups', 'tradinglab-lockup-horizontal-2500.png'),
  path.join(logoRoot, 'tradinglab-lockup-horizontal-2500.png'),
);

const sampleRate = 48000;
const channels = 2;
const duration = 18;
const frames = sampleRate * duration;

function seededNoise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff * 2 - 1;
  };
}

function expEnvelope(time, start, length, power = 5) {
  const local = time - start;
  if (local < 0 || local > length) return 0;
  return Math.exp(-power * local / length);
}

function smoothWindow(time, start, length) {
  const local = (time - start) / length;
  if (local <= 0 || local >= 1) return 0;
  return Math.sin(Math.PI * local) ** 2;
}

function makeWave(kind) {
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const noise = seededNoise(kind === 'music' ? 13081 : 73913);
  const hits = [0, 1.8, 3.6, 6.0, 8.4, 10.8, 12.0, 14.4, 16.2];
  const whooshes = [[1.22, 0.62], [3.05, 0.7], [5.55, 0.72], [8.0, 0.72], [10.25, 0.82], [11.35, 0.95], [13.85, 0.9], [15.75, 0.75]];
  const tonal = [[3.6, 330], [3.82, 440], [4.04, 554], [6.0, 392], [6.22, 494], [6.44, 659], [8.4, 440], [8.62, 554], [8.84, 740]];

  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / sampleRate;
    let left = 0;
    let right = 0;

    if (kind === 'music') {
      const fadeIn = Math.min(1, time / 0.8);
      const fadeOut = Math.min(1, (duration - time) / 1.25);
      const master = Math.max(0, Math.min(fadeIn, fadeOut));
      const pad =
        Math.sin(Math.PI * 2 * 55 * time) * 0.035 +
        Math.sin(Math.PI * 2 * 82.4069 * time + 0.4) * 0.024 +
        Math.sin(Math.PI * 2 * 110 * time + 1.2) * 0.014;
      const shimmer = Math.sin(Math.PI * 2 * 220 * time + Math.sin(time * 0.31) * 0.8) * 0.008;
      const beatPosition = time % 0.6;
      const pulse = Math.exp(-beatPosition * 8) * Math.sin(Math.PI * 2 * (62 - beatPosition * 18) * beatPosition) * 0.12;
      const eighthPosition = time % 0.3;
      const tick = Math.exp(-eighthPosition * 36) * Math.sin(Math.PI * 2 * 760 * eighthPosition) * 0.018;
      const air = noise() * 0.005 * (0.55 + Math.sin(time * 0.77) * 0.25);
      left = (pad + shimmer + pulse + tick + air) * master;
      right = (pad * 0.96 + shimmer * 1.12 + pulse + tick * 0.8 - air) * master;
    } else {
      for (const hit of hits) {
        const env = expEnvelope(time, hit, 0.62, 7);
        if (env) {
          const local = time - hit;
          const impact = Math.sin(Math.PI * 2 * (72 - local * 38) * local) * env * 0.34;
          const snap = noise() * expEnvelope(time, hit, 0.085, 9) * 0.12;
          left += impact + snap;
          right += impact - snap * 0.35;
        }
      }
      for (const [start, length] of whooshes) {
        const env = smoothWindow(time, start, length);
        if (env) {
          const local = time - start;
          const sweep = noise() * env * 0.11 + Math.sin(Math.PI * 2 * (180 + local * 520) * local) * env * 0.025;
          left += sweep * (0.7 + 0.3 * Math.sin(local * 5));
          right += sweep * (0.7 - 0.3 * Math.sin(local * 5));
        }
      }
      for (const [start, frequency] of tonal) {
        const env = expEnvelope(time, start, 0.42, 6);
        if (env) {
          const tone = Math.sin(Math.PI * 2 * frequency * (time - start)) * env * 0.12;
          left += tone;
          right += tone * 0.92;
        }
      }
      const logoChord = smoothWindow(time, 11.82, 2.6);
      if (logoChord) {
        const chord = (
          Math.sin(Math.PI * 2 * 130.813 * time) +
          Math.sin(Math.PI * 2 * 195.998 * time) * 0.7 +
          Math.sin(Math.PI * 2 * 261.626 * time) * 0.45
        ) * logoChord * 0.07;
        left += chord;
        right += chord * 0.96;
      }
    }

    left = Math.tanh(left * 1.5) * 0.86;
    right = Math.tanh(right * 1.5) * 0.86;
    const offset = 44 + frame * 4;
    buffer.writeInt16LE(Math.round(left * 32767), offset);
    buffer.writeInt16LE(Math.round(right * 32767), offset + 2);
  }
  return buffer;
}

await fs.writeFile(path.join(audioRoot, 'tradinglab-music-bed-100bpm.wav'), makeWave('music'));
await fs.writeFile(path.join(audioRoot, 'tradinglab-sound-design.wav'), makeWave('sfx'));

const manifest = {
  generatedAt: new Date().toISOString(),
  duration,
  sampleRate,
  colors: COLORS,
  assets: [
    'logo/tradinglab-plane-upper.svg',
    'logo/tradinglab-plane-upper-2048.png',
    'logo/tradinglab-plane-lower.svg',
    'logo/tradinglab-plane-lower-2048.png',
    'logo/tradinglab-lockup-horizontal-inverse-2500.png',
    'logo/tradinglab-lockup-horizontal-2500.png',
    'audio/tradinglab-music-bed-100bpm.wav',
    'audio/tradinglab-sound-design.wav',
  ],
};
await fs.writeFile(path.join(assetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({status: 'ok', outputRoot, ...manifest}, null, 2));
