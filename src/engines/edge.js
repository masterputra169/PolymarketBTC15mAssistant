import { clamp } from "../utils.js";
import { CONFIG } from "../config.js";

/**
 * Edge / EV vs execution ask (no renormalization).
 * EV_up ≈ modelUp - askUp (payout $1, ignore fee).
 * Implied probs (normalized) are returned for display only.
 */
export function computeEdge({ modelUp, modelDown, marketYes, marketNo }) {
  if (marketYes === null || marketNo === null) {
    return {
      marketUp: null,
      marketDown: null,
      impliedUp: null,
      impliedDown: null,
      edgeUp: null,
      edgeDown: null
    };
  }

  const askUp = clamp(Number(marketYes), 0, 1);
  const askDown = clamp(Number(marketNo), 0, 1);

  const sum = askUp + askDown;
  const impliedUp = sum > 0 ? askUp / sum : null;
  const impliedDown = sum > 0 ? askDown / sum : null;

  const edgeUp = modelUp - askUp;
  const edgeDown = modelDown - askDown;

  return {
    marketUp: askUp,
    marketDown: askDown,
    impliedUp,
    impliedDown,
    edgeUp,
    edgeDown
  };
}

function phaseFromMinutes(remainingMinutes, thresholds) {
  const earlyMin = thresholds.earlyMinutes ?? 10;
  const midMin = thresholds.midMinutes ?? 5;
  if (remainingMinutes > earlyMin) return "EARLY";
  if (remainingMinutes > midMin) return "MID";
  return "LATE";
}

/**
 * Advisory ENTER / NO_TRADE gate.
 * Includes regime / spread / liquidity filters when provided.
 */
export function decide({
  remainingMinutes,
  edgeUp,
  edgeDown,
  modelUp = null,
  modelDown = null,
  regime = null,
  spread = null,
  askLiquidity = null,
  thresholds = CONFIG.decision
}) {
  const t = thresholds ?? {};
  const phase = phaseFromMinutes(remainingMinutes, t);

  const edgeThreshold =
    phase === "EARLY" ? (t.edgeEarly ?? 0.05) : phase === "MID" ? (t.edgeMid ?? 0.1) : (t.edgeLate ?? 0.2);

  const minProb =
    phase === "EARLY" ? (t.probEarly ?? 0.55) : phase === "MID" ? (t.probMid ?? 0.6) : (t.probLate ?? 0.65);

  if (edgeUp === null || edgeDown === null) {
    return { action: "NO_TRADE", side: null, phase, reason: "missing_market_data" };
  }

  const blockedRegimes = t.blockRegimes ?? ["CHOP"];
  if (regime && blockedRegimes.includes(regime)) {
    return { action: "NO_TRADE", side: null, phase, reason: `regime_${String(regime).toLowerCase()}` };
  }

  const maxSpread = t.maxSpread ?? 0.08;
  if (spread !== null && Number.isFinite(spread) && spread > maxSpread) {
    return { action: "NO_TRADE", side: null, phase, reason: `spread_above_${maxSpread}` };
  }

  const minAskLiq = t.minAskLiquidity ?? 50;
  if (askLiquidity !== null && Number.isFinite(askLiquidity) && askLiquidity < minAskLiq) {
    return { action: "NO_TRADE", side: null, phase, reason: `ask_liquidity_below_${minAskLiq}` };
  }

  const tieEps = t.edgeTieEpsilon ?? 1e-9;
  if (Math.abs(edgeUp - edgeDown) <= tieEps) {
    return { action: "NO_TRADE", side: null, phase, reason: "edge_tie" };
  }

  const bestSide = edgeUp > edgeDown ? "UP" : "DOWN";
  const bestEdge = bestSide === "UP" ? edgeUp : edgeDown;
  const bestModel = bestSide === "UP" ? modelUp : modelDown;

  if (bestEdge < edgeThreshold) {
    return { action: "NO_TRADE", side: null, phase, reason: `edge_below_${edgeThreshold}` };
  }

  if (bestModel !== null && bestModel < minProb) {
    return { action: "NO_TRADE", side: null, phase, reason: `prob_below_${minProb}` };
  }

  const strength =
    bestEdge >= (t.strengthStrong ?? 0.2)
      ? "STRONG"
      : bestEdge >= (t.strengthGood ?? 0.1)
        ? "GOOD"
        : "OPTIONAL";

  return { action: "ENTER", side: bestSide, phase, strength, edge: bestEdge };
}
