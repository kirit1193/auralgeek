/**
 * Generate OG image PNG from SVG using Playwright
 * Run with: node scripts/generate-og-image.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function generateOGImage() {
  console.log('Generating OG image from SVG...');

  const svgPath = join(publicDir, 'og-image.svg');
  const pngPath = join(publicDir, 'og-image.png');

  const svgContent = readFileSync(svgPath, 'utf-8');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body { background: #0a0a0a; }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(html);

  await page.screenshot({
    path: pngPath,
    type: 'png',
  });

  await browser.close();

  console.log(`Generated: ${pngPath}`);
}

generateOGImage().catch(console.error);
