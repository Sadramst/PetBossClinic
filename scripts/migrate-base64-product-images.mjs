import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const db = new PrismaClient();

async function main() {
  console.log('--- MIGRATING BASE64 PRODUCT IMAGES & SITE MEDIA ---');

  // 1. Migrate Product Images
  const b64ProductImages = await db.productImage.findMany({
    where: { imageId: { startsWith: 'data:' } },
    include: { product: true },
  });

  console.log(`Found ${b64ProductImages.length} base64 product images.`);

  const productsDir = path.join(process.cwd(), 'public', 'images', 'products');
  if (!fs.existsSync(productsDir)) {
    fs.mkdirSync(productsDir, { recursive: true });
  }

  for (const img of b64ProductImages) {
    const match = img.imageId.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;
    const base64Content = match[2];
    const rawBuffer = Buffer.from(base64Content, 'base64');

    // Create safe slug/filename
    const baseName = (img.product.sku || img.product.slugFa || img.product.id)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    const fileName = `${baseName}-${img.id.slice(-6)}.webp`;
    const targetPath = path.join(productsDir, fileName);

    // Optimize with sharp
    const optimizedBuffer = await sharp(rawBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();

    fs.writeFileSync(targetPath, optimizedBuffer);
    const newUrl = `/images/products/${fileName}`;

    await db.productImage.update({
      where: { id: img.id },
      data: { imageId: newUrl },
    });

    console.log(`✓ Converted ${img.product.nameFa.slice(0, 30)} (${(img.imageId.length/1024).toFixed(0)}KB b64 -> ${(optimizedBuffer.length/1024).toFixed(1)}KB webp) => ${newUrl}`);
  }

  // 2. Fix site_logo in db.media
  const siteLogo = await db.media.findUnique({ where: { key: 'site_logo' } });
  if (siteLogo && siteLogo.url.startsWith('data:')) {
    await db.media.update({
      where: { key: 'site_logo' },
      data: { url: '/images/logo.png' },
    });
    console.log('✓ Updated db.media site_logo from base64 to /images/logo.png');
  }

  // 3. Check any other base64 media
  const allMedia = await db.media.findMany({ where: { url: { startsWith: 'data:' } } });
  for (const m of allMedia) {
    if (m.key.startsWith('upload_')) {
      const match = m.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const rawBuffer = Buffer.from(match[2], 'base64');
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const fileName = `${m.key}.webp`;
        const targetPath = path.join(uploadDir, fileName);
        await sharp(rawBuffer).webp({ quality: 80 }).toFile(targetPath);
        await db.media.update({
          where: { id: m.id },
          data: { url: `/uploads/${fileName}` },
        });
        console.log(`✓ Converted media ${m.key} to /uploads/${fileName}`);
      }
    }
  }

  console.log('--- ALL BASE64 ASSETS MIGRATED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
