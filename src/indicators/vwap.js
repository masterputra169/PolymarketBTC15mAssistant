/**
 * Cumulative VWAP over the provided candle window (caller chooses session bounds).
 * Typical price = (H+L+C)/3.
 */
export function computeSessionVwap(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return null;

  let pv = 0;
  let v = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    v += c.volume;
  }
  if (v === 0) return null;
  return pv / v;
}

export function computeVwapSeries(candles) {
  const series = [];
  for (let i = 0; i < candles.length; i += 1) {
    const sub = candles.slice(0, i + 1);
    series.push(computeSessionVwap(sub));
  }
  return series;
}

/**
 * Candles belonging to the current Polymarket window.
 * Prefer eventStartMs; else last `windowMinutes` of openTime.
 */
export function filterCandlesForMarketWindow(candles, { eventStartMs = null, windowMinutes = 15, nowMs = Date.now() } = {}) {
  if (!Array.isArray(candles) || candles.length === 0) return [];

  let startMs = eventStartMs;
  if (startMs === null || !Number.isFinite(startMs)) {
    startMs = nowMs - windowMinutes * 60_000;
  }

  return candles.filter((c) => {
    const t = Number(c.openTime ?? c.t ?? c.time);
    if (!Number.isFinite(t)) return true;
    return t >= startMs;
  });
}
