import { describe, it, expect } from "vitest";
import { computeDynamics } from "./dsp";

function sine(len: number, amp: number): Float32Array {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = amp * Math.sin(2 * Math.PI * (i / 100));
  return out;
}

describe("computeDynamics", () => {
  it("detects clipping", () => {
    const x = sine(48000, 1.2);
    const d = computeDynamics([x]);
    expect(d.hasClipping).toBe(true);
  });

  it("crest factor is >= 0", () => {
    const x = sine(48000, 0.5);
    const d = computeDynamics([x]);
    expect(d.crestFactorDB).toBeGreaterThanOrEqual(0);
  });
});
