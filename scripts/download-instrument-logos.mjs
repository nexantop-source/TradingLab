// Explicit, reviewed image inventory. No runtime third-party image requests.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const sources = JSON.parse(await readFile(new URL('./instrument-logo-sources.json', import.meta.url), 'utf8'));
const output = new URL('../public/assets/instruments/', import.meta.url);
await mkdir(output, { recursive: true });
let failed = false;
await Promise.all(Object.entries(sources).map(async ([file, { url }]) => {
  try {
    if (!/^[a-z0-9-]+\.svg$/.test(file)) throw new Error('Invalid filename');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const svg = await response.text();
    if (!svg.includes('<svg') || svg.length > 250000 || /<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i.test(svg)) throw new Error('Unsafe or unexpected SVG');
    await writeFile(fileURLToPath(new URL(file, output)), svg);
    console.log(`OK ${file} (${Buffer.byteLength(svg)} bytes)`);
  } catch (error) {
    failed = true;
    console.error(`FAILED ${file}: ${error.message}`);
  }
}));
if (failed) process.exitCode = 1;
