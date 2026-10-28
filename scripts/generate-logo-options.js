const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(__dirname, '..', 'public', 'logo-options');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Option 1: The Phantom Aegis (Cyber Shield + Quantum Pulse)
const svgOption1 = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e101d"/>
      <stop offset="100%" stop-color="#05060a"/>
    </linearGradient>
    <linearGradient id="shieldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="accentGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <filter id="glow1" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- App Icon Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bg1)"/>
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.25"/>

  <!-- Orbital Rings -->
  <circle cx="256" cy="256" r="180" fill="none" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="12 16" opacity="0.3"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#38bdf8" stroke-width="1" opacity="0.2"/>

  <!-- Cyber Shield Facets -->
  <g filter="url(#glow1)">
    <!-- Outer Shield Stroke -->
    <path d="M 256 80 L 396 140 C 396 280 340 376 256 432 C 172 376 116 280 116 140 Z"
          fill="#131525" stroke="url(#shieldGrad1)" stroke-width="12" stroke-linejoin="round"/>

    <!-- Inner Core Plate -->
    <path d="M 256 125 L 360 170 C 360 270 318 348 256 392 C 194 348 152 270 152 170 Z"
          fill="url(#bg1)" stroke="url(#accentGrad1)" stroke-width="4" opacity="0.9"/>

    <!-- Quantum Pulse Core -->
    <polygon points="256,180 300,256 256,332 212,256" fill="url(#shieldGrad1)" opacity="0.85"/>
    <circle cx="256" cy="256" r="22" fill="#ffffff" filter="url(#glow1)"/>
    <circle cx="256" cy="256" r="10" fill="#38bdf8"/>
  </g>
</svg>
`;

// Option 2: The Cloaked Ghost (Minimalist Cyber Wraith)
const svgOption2 = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a14"/>
      <stop offset="100%" stop-color="#030306"/>
    </linearGradient>
    <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <filter id="glow2" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- App Icon Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bg2)"/>
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#06b6d4" stroke-width="2" opacity="0.3"/>

  <!-- Halo Ring -->
  <ellipse cx="256" cy="256" rx="160" ry="160" fill="none" stroke="#06b6d4" stroke-width="1.5" opacity="0.25"/>

  <!-- Ghost Hood Form -->
  <g filter="url(#glow2)">
    <!-- Main Floating Silhouette -->
    <path d="M 256 100 C 180 100 130 160 130 250 C 130 330 148 390 170 410 C 190 425 210 395 230 405 C 248 415 256 415 266 405 C 286 395 306 425 326 410 C 348 390 382 330 382 250 C 382 160 332 100 256 100 Z"
          fill="url(#ghostGrad)" opacity="0.18" stroke="url(#ghostGrad)" stroke-width="10" stroke-linejoin="round"/>

    <!-- Stylized Hood Arc -->
    <path d="M 175 250 C 175 160 210 135 256 135 C 302 135 337 160 337 250 C 337 320 310 350 256 350 C 202 350 175 320 175 250 Z"
          fill="#0c101c" stroke="url(#ghostGrad)" stroke-width="6"/>

    <!-- Glowing Cyber Visor / Slit Eyes -->
    <rect x="206" y="225" width="34" height="12" rx="6" fill="#22d3ee" filter="url(#glow2)"/>
    <rect x="272" y="225" width="34" height="12" rx="6" fill="#22d3ee" filter="url(#glow2)"/>
    <circle cx="256" cy="275" r="4" fill="#6366f1"/>
  </g>
</svg>
`;

// Option 3: The Zero-Knowledge Vault (Interlocking Cryptographic Rings)
const svgOption3 = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080f14"/>
      <stop offset="100%" stop-color="#03070a"/>
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="cyanGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <filter id="glow3" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="15" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- App Icon Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bg3)"/>
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#10b981" stroke-width="2" opacity="0.3"/>

  <!-- Rotating Radar Arc -->
  <circle cx="256" cy="256" r="170" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="10 20" opacity="0.3"/>

  <g filter="url(#glow3)">
    <!-- Left Interlocking Key Ring -->
    <circle cx="205" cy="256" r="85" fill="none" stroke="url(#emeraldGrad)" stroke-width="18"/>

    <!-- Right Interlocking Key Ring -->
    <circle cx="307" cy="256" r="85" fill="none" stroke="url(#cyanGrad3)" stroke-width="18"/>

    <!-- Intersecting Lock Keyhole -->
    <path d="M 256 210 C 242 210 230 222 230 236 C 230 248 236 257 245 261 L 240 290 L 272 290 L 267 261 C 276 257 282 248 282 236 C 282 222 270 210 256 210 Z"
          fill="#ffffff" filter="url(#glow3)"/>
  </g>
</svg>
`;

// Option 4: The Hex Monolith 'P' (Futuristic Isometric Ribbon)
const svgOption4 = (size = 512) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d0e18"/>
      <stop offset="100%" stop-color="#040407"/>
    </linearGradient>
    <linearGradient id="pGradA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <linearGradient id="pGradB" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <filter id="glow4" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- App Icon Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bg4)"/>
  <rect width="508" height="508" x="2" y="2" rx="113" fill="none" stroke="#a855f7" stroke-width="2" opacity="0.3"/>

  <!-- Outer Isometric Hexagon -->
  <polygon points="256,76 396,156 396,316 256,396 116,316 116,156"
           fill="none" stroke="#6366f1" stroke-width="3" stroke-dasharray="8 8" opacity="0.35"/>

  <!-- Bold Neon 'P' Monogram Construction -->
  <g filter="url(#glow4)">
    <!-- Vertical Backbone -->
    <rect x="175" y="140" width="36" height="232" rx="18" fill="url(#pGradB)"/>

    <!-- Upper Loop of P -->
    <path d="M 193 140 L 290 140 C 345 140 375 168 375 210 C 375 252 345 280 290 280 L 193 280"
          fill="none" stroke="url(#pGradA)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Central Glowing Core Spot -->
    <circle cx="282" cy="210" r="16" fill="#ffffff" filter="url(#glow4)"/>
  </g>
</svg>
`;

async function generateAll() {
  console.log('Rendering 4 PWA Logo Options...');

  // Option 1
  fs.writeFileSync(path.join(outDir, 'option1-aegis.svg'), svgOption1(512));
  await sharp(Buffer.from(svgOption1(512))).png().toFile(path.join(outDir, 'option1-aegis.png'));
  console.log('✓ Option 1: The Phantom Aegis generated');

  // Option 2
  fs.writeFileSync(path.join(outDir, 'option2-ghost.svg'), svgOption2(512));
  await sharp(Buffer.from(svgOption2(512))).png().toFile(path.join(outDir, 'option2-ghost.png'));
  console.log('✓ Option 2: The Cloaked Ghost generated');

  // Option 3
  fs.writeFileSync(path.join(outDir, 'option3-vault.svg'), svgOption3(512));
  await sharp(Buffer.from(svgOption3(512))).png().toFile(path.join(outDir, 'option3-vault.png'));
  console.log('✓ Option 3: The Zero-Knowledge Vault generated');

  // Option 4
  fs.writeFileSync(path.join(outDir, 'option4-hex.svg'), svgOption4(512));
  await sharp(Buffer.from(svgOption4(512))).png().toFile(path.join(outDir, 'option4-hex.png'));
  console.log('✓ Option 4: The Hex Monolith P generated');

  console.log('All 4 logo options successfully rendered to /public/logo-options/');
}

generateAll().catch(console.error);
