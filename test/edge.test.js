import test from "node:test";
import assert from "node:assert/strict";
import { computeEdge, decide } from "../src/engines/edge.js";

test("computeEdge uses raw asks (no renormalization)", () => {
  // y+n = 1.10 → old code would shrink asks and overstate edge
  const edge = computeEdge({ modelUp: 0.7, modelDown: 0.3, marketYes: 0.6, marketNo: 0.5 });
  assert.equal(edge.marketUp, 0.6);
  assert.equal(edge.marketDown, 0.5);
  assert.ok(Math.abs(edge.edgeUp - 0.1) < 1e-12);
  assert.ok(Math.abs(edge.edgeDown - -0.2) < 1e-12);
  assert.ok(Math.abs(edge.impliedUp - 0.6 / 1.1) < 1e-12);
});

test("decide NO_TRADE on edge tie", () => {
  const rec = decide({
    remainingMinutes: 12,
    edgeUp: 0.1,
    edgeDown: 0.1,
    modelUp: 0.7,
    modelDown: 0.7,
    regime: "TREND_UP"
  });
  assert.equal(rec.action, "NO_TRADE");
  assert.equal(rec.reason, "edge_tie");
});

test("decide blocks CHOP regime", () => {
  const rec = decide({
    remainingMinutes: 12,
    edgeUp: 0.2,
    edgeDown: -0.1,
    modelUp: 0.7,
    modelDown: 0.3,
    regime: "CHOP"
  });
  assert.equal(rec.action, "NO_TRADE");
  assert.match(rec.reason, /regime_chop/);
});

test("decide blocks wide spread", () => {
  const rec = decide({
    remainingMinutes: 12,
    edgeUp: 0.2,
    edgeDown: -0.1,
    modelUp: 0.7,
    modelDown: 0.3,
    regime: "TREND_UP",
    spread: 0.2
  });
  assert.equal(rec.action, "NO_TRADE");
  assert.match(rec.reason, /spread_above/);
});

test("decide blocks thin ask liquidity", () => {
  const rec = decide({
    remainingMinutes: 12,
    edgeUp: 0.2,
    edgeDown: -0.1,
    modelUp: 0.7,
    modelDown: 0.3,
    regime: "TREND_UP",
    spread: 0.01,
    askLiquidity: 5
  });
  assert.equal(rec.action, "NO_TRADE");
  assert.match(rec.reason, /ask_liquidity_below/);
});

test("decide ENTER when filters pass", () => {
  const rec = decide({
    remainingMinutes: 12,
    edgeUp: 0.2,
    edgeDown: -0.1,
    modelUp: 0.7,
    modelDown: 0.3,
    regime: "TREND_UP",
    spread: 0.01,
    askLiquidity: 200
  });
  assert.equal(rec.action, "ENTER");
  assert.equal(rec.side, "UP");
  assert.equal(rec.phase, "EARLY");
});
