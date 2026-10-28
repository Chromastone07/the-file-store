const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Usage: node scripts/apply-pwa-logo.js [1|2|3|4]
const optionArg = process.argv[2] || '1';
const map = {
  '1': 'option1-aegis',
  '2': 'option2-ghost',
  '3': 'option3-vault',
  '4': 'option4-hex',
};

const choiceName = map[optionArg] || map['1'];
const svgPath = path.join(__dirname, '..', 'public', 'logo-options', `${choiceName}.svg`);
const outDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(svgPath)) {
  console.error(`Error: File not found: ${svgPath}`);
  process.exit(1);
}

const svgContent = fs.readFileSync(svgPath, 'utf8');

async function apply() {
  console.log(`Applying logo option: ${choiceName}...`);

  // 192x192
  await sharp(Buffer.from(svgContent)).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
  console.log('✓ Updated icon-192.png');

  // 512x512
  await sharp(Buffer.from(svgContent)).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));
  console.log('✓ Updated icon-512.png');

  // Maskable 512x512 (with safe-margin padding)
  await sharp(Buffer.from(svgContent))
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#07070f'
    })
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('✓ Updated icon-maskable-512.png');

  // 180x180 Apple Touch Icon
  await sharp(Buffer.from(svgContent)).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('✓ Updated apple-touch-icon.png');

  // 32x32 Favicon
  await sharp(Buffer.from(svgContent)).resize(32, 32).png().toFile(path.join(outDir, 'favicon-32.png'));
  console.log('✓ Updated favicon-32.png');

  console.log(`Successfully switched PWA logo to ${choiceName}!`);
}

apply().catch(console.error);
