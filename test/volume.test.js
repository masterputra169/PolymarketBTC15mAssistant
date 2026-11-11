import test from "node:test";
import assert from "node:assert/strict";
import { computeVolumeRecentAvg } from "../src/engines/volume.js";
import { detectRegime } from "../src/engines/regime.js";

test("computeVolumeRecentAvg uses matching durations on full history", () => {
  const candles = Array.from({ length: 120 }, () => ({ volume: 100 }));
  const { volumeRecent, volumeAvg } = computeVolumeRecentAvg(candles, 20, 120);
  assert.equal(volumeRecent, 2000);
  assert.equal(volumeAvg, 2000);
});

test("window-truncated candles would falsely look low-volume; full history does not", () => {
  const full = Array.from({ length: 120 }, () => ({ volume: 100 }));
  const windowOnly = full.slice(-8); // mid-window start with 8 minutes left

  const bad = computeVolumeRecentAvg(windowOnly, 20, 120);
  // Old bug pattern: recent from truncated window vs avg from full history.
  const falseRecent = windowOnly.reduce((a, c) => a + c.volume, 0); // 800
  const falseAvg = full.slice(-120).reduce((a, c) => a + c.volume, 0) / 6; // 2000
  assert.ok(falseRecent < 0.6 * falseAvg);

  const good = computeVolumeRecentAvg(full, 20, 120);
  assert.equal(good.volumeRecent, good.volumeAvg);
  assert.ok(!(good.volumeRecent < 0.6 * good.volumeAvg));

  // Regime should not CHOP solely from duration mismatch when price near VWAP.
  const regime = detectRegime({
    price: 100,
    vwap: 100.05,
    vwapSlope: 0.01,
    vwapCrossCount: 0,
    volumeRecent: good.volumeRecent,
    volumeAvg: good.volumeAvg
  });
  assert.notEqual(regime.regime, "CHOP");
  assert.ok(bad.volumeRecent !== null);
});
