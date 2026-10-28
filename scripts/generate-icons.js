const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Standard SVG for normal icons (full bleed with rounded aesthetic)
const createSvg = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.15 : 0;
  const innerSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0b12"/>
        <stop offset="100%" stop-color="#050508"/>
      </linearGradient>
      <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#818cf8"/>
        <stop offset="50%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#4f46e5"/>
      </linearGradient>
      <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#6366f1"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="${size * 0.03}" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${size}" height="${size}" fill="url(#bgGrad)" rx="${isMaskable ? 0 : size * 0.22}"/>

    <!-- Inner glow backdrop ring -->
    <circle cx="${cx}" cy="${cy}" r="${innerSize * 0.42}" fill="none" stroke="#6366f1" stroke-width="1.5" opacity="0.25"/>

    <!-- Shield Motif -->
    <g transform="translate(${cx}, ${cy}) scale(${innerSize / 100}) translate(-50, -50)">
      <!-- Outer Shield Glow -->
      <path d="M 50 12 L 80 24 C 80 56 68 76 50 88 C 32 76 20 56 20 24 Z"
            fill="none" stroke="url(#shieldGrad)" stroke-width="4.5" stroke-linejoin="round" filter="url(#glow)"/>

      <!-- Inner Shield Core -->
      <path d="M 50 20 L 73 29 C 73 54 63 70 50 80 C 37 70 27 54 27 29 Z"
            fill="#121324" stroke="url(#shieldGrad)" stroke-width="2" opacity="0.95"/>

      <!-- Phantom Ghost / Keyhole Symbol -->
      <path d="M 50 32 C 43 32 38 37 38 44 C 38 49 41 53 45 55 L 44 67 L 56 67 L 55 55 C 59 53 62 49 62 44 C 62 37 57 32 50 32 Z"
            fill="url(#coreGrad)" opacity="0.95"/>

      <!-- Glowing Core Dot -->
      <circle cx="50" cy="44" r="3.5" fill="#ffffff" filter="url(#glow)"/>
    </g>
  </svg>
  `;
};

async function buildIcons() {
  console.log('Generating PWA icons...');

  // 192x192
  await sharp(Buffer.from(createSvg(192, false)))
    .png()
    .toFile(path.join(outDir, 'icon-192.png'));
  console.log('✓ icon-192.png');

  // 512x512
  await sharp(Buffer.from(createSvg(512, false)))
    .png()
    .toFile(path.join(outDir, 'icon-512.png'));
  console.log('✓ icon-512.png');

  // 512x512 Maskable
  await sharp(Buffer.from(createSvg(512, true)))
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('✓ icon-maskable-512.png');

  // 180x180 Apple Touch Icon
  await sharp(Buffer.from(createSvg(180, false)))
    .png()
    .toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // 32x32 Favicon
  await sharp(Buffer.from(createSvg(32, false)))
    .png()
    .toFile(path.join(outDir, 'favicon-32.png'));
  console.log('✓ favicon-32.png');

  console.log('All PWA icons generated successfully!');
}

buildIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
