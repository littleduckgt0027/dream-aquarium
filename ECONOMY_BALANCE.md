# Pearl economy and defaults

No real money or paid gacha. Values are configurable in `shared/rules.js`; starter balance/capacity and default reward values live in `backend/game.js`. Change balancing deliberately with regression tests and migrations for existing players when needed.

| Source / sink | Pearl |
|---|---:|
| Account starter grant (once) | +3,000 |
| Eligible online time (per 3 hours, inbox claim) | +300 |
| Breeding | -200 |
| Fish food (+1 hour growth progress per serving) | -20 |
| Gacha ×1 | -100 |
| Gacha ×10 | -900 |
| Gacha ×100 | -8,500 |
| Gacha ×1000 | -80,000 |
| Tank +6 slots | -(current capacity ×100) |
| Storage +120 | -(current capacity ×2) |
| Market completed sale tax | 10%, rounded down |

Rarity weights: 60%, 25%, 10%, 3.8%, 1%, 0.18%, 0.02%. No pity, no paid shortcut. Recycling consumes ten fish and preserves or raises rarity according to conditioned main rarity weights; Limited probability is separately rolled first using the confirmed rarity-specific rates.

Market upgrades add ten slots each: 4,000; 8,000; 16,000; 32,000; 64,000; 100,000; 140,000; 180,000; 252,000. Sum = **796,000**, from 10 to 100 slots. Fish price/bid range 1–1,000,000,000 whole Pearl. Auction escrow is not spendable wallet money. Refunds, sales, tax and item delivery occur within the same `BEGIN IMMEDIATE` transaction. No client balance is accepted.

The immutable transaction history begins after the explicit starter grant; every later debit/credit has a ledger entry. SQLite transactions serialize writers, so two buyers cannot commit purchase of the same item. Idempotency keys are bound to user and exact request body. Replay returns current state without repeating the economic effect.

Balance needs player telemetry before wider launch. Starter-account farming, bot verification, multi-account trading and long-term supply/sink tuning are not proven production solutions. No simulation here asserts that this economy is exploit-free under unrestricted public signup.
