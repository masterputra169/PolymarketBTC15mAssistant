/**
 * Recent vs average volume over matching durations on the same candle series.
 * volumeAvg is the mean of (avgBars/recentBars) non-overlapping recentBars blocks
 * ≈ sum(avgBars) / (avgBars/recentBars).
 */
export function computeVolumeRecentAvg(candles, recentBars = 20, avgBars = 120) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { volumeRecent: null, volumeAvg: null };
  }
  if (!(recentBars > 0) || !(avgBars >= recentBars)) {
    return { volumeRecent: null, volumeAvg: null };
  }

  const volumeRecent = candles.slice(-recentBars).reduce((a, c) => a + (Number(c.volume) || 0), 0);
  const volumeAvg =
    candles.slice(-avgBars).reduce((a, c) => a + (Number(c.volume) || 0), 0) / (avgBars / recentBars);

  return { volumeRecent, volumeAvg };
}
