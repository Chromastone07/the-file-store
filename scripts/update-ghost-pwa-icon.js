const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// FULL BLEED - NO PRE-CLIPPED CORNERS (Prevents Android from painting white triangles on corners)
const createGhostSvg = (size = 512, isMaskable = false) => {
  // For maskable, safe zone is inner 80%.
  // Scale the inner artwork appropriately
  const scale = isMaskable ? 0.78 : 0.88;
  const cx = size / 2;
  const cy = size / 2;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Deep dark void background matching Phantom's dark mode (#07080f) -->
      <linearGradient id="bgVoid" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0e101a"/>
        <stop offset="50%" stop-color="#080911"/>
        <stop offset="100%" stop-color="#040508"/>
      </linearGradient>

      <!-- Neon Cyan to Violet Cyber Gradient -->
      <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="40%" stop-color="#22d3ee"/>
        <stop offset="75%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>

      <!-- Inner Shadow Gradient -->
      <linearGradient id="hoodInner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f1322"/>
        <stop offset="100%" stop-color="#06070e"/>
      </linearGradient>

      <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="${size * 0.035}" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <radialGradient id="ambientAura" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.25"/>
        <stop offset="50%" stop-color="#6366f1" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#080911" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- FULL BLEED BACKGROUND (0 radius, fills 100% of canvas so Android launcher mask never sees transparent corners) -->
    <rect width="${size}" height="${size}" fill="url(#bgVoid)"/>

    <!-- Subtle Ambient Radial Aura behind ghost -->
    <circle cx="${cx}" cy="${cy}" r="${size * 0.42}" fill="url(#ambientAura)"/>

    <!-- Scaled Ghost Artwork centered in the safe zone -->
    <g transform="translate(${cx}, ${cy}) scale(${scale}) translate(-256, -256)">
      <!-- Outer Geometric Orbital Ring -->
      <circle cx="256" cy="256" r="168" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="8 12" opacity="0.3"/>
      <circle cx="256" cy="256" r="192" fill="none" stroke="#6366f1" stroke-width="1.2" opacity="0.2"/>

      <!-- Glowing Ghost Aura Silhouette -->
      <g filter="url(#neonGlow)">
        <!-- Outer Ethereal Cloak -->
        <path d="M 256 95 C 182 95 132 150 132 245 C 132 325 150 380 172 400 C 190 415 210 385 230 398 C 248 408 256 408 266 398 C 286 385 306 415 326 400 C 348 380 380 325 380 245 C 380 150 330 95 256 95 Z"
              fill="url(#ghostGrad)" fill-opacity="0.15" stroke="url(#ghostGrad)" stroke-width="8" stroke-linejoin="round"/>

        <!-- Stylized Mask Core -->
        <path d="M 178 245 C 178 160 212 130 256 130 C 300 130 334 160 334 245 C 334 315 308 348 256 348 C 204 348 178 315 178 245 Z"
              fill="url(#hoodInner)" stroke="url(#ghostGrad)" stroke-width="5.5" stroke-linejoin="round"/>

        <!-- Glowing Cyber Visor / Slit Eyes -->
        <rect x="206" y="222" width="36" height="12" rx="6" fill="#38bdf8" filter="url(#neonGlow)"/>
        <rect x="270" y="222" width="36" height="12" rx="6" fill="#38bdf8" filter="url(#neonGlow)"/>

        <!-- Quantum Core Dot -->
        <circle cx="256" cy="272" r="4.5" fill="#a855f7" filter="url(#neonGlow)"/>
        <circle cx="256" cy="272" r="2" fill="#ffffff"/>
      </g>
    </g>
  </svg>
  `;
};

async function generateAll() {
  console.log('Generating full-bleed, corner-safe PWA icons...');

  // Standard 512x512
  const svg512 = createGhostSvg(512, false);
  await sharp(Buffer.from(svg512)).png().toFile(path.join(outDir, 'icon-512.png'));
  console.log('✓ icon-512.png (Full bleed, 0 radius)');

  // Standard 192x192
  const svg192 = createGhostSvg(192, false);
  await sharp(Buffer.from(svg192)).png().toFile(path.join(outDir, 'icon-192.png'));
  console.log('✓ icon-192.png (Full bleed, 0 radius)');

  // Maskable 512x512 (Safe-zone centered so Android circle/squircle masks never clip)
  const svgMaskable = createGhostSvg(512, true);
  await sharp(Buffer.from(svgMaskable)).png().toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('✓ icon-maskable-512.png (Full bleed safe-zone)');

  // 180x180 Apple Touch Icon
  const svg180 = createGhostSvg(180, false);
  await sharp(Buffer.from(svg180)).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // Favicons
  const svg32 = createGhostSvg(32, false);
  await sharp(Buffer.from(svg32)).png().toFile(path.join(outDir, 'favicon-32.png'));
  await sharp(Buffer.from(svg32)).png().toFile(path.join(outDir, 'favicon-16.png'));
  await sharp(Buffer.from(createGhostSvg(48, false))).png().toFile(path.join(outDir, 'favicon-48.png'));
  await sharp(Buffer.from(createGhostSvg(48, false))).png().toFile(path.join(__dirname, '..', 'public', 'favicon.png'));
  console.log('✓ Favicons updated');

  // Also update public/logo-options/option2-ghost.png so preview reflects full bleed
  await sharp(Buffer.from(svg512)).png().toFile(path.join(__dirname, '..', 'public', 'logo-options', 'option2-ghost.png'));
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'logo-options', 'option2-ghost.svg'), svg512);

  console.log('All icons generated successfully with 0 white corners!');
}

generateAll().catch(console.error);
