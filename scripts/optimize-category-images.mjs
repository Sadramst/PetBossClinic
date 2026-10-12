import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const catDir = path.join(process.cwd(), 'public', 'images', 'categories');
const files = fs.readdirSync(catDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));

async function optimizeCategories() {
  console.log(`Optimizing ${files.length} category images in ${catDir}...`);
  for (const file of files) {
    const filePath = path.join(catDir, file);
    const stat = fs.statSync(filePath);
    if (stat.size < 120 * 1024) continue; // Already small

    const buffer = fs.readFileSync(filePath);
    const optimized = await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(filePath, optimized);
    console.log(`✓ ${file}: ${(stat.size/1024).toFixed(0)}KB -> ${(optimized.length/1024).toFixed(0)}KB`);
  }
}

optimizeCategories().catch(console.error);
