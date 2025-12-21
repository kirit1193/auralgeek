export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function dbFromLinear(x: number): number {
  if (!isFinite(x) || x <= 0) return -Infinity;
  return 20 * Math.log10(x);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
