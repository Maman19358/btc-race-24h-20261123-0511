/**
 * btc-race-24h Trading Bot Entry (main.ts)
 * 
 * Strategy Overview:
 * - Warm-up: Wait for at least 120 closes before trading.
 * - EMA60: Exponential moving average (alpha = 2/61), seeded with first close.
 * - Trailing High: Max close of the last 120 bars including latest.
 * - Mode A (Main): Buy 100% cash when close > EMA60 and close <= trailingHigh * 0.9925. Exit at +1.2% or -3.0%.
 * - Mode B (Insurance): Buy 25% cash when buys == 0, seq >= 720, and close <= trailingHigh * 0.9950. Exit at +0.8% or -2.0%.
 * - Entry Price: fill.notional * 10^7 / fill.qty (integer floor division).
 * - Deterministic, no Date, no Math.random, no env, no network, no console output.
 */
import { runBars } from "./vendor/makefun-bars.ts";
import type { BarsState, Batch, OrderInput } from "./vendor/makefun-bars.ts";

let mode: "none" | "A" | "B" = "none";
let entry: bigint | null = null;
let ema60: number | null = null;
let buysCount = 0;
const closes: bigint[] = [];

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] | void {
    if (batch.bars.length === 0) return;
    const bar = batch.bars[0];
    const symbol = bar.symbol;
    const close = BigInt(bar.c);

    closes.push(close);
    if (ema60 === null) {
      ema60 = Number(close);
    } else {
      const alpha = 2 / (60 + 1);
      ema60 = alpha * Number(close) + (1 - alpha) * ema60;
    }

    const windowStart = closes.length > 120 ? closes.length - 120 : 0;
    let trailingHigh = 0n;
    for (let i = windowStart; i < closes.length; i++) {
      if (closes[i]! > trailingHigh) {
        trailingHigh = closes[i]!;
      }
    }

    // Buy fill arrives in the next batch, so entry is set from the fill.
    // No sell is decided before entry is set.
    for (const fill of batch.fills) {
      if (fill.status === "filled" && fill.side === "buy" && entry === null) {
        const fNotional = BigInt(fill.notional_quote_units);
        const fQty = BigInt(fill.qty);
        if (fQty > 0n) {
          entry = (fNotional * 10n ** 7n) / fQty;
        }
      }
    }

    const holding = state.positions.has(symbol) && (state.positions.get(symbol)?.qty ?? 0n) > 0n;

    if (holding && entry !== null) {
      if (mode === "A") {
        const upper = (entry * 10120n) / 10000n;
        const lower = (entry * 9700n) / 10000n;
        if (close >= upper || close <= lower) {
          const pos = state.positions.get(symbol);
          const qty = pos ? pos.qty : 0n;
          mode = "none";
          entry = null;
          if (qty > 0n) {
            return [{ side: "sell", symbol, qty, max_slippage_bps: 100 }];
          }
        }
      } else if (mode === "B") {
        const upper = (entry * 10080n) / 10000n;
        const lower = (entry * 9800n) / 10000n;
        if (close >= upper || close <= lower) {
          const pos = state.positions.get(symbol);
          const qty = pos ? pos.qty : 0n;
          mode = "none";
          entry = null;
          if (qty > 0n) {
            return [{ side: "sell", symbol, qty, max_slippage_bps: 100 }];
          }
        }
      }
      return;
    }

    if (mode === "none" && closes.length >= 120) {
      const emaBig = BigInt(Math.round(ema60));
      if (close > emaBig && close <= (trailingHigh * 9925n) / 10000n) {
        const cash = state.cash;
        const notional = cash;
        if (notional >= 1_000_000n) {
          mode = "A";
          buysCount++;
          return [{ side: "buy", symbol, notional_quote_units: notional, max_slippage_bps: 100 }];
        }
      }

      if (buysCount === 0 && batch.seq >= 720 && close <= (trailingHigh * 9950n) / 10000n) {
        const cash = state.cash;
        const notional = cash / 4n;
        if (notional >= 1_000_000n) {
          mode = "B";
          buysCount++;
          return [{ side: "buy", symbol, notional_quote_units: notional, max_slippage_bps: 100 }];
        }
      }
    }
  },
});
