/**
 * Screenshot all logo SVGs for review
 * Run with: node scripts/screenshot-logos.mjs
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function screenshotSVG(browser, name, width, height) {
  const svgPath = join(publicDir, `${name}.svg`);
  const pngPath = join(publicDir, `${name}.png`);

  const svgContent = readFileSync(svgPath, 'utf-8');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body {
          background: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${width}px;
          height: ${height}px;
        }
        svg {
          width: ${width}px;
          height: ${height}px;
        }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;

  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  await page.screenshot({ path: pngPath, type: 'png' });
  await page.close();

  console.log(`Generated: ${pngPath} (${width}x${height})`);
}

async function generateAppleTouchIcon(browser) {
  const svgPath = join(publicDir, 'logo.svg');
  const pngPath = join(publicDir, 'apple-touch-icon.png');

  const svgContent = readFileSync(svgPath, 'utf-8');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body {
          background: #141414;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 180px;
          height: 180px;
        }
        svg {
          width: 160px;
          height: 160px;
        }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;

  const page = await browser.newPage();
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(html);
  await page.screenshot({ path: pngPath, type: 'png' });
  await page.close();

  console.log(`Generated: ${pngPath} (180x180)`);
}

async function main() {
  console.log('Generating PNG screenshots of logos...\n');

  const browser = await chromium.launch();

  await screenshotSVG(browser, 'favicon', 32, 32);
  await screenshotSVG(browser, 'logo', 200, 200);
  await screenshotSVG(browser, 'og-image', 1200, 630);
  await generateAppleTouchIcon(browser);

  await browser.close();

  console.log('\nDone! Review the PNG files in public/');
}

main().catch(console.error);
