import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreDirection,
  applyTimeAwareness,
  binaryFairProbUp,
  estimateLogReturnVol,
  normalCdf
} from "../src/engines/probability.js";

test("normalCdf known values", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-4);
  assert.ok(normalCdf(3) > 0.998);
  assert.ok(normalCdf(-3) < 0.002);
});

test("binaryFairProbUp moneyness near expiry", () => {
  const above = binaryFairProbUp({
    spot: 101_000,
    strike: 100_000,
    remainingMinutes: 0.01,
    sigmaPerSqrtMinute: 0.0002
  });
  const below = binaryFairProbUp({
    spot: 99_000,
    strike: 100_000,
    remainingMinutes: 0.01,
    sigmaPerSqrtMinute: 0.0002
  });
  assert.ok(above > 0.9);
  assert.ok(below < 0.1);
});

test("binaryFairProbUp null without spot/strike", () => {
  assert.equal(binaryFairProbUp({ spot: null, strike: 100, remainingMinutes: 5, sigmaPerSqrtMinute: 0.001 }), null);
  assert.equal(binaryFairProbUp({ spot: 100, strike: null, remainingMinutes: 5, sigmaPerSqrtMinute: 0.001 }), null);
});

test("applyTimeAwareness blends toward fair near expiry (not 0.5)", () => {
  const late = applyTimeAwareness(0.8, 0.5, 15, { fairUp: 0.1 });
  assert.ok(late.adjustedUp < 0.3, `expected late blend near fair, got ${late.adjustedUp}`);
  assert.ok(late.blendWeightFair > 0.9);

  const early = applyTimeAwareness(0.8, 14, 15, { fairUp: 0.1 });
  assert.ok(early.adjustedUp > 0.7, `expected early blend near TA, got ${early.adjustedUp}`);
});

test("applyTimeAwareness without fair keeps TA (no collapse to 0.5)", () => {
  const out = applyTimeAwareness(0.8, 0.1, 15, { fairUp: null });
  assert.ok(Math.abs(out.adjustedUp - 0.8) < 1e-12);
  assert.ok(Math.abs(out.adjustedDown - 0.2) < 1e-12);
});

test("scoreDirection mirrors failed VWAP reject", () => {
  const base = scoreDirection({
    price: 100,
    vwap: 100,
    vwapSlope: 0,
    rsi: 50,
    rsiSlope: 0,
    macd: null,
    heikenColor: null,
    heikenCount: 0,
    failedVwapReclaim: false,
    failedVwapReject: false
  });
  const reclaim = scoreDirection({
    price: 100,
    vwap: 100,
    vwapSlope: 0,
    rsi: 50,
    rsiSlope: 0,
    macd: null,
    heikenColor: null,
    heikenCount: 0,
    failedVwapReclaim: true,
    failedVwapReject: false
  });
  const reject = scoreDirection({
    price: 100,
    vwap: 100,
    vwapSlope: 0,
    rsi: 50,
    rsiSlope: 0,
    macd: null,
    heikenColor: null,
    heikenCount: 0,
    failedVwapReclaim: false,
    failedVwapReject: true
  });
  assert.ok(reclaim.rawUp < base.rawUp);
  assert.ok(reject.rawUp > base.rawUp);
});

test("estimateLogReturnVol returns positive sigma", () => {
  const closes = [];
  let p = 100;
  for (let i = 0; i < 40; i += 1) {
    p *= 1 + ((i % 2 === 0 ? 1 : -1) * 0.001);
    closes.push(p);
  }
  const sigma = estimateLogReturnVol(closes, 30);
  assert.ok(sigma !== null && sigma > 0);
});
