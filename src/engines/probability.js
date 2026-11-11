import { clamp } from "../utils.js";

/**
 * Heuristic TA direction score in [0,1]. Not a calibrated probability by itself.
 */
export function scoreDirection(inputs) {
  const {
    price,
    vwap,
    vwapSlope,
    rsi,
    rsiSlope,
    macd,
    heikenColor,
    heikenCount,
    failedVwapReclaim,
    failedVwapReject
  } = inputs;

  let up = 1;
  let down = 1;

  if (price !== null && vwap !== null) {
    if (price > vwap) up += 2;
    if (price < vwap) down += 2;
  }

  if (vwapSlope !== null) {
    if (vwapSlope > 0) up += 2;
    if (vwapSlope < 0) down += 2;
  }

  if (rsi !== null && rsiSlope !== null) {
    if (rsi > 55 && rsiSlope > 0) up += 2;
    if (rsi < 45 && rsiSlope < 0) down += 2;
  }

  if (macd?.hist !== null && macd?.hist !== undefined && macd?.histDelta !== null && macd?.histDelta !== undefined) {
    const expandingGreen = macd.hist > 0 && macd.histDelta > 0;
    const expandingRed = macd.hist < 0 && macd.histDelta < 0;
    if (expandingGreen) up += 2;
    if (expandingRed) down += 2;

    if (macd.macd != null) {
      if (macd.macd > 0) up += 1;
      if (macd.macd < 0) down += 1;
    }
  }

  if (heikenColor) {
    if (heikenColor === "green" && heikenCount >= 2) up += 1;
    if (heikenColor === "red" && heikenCount >= 2) down += 1;
  }

  if (failedVwapReclaim === true) down += 3;
  if (failedVwapReject === true) up += 3;

  const rawUp = up / (up + down);
  return { upScore: up, downScore: down, rawUp };
}

/** Standard normal CDF (Abramowitz & Stegun 26.2.17). */
export function normalCdf(x) {
  if (!Number.isFinite(x)) return 0.5;
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * Per-sqrt-minute log-return vol from recent 1m closes.
 * Returns null if insufficient data.
 */
export function estimateLogReturnVol(closes, lookback = 30) {
  if (!Array.isArray(closes) || closes.length < lookback + 1) return null;
  const rets = [];
  const start = closes.length - lookback;
  for (let i = start; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (!(prev > 0) || !(cur > 0)) continue;
    rets.push(Math.log(cur / prev));
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  let varSum = 0;
  for (const r of rets) {
    const d = r - mean;
    varSum += d * d;
  }
  const variance = varSum / (rets.length - 1);
  const sigma = Math.sqrt(Math.max(variance, 0));
  return sigma > 0 ? sigma : null;
}

/**
 * Binary fair P(S_T > K) ≈ Φ(ln(S/K) / (σ√τ)) with τ in minutes.
 * Near expiry with σ→0, collapses to moneyness indicator.
 */
export function binaryFairProbUp({ spot, strike, remainingMinutes, sigmaPerSqrtMinute }) {
  if (!(spot > 0) || !(strike > 0)) return null;

  const tau = Math.max(Number(remainingMinutes) || 0, 0);
  const logMoneyness = Math.log(spot / strike);

  if (!(sigmaPerSqrtMinute > 0)) {
    if (tau <= 0) return logMoneyness > 0 ? 1 : logMoneyness < 0 ? 0 : 0.5;
    return null;
  }

  const denom = sigmaPerSqrtMinute * Math.sqrt(Math.max(tau, 1 / 60));
  if (!(denom > 0)) {
    return logMoneyness > 0 ? 1 : logMoneyness < 0 ? 0 : 0.5;
  }

  const z = logMoneyness / denom;
  return clamp(normalCdf(z), 0, 1);
}

/**
 * Blend TA heuristic with binary fair value.
 * As remaining time → 0, moneyness/fair value dominates (does NOT collapse to 0.5).
 * Without strike/fair value, keep TA score (no neutralizing decay).
 */
export function applyTimeAwareness(rawUp, remainingMinutes, windowMinutes, { fairUp = null } = {}) {
  const window = windowMinutes > 0 ? windowMinutes : 15;
  const timeFrac = clamp(remainingMinutes / window, 0, 1);

  if (fairUp !== null && Number.isFinite(fairUp)) {
    // Early: more TA weight; late: more fair/moneyness weight.
    const fairWeight = 1 - timeFrac;
    const taWeight = timeFrac;
    const adjustedUp = clamp(taWeight * rawUp + fairWeight * fairUp, 0, 1);
    return {
      timeDecay: timeFrac,
      adjustedUp,
      adjustedDown: 1 - adjustedUp,
      fairUp,
      blendWeightFair: fairWeight
    };
  }

  return {
    timeDecay: timeFrac,
    adjustedUp: clamp(rawUp, 0, 1),
    adjustedDown: 1 - clamp(rawUp, 0, 1),
    fairUp: null,
    blendWeightFair: 0
  };
}
