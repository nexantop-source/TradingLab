import sharp from 'sharp';
import path from 'node:path';

// Format/size optimization only; the original generated composition is preserved.
const [source, name] = process.argv.slice(2);
if (!source || !['horizon', 'possibilities', 'learning'].includes(name)) {
  throw new Error('Usage: node scripts/prepare-visual-asset.mjs <source.png> <horizon|possibilities|learning>');
}
const destination = path.resolve('public/assets/visuals', `${name}-v1.webp`);
const result = await sharp(source)
  .resize({ width: name === 'learning' ? 1200 : 1680, withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(destination);
console.log({ destination, width: result.width, height: result.height, bytes: result.size });
