/**
 * Classify a live settlement latch for PTB.
 * - official path is handled separately
 * - near event start → trusted opening print
 * - mid-window → display-only (never fair-value strike)
 * - missing eventStart → cannot verify; do not latch
 */
export function classifyLivePtbLatch({ nowMs, marketStartMs, graceMs }) {
  if (marketStartMs === null || !Number.isFinite(marketStartMs)) return null;
  if (!Number.isFinite(nowMs) || nowMs < marketStartMs) return null;
  if (nowMs - marketStartMs <= graceMs) return "live_latch_open";
  return "live_latch_unofficial";
}

/** Strike usable for binaryFairProbUp. */
export function resolveFairStrike({ value, source }) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  if (source === "official" || source === "live_latch_open") return Number(value);
  return null;
}
