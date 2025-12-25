/**
 * Metric Rendering Components
 * Meters, metric rows, and info buttons
 */

import { html, TemplateResult } from 'lit';
import { clamp } from '../helpers/index.js';

export function renderInfoBtn(text: string): TemplateResult {
  return html`<span class="info-wrap"><button class="info-btn" tabindex="0">?</button><span class="info-tooltip">${text}</span></span>`;
}

export function renderMeter(
  label: string,
  tooltip: string,
  value: number | null,
  unit: string,
  meterType: "loudness" | "peak" | "dynamics" | "width" | "artifact",
  valueToPos: (v: number) => number,
  rangeLabels: string[]
): TemplateResult {
  const displayValue = value !== null ? value.toFixed(1) : "—";
  const pos = value !== null ? clamp(valueToPos(value), 0, 100) : 50;
  return html`
    <div class="meter-wrap">
      <div class="meter-header">
        <div class="meter-label-wrap">
          <span class="meter-label">${label}</span>
          ${renderInfoBtn(tooltip)}
        </div>
        <span class="meter-value">${displayValue} ${unit}</span>
      </div>
      <div class="meter-bar ${meterType}">
        <div class="meter-gradient"></div>
        ${value !== null ? html`<div class="meter-marker" style="left:${pos}%"></div>` : null}
      </div>
      <div class="meter-ticks">${rangeLabels.map(l => html`<span class="meter-tick">${l}</span>`)}</div>
    </div>
  `;
}

export function renderMetricRow(
  label: string,
  tooltip: string,
  value: string,
  statusClass: string = "",
  meterConfig?: {
    numValue: number | null;
    type: "level" | "center" | "low-good" | "high-good" | "bool-good" | "bool-bad";
    min: number;
    max: number;
  }
): TemplateResult {
  let meterPos = 50;
  if (meterConfig && meterConfig.numValue !== null) {
    const range = meterConfig.max - meterConfig.min;
    meterPos = clamp(((meterConfig.numValue - meterConfig.min) / range) * 100, 0, 100);
  }

  return html`
    <div class="metric-row">
      <div class="metric-row-header">
        <div class="metric-label-row">
          <span>${label}</span>
          ${renderInfoBtn(tooltip)}
        </div>
        <span class="metric-val ${statusClass}">${value}</span>
      </div>
      ${meterConfig ? html`
        <div class="mini-meter type-${meterConfig.type}">
          <div class="mini-meter-gradient"></div>
          ${meterConfig.numValue !== null ? html`<div class="mini-meter-marker" style="left:${meterPos}%"></div>` : null}
        </div>
      ` : null}
    </div>
  `;
}
