import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public/images');

async function optimizeFile(filePath, isHero = false) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

  const baseName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  const meta = await sharp(fileBuffer).metadata();
  const maxWidth = isHero ? 1600 : 800;

  let pipeline = sharp(fileBuffer);
  if (meta.width && meta.width > maxWidth) {
    pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true });
  }

  // 1. Optimized JPEG
  if (ext === '.jpg' || ext === '.jpeg') {
    const jpegBuffer = await pipeline
      .clone()
      .jpeg({ quality: isHero ? 80 : 75, mozjpeg: true })
      .toBuffer();
    fs.writeFileSync(filePath, jpegBuffer);
    console.warn(`[JPEG] ${path.relative(publicDir, filePath)}: ${(jpegBuffer.length / 1024).toFixed(1)} KB`);
  }

  // 2. WebP version
  const webpPath = path.join(dirName, `${baseName}.webp`);
  const webpBuffer = await pipeline
    .clone()
    .webp({ quality: isHero ? 80 : 75 })
    .toBuffer();
  fs.writeFileSync(webpPath, webpBuffer);
  console.warn(`[WebP] ${path.relative(publicDir, webpPath)}: ${(webpBuffer.length / 1024).toFixed(1)} KB`);

  // 3. AVIF version
  const avifPath = path.join(dirName, `${baseName}.avif`);
  const avifBuffer = await pipeline
    .clone()
    .avif({ quality: isHero ? 70 : 65 })
    .toBuffer();
  fs.writeFileSync(avifPath, avifBuffer);
  console.warn(`[AVIF] ${path.relative(publicDir, avifPath)}: ${(avifBuffer.length / 1024).toFixed(1)} KB`);
}

async function processDir(dir, isHeroDir = false) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      await processDir(fullPath, false);
    } else if (item.isFile()) {
      const isHero = isHeroDir && ['reception.jpg', 'petshop.jpg', 'grooming.jpg', 'veterinarian.jpg'].includes(item.name);
      await optimizeFile(fullPath, isHero);
    }
  }
}

async function main() {
  console.warn('Starting image optimization with sharp...');
  await processDir(publicDir, true);
  console.warn('All images optimized successfully!');
}

main().catch(console.error);
