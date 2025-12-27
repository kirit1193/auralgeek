/**
 * Platform Card Renderer
 * Streaming platform normalization display
 */

import { html, TemplateResult } from 'lit';
import type { PlatformNormalization } from '../../core/types.js';

export function renderPlatformCard(platform: PlatformNormalization | null): TemplateResult {
  if (!platform) return html``;

  const gainClass = platform.gainChangeDB > 0 ? "positive" :
                   platform.gainChangeDB < -6 ? "severe" : "negative";
  const hasRisk = platform.riskFlags && platform.riskFlags.length > 0;

  const platformId = platform.platform.toLowerCase().replace(/\s+/g, '');

  return html`
    <div class="platform-card" data-platform="${platformId}">
      <div class="platform-name">${platform.platform}</div>
      <div class="platform-gain ${gainClass}">
        ${platform.gainChangeDB > 0 ? '+' : ''}${platform.gainChangeDB.toFixed(1)} dB
      </div>
      <div class="platform-tp">→ ${platform.projectedTruePeakDBTP.toFixed(1)} dBTP</div>
      ${hasRisk ? html`<div class="platform-risk">⚠</div>` : null}
    </div>
  `;
}
