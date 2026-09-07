const sharp = require('sharp');
const fs = require('fs');

async function process() {
  const meta = await sharp('public/scratch/emblem-crop-2.jpg').metadata();
  const width = meta.width;
  const height = meta.height;

  // Let's create an exact SVG mask for the emblem
  const svgMask = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="black" />
      <g filter="url(#blur)">
        <!-- Crown points -->
        <path d="M 40 120 L 70 8 L 115 70 L 162 5 L 210 70 L 255 35 L 285 120 Z" fill="white" />
        <!-- Crown pearls -->
        <circle cx="70" cy="8" r="16" fill="white" />
        <circle cx="162" cy="5" r="18" fill="white" />
        <circle cx="255" cy="38" r="16" fill="white" />
        <circle cx="36" cy="75" r="12" fill="white" />
        <circle cx="288" cy="85" r="12" fill="white" />

        <!-- Lion body ellipse & lower shield -->
        <ellipse cx="162" cy="248" rx="146" ry="140" fill="white" />
        <polygon points="35,280 162,398 290,280" fill="white" />
        <!-- Ears -->
        <circle cx="65" cy="155" r="40" fill="white" />
        <circle cx="260" cy="175" r="40" fill="white" />
      </g>
    </svg>
  `;

  await sharp('public/scratch/emblem-crop-2.jpg')
    .composite([{ input: Buffer.from(svgMask), blend: 'dest-in' }])
    .png()
    .toFile('public/scratch/emblem-masked.png');

  // Generate 512x512 centered transparent logo
  await sharp('public/scratch/emblem-masked.png')
    .resize(480, 480, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/images/logo.png');

  // Generate 64x64 favicon/small logo
  await sharp('public/images/logo.png')
    .resize(64, 64)
    .png()
    .toFile('public/images/logo-64.png');

  // Save the full cropped signboard image as well
  await sharp('public/images/petboss-sign.jpg')
    .extract({ left: 60, top: 60, width: 915, height: 630 })
    .jpeg({ quality: 95 })
    .toFile('public/images/petboss-signboard.jpg');

  console.log('All logo and signboard assets successfully generated!');
}

process().catch(console.error);
