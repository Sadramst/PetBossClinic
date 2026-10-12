const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processLogo() {
  const sourcePath = 'C:/Users/sadra/.gemini/antigravity-ide/brain/80d34810-62dd-42b7-a8ae-0a77d49def9c/.user_uploaded/media_1791799790430.png';

  if (!fs.existsSync(sourcePath)) {
    console.error('Source logo does not exist:', sourcePath);
    process.exit(1);
  }

  console.log('Reading official logo from:', sourcePath);
  const metadata = await sharp(sourcePath).metadata();
  console.log('Source metadata:', metadata);

  // 1. Full logo (emblem + PET BOSS text) with transparent background
  // Center it in a clean square or preserve aspect ratio
  await sharp(sourcePath)
    .png()
    .toFile('public/images/logo.png');
  console.log('Created public/images/logo.png');

  await sharp(sourcePath)
    .webp({ quality: 95 })
    .toFile('public/images/logo.webp');
  console.log('Created public/images/logo.webp');

  await sharp(sourcePath)
    .avif({ quality: 90 })
    .toFile('public/images/logo.avif');
  console.log('Created public/images/logo.avif');

  // 2. Square icon 64x64
  await sharp(sourcePath)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/images/logo-64.png');

  await sharp(sourcePath)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 95 })
    .toFile('public/images/logo-64.webp');

  await sharp(sourcePath)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .avif({ quality: 90 })
    .toFile('public/images/logo-64.avif');

  // 3. Favicon / App Icons
  await sharp(sourcePath)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/icon.png');

  await sharp(sourcePath)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/apple-icon.png');

  // 4. Crop the crowned lion emblem (top 0 to 385 px)
  // This is the authentic icon emblem for square avatar / header / brand mark
  const emblemBuffer = await sharp(sourcePath)
    .extract({ left: 0, top: 0, width: 350, height: 385 })
    .toBuffer();

  await sharp(emblemBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/images/logo-emblem.png');
  console.log('Created public/images/logo-emblem.png');

  await sharp(emblemBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 95 })
    .toFile('public/images/logo-emblem.webp');
  console.log('Created public/images/logo-emblem.webp');

  console.log('All official logo assets successfully generated!');
}

processLogo().catch(err => {
  console.error(err);
  process.exit(1);
});
