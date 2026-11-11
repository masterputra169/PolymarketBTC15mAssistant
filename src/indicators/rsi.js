import { clamp } from "../utils.js";

/**
 * Wilder RSI (standard).
 * First avgGain/avgLoss = SMA of first `period` changes; then Wilder smooth.
 */
export function computeRsi(closes, period) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  if (!(period > 0)) return null;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return clamp(rsi, 0, 100);
}

/**
 * Full Wilder RSI series aligned to closes (null until period+1 bars available).
 */
export function computeRsiSeries(closes, period) {
  if (!Array.isArray(closes) || closes.length < period + 1) return [];

  const series = new Array(closes.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiAt = (g, l) => {
    if (l === 0) return 100;
    return clamp(100 - 100 / (1 + g / l), 0, 100);
  };

  series[period] = rsiAt(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    series[i] = rsiAt(avgGain, avgLoss);
  }

  return series;
}

export function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function slopeLast(values, points) {
  if (!Array.isArray(values) || values.length < points) return null;
  const slice = values.slice(values.length - points);
  const first = slice[0];
  const last = slice[slice.length - 1];
  return (last - first) / (points - 1);
}
