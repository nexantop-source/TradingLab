import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('editorial marketing assets', () => {
  const scenes = ['horizon', 'possibilities', 'learning'];
  it.each(scenes)('%s is a compact, locally bundled WebP', scene => {
    const bytes = readFileSync(path.resolve('public/assets/visuals', `${scene}-v1.webp`));
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.length).toBeLessThan(150_000);
  });
  it('keeps the combined original image budget under 150 KiB', () => {
    const total = scenes.reduce((sum, scene) => sum + readFileSync(path.resolve('public/assets/visuals', `${scene}-v1.webp`)).length, 0);
    expect(total).toBeLessThan(150 * 1024);
  });
});
