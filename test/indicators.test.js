import test from "node:test";
import assert from "node:assert/strict";
import { computeRsi, computeRsiSeries } from "../src/indicators/rsi.js";
import { ema, emaSeries, computeMacd } from "../src/indicators/macd.js";
import { computeSessionVwap, filterCandlesForMarketWindow } from "../src/indicators/vwap.js";
import { summarizeOrderBook } from "../src/data/polymarket.js";
import { formatCents } from "../src/utils.js";
import { priceToBeatFromPolymarketMarket, parsePriceToBeat } from "../src/data/priceToBeat.js";

test("Wilder RSI: flat series → 50-ish / all up → 100", () => {
  const up = [];
  for (let i = 0; i < 30; i += 1) up.push(100 + i);
  assert.equal(computeRsi(up, 14), 100);

  const flat = Array.from({ length: 30 }, () => 100);
  // all zero changes after first → avgLoss=0 path → 100 with zero gains too... actually diffs are 0
  // gains=0 losses=0 → avgLoss=0 → returns 100 by convention
  assert.equal(computeRsi(flat, 14), 100);

  const mix = [44, 44.5, 44.2, 44.8, 45.1, 45.0, 45.4, 45.2, 45.6, 46.0, 46.1, 45.8, 46.2, 46.5, 46.3, 46.8, 47.0, 46.7, 47.2, 47.5];
  const rsi = computeRsi(mix, 14);
  assert.ok(rsi !== null && rsi > 40 && rsi < 100);

  const series = computeRsiSeries(mix, 14);
  assert.equal(series.length, mix.length);
  assert.equal(series[13], null); // index period-1 still null? seed at index period
  assert.ok(series[14] !== null);
  assert.equal(series[series.length - 1], rsi);
});

test("EMA seeds with SMA of first period", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const period = 3;
  const series = emaSeries(values, period);
  assert.equal(series[0], null);
  assert.equal(series[1], null);
  assert.equal(series[2], (1 + 2 + 3) / 3);

  const k = 2 / (period + 1);
  let prev = (1 + 2 + 3) / 3;
  prev = 4 * k + prev * (1 - k);
  assert.ok(Math.abs(series[3] - prev) < 1e-12);
  assert.ok(Math.abs(ema(values, period) - series[series.length - 1]) < 1e-12);
});

test("MACD returns with SMA-seeded EMA", () => {
  const closes = [];
  for (let i = 0; i < 80; i += 1) closes.push(100 + Math.sin(i / 5) * 2 + i * 0.05);
  const macd = computeMacd(closes, 12, 26, 9);
  assert.ok(macd !== null);
  assert.ok(Number.isFinite(macd.macd));
  assert.ok(Number.isFinite(macd.signal));
  assert.ok(Number.isFinite(macd.hist));
});

test("filterCandlesForMarketWindow uses eventStartMs", () => {
  const candles = [
    { openTime: 1000, high: 1, low: 1, close: 1, volume: 1 },
    { openTime: 2000, high: 2, low: 2, close: 2, volume: 1 },
    { openTime: 3000, high: 3, low: 3, close: 3, volume: 1 }
  ];
  const filtered = filterCandlesForMarketWindow(candles, { eventStartMs: 2500, windowMinutes: 15, nowMs: 4000 });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].close, 3);

  const vwap = computeSessionVwap(filtered);
  assert.equal(vwap, 3);
});

test("summarizeOrderBook sorts before depth liquidity", () => {
  const book = {
    bids: [
      { price: "0.40", size: "10" },
      { price: "0.55", size: "100" },
      { price: "0.50", size: "20" }
    ],
    asks: [
      { price: "0.70", size: "10" },
      { price: "0.60", size: "100" },
      { price: "0.65", size: "20" }
    ]
  };
  const s = summarizeOrderBook(book, 2);
  assert.equal(s.bestBid, 0.55);
  assert.equal(s.bestAsk, 0.6);
  assert.equal(s.bidLiquidity, 120); // 100 + 20 (top 2 by price)
  assert.equal(s.askLiquidity, 120); // 100 + 20
  assert.ok(Math.abs(s.spread - 0.05) < 1e-12);
});

test("formatCents scales probability dollars", () => {
  assert.equal(formatCents(0.55), "55.0¢");
  assert.equal(formatCents(55), "55.0¢");
  assert.equal(formatCents(null), "-");
});

test("priceToBeatFromPolymarketMarket prefers field then question", () => {
  assert.equal(priceToBeatFromPolymarketMarket({ priceToBeat: 95000 }), 95000);
  assert.equal(
    parsePriceToBeat({ question: "Bitcoin Up or Down - Price to Beat $101,234.50" }),
    101234.5
  );
  assert.equal(
    priceToBeatFromPolymarketMarket({ question: "Bitcoin Up or Down - Price to Beat $88,000" }),
    88000
  );
});
