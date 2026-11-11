import test from "node:test";
import assert from "node:assert/strict";
import { classifyLivePtbLatch, resolveFairStrike } from "../src/engines/ptbStrike.js";
import { binaryFairProbUp } from "../src/engines/probability.js";
import { applyTimeAwareness } from "../src/engines/probability.js";

test("classifyLivePtbLatch trusts only near market open", () => {
  const start = 1_000_000;
  const grace = 90_000;
  assert.equal(classifyLivePtbLatch({ nowMs: start + 10_000, marketStartMs: start, graceMs: grace }), "live_latch_open");
  assert.equal(classifyLivePtbLatch({ nowMs: start + grace, marketStartMs: start, graceMs: grace }), "live_latch_open");
  assert.equal(
    classifyLivePtbLatch({ nowMs: start + grace + 1, marketStartMs: start, graceMs: grace }),
    "live_latch_unofficial"
  );
  assert.equal(classifyLivePtbLatch({ nowMs: start + 60_000, marketStartMs: null, graceMs: grace }), null);
  assert.equal(classifyLivePtbLatch({ nowMs: start - 1, marketStartMs: start, graceMs: grace }), null);
});

test("resolveFairStrike excludes unofficial mid-window latch", () => {
  assert.equal(resolveFairStrike({ value: 100_000, source: "official" }), 100_000);
  assert.equal(resolveFairStrike({ value: 100_000, source: "live_latch_open" }), 100_000);
  assert.equal(resolveFairStrike({ value: 101_000, source: "live_latch_unofficial" }), null);
  assert.equal(resolveFairStrike({ value: 101_000, source: null }), null);
});

test("mid-window unofficial latch does not drive fair value near expiry", () => {
  const spot = 101_000;
  const officialStrike = 100_000;
  const midLatch = 101_000;

  const withOfficial = binaryFairProbUp({
    spot,
    strike: resolveFairStrike({ value: officialStrike, source: "official" }),
    remainingMinutes: 1,
    sigmaPerSqrtMinute: 0.0002
  });
  const withUnofficial = binaryFairProbUp({
    spot,
    strike: resolveFairStrike({ value: midLatch, source: "live_latch_unofficial" }),
    remainingMinutes: 1,
    sigmaPerSqrtMinute: 0.0002
  });

  assert.ok(withOfficial > 0.9);
  assert.equal(withUnofficial, null);

  const blended = applyTimeAwareness(0.55, 1, 15, { fairUp: withUnofficial });
  assert.ok(Math.abs(blended.adjustedUp - 0.55) < 1e-12);
});
