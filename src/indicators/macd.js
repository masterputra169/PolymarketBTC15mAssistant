/**
 * Canonical EMA: seed with SMA of first `period` values, then recur from index `period`.
 */
export function ema(values, period) {
  if (!Array.isArray(values) || values.length < period || !(period > 0)) return null;

  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i += 1) {
    prev += values[i];
  }
  prev /= period;

  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/**
 * EMA series: null until index period-1 (SMA seed), then EMA thereafter.
 */
export function emaSeries(values, period) {
  if (!Array.isArray(values) || values.length < period || !(period > 0)) {
    return new Array(Array.isArray(values) ? values.length : 0).fill(null);
  }

  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i += 1) {
    prev += values[i];
  }
  prev /= period;
  out[period - 1] = prev;

  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function computeMacd(closes, fast, slow, signal) {
  if (!Array.isArray(closes) || closes.length < slow + signal) return null;

  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);

  const macdSeries = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (fastSeries[i] === null || slowSeries[i] === null) continue;
    macdSeries.push(fastSeries[i] - slowSeries[i]);
  }

  if (macdSeries.length < signal) return null;

  const signalLine = ema(macdSeries, signal);
  if (signalLine === null) return null;

  const macdLine = macdSeries[macdSeries.length - 1];
  const hist = macdLine - signalLine;

  const prevSignal =
    macdSeries.length >= signal + 1 ? ema(macdSeries.slice(0, macdSeries.length - 1), signal) : null;
  const prevHist = prevSignal === null ? null : macdSeries[macdSeries.length - 2] - prevSignal;

  return {
    macd: macdLine,
    signal: signalLine,
    hist,
    histDelta: prevHist === null ? null : hist - prevHist
  };
}
