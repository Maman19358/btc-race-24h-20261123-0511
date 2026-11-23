# btc-race-24h-20261123-0511 — trend-filtered dip-buy cbBTC bot

Causal trend-filtered dip-buy bot for make.fun's "Race a BTC trading bot live
for 24 hours" (btc-race-24h-20261123-0511, $50 pot, top 10 paid).

Strategy (see grade dir DESIGN.md for the verified numbers): buy 100% of cash
when the close dips 0.75% below the trailing 120-bar high while above its
EMA60; sell all at +1.20% over entry or -3.00% under it. Mode B insurance
buys 25% if no trade by bar 720. Deterministic, stdlib only, no network,
no wall clock.

Dev window (frozen, in the kit): net PnL +$30.55, 7 trades, max drawdown
-1.58%. Positive in both halves, lag-stable, +$27.27 at 2x fees, and +$11.19
on the 18 Nov downtrend window — the design is positive on both windows
tested. The prize is decided by the unseen race window alone; no prize is
promised.

Entrypoint: `main.ts` (Node 22, agent-fun/bars-replay/v1 via the vendored
kit SDK shim at `vendor/makefun-bars.ts`).

License: MIT.
