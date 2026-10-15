# Master Prompt coverage

| Area | Implemented behavior | Evidence |
|---|---|---|
| Accounts | Register, login/logout, salted scrypt, sessions, code recovery | API integration test |
| Persistence | SQLite WAL migrations, transactions, restart recovery | Database reopen + integrity test |
| Aquarium | Canvas fish, procedural shape/DNA, smooth swimming/turning, plants/light/bubbles, mobile | Chromium journey + screenshots |
| Genetics | Unique DNA, tier, growth, recombination, mutation, generation/ancestor archive | Genetics + breeding tests |
| Management | Tank/storage moves, capacity upgrades, search/sort/rarity filters, confirmed release, decoration | Unit ownership/capacity + browser management |
| Inventory | Non-tradable unique tickets, food stacks <=999, atomic consumption, unique Limited fish | Inventory + recycling tests |
| Pearl | Wallet, permanent ledger, source/sinks, atomic debits/refunds | Economy + rollback tests |
| Discovery | x1/10/100/1000, discounts, main odds, no pity, storage delivery | Bulk 1000 roll test + browser roll |
| Recycling | Ten distinct same-tier fish, conditional >=tier ticket, independent Limited odds | Recycling test |
| Market | Fixed listings, auctions 6/12/24/48h, buyout, bid escrow/refund, 10% tax, slots/upgrades, history, pagination | API race + unit auctions + two-player browser trade |
| Monthly | Bangkok months, current Sunrise/Moonlight variants, history since January 2026, uniform historical pool, journal | Calendar/monthly claim tests; historical pool logic |
| Online time | Server elapsed time, visible heartbeat, 3h Pearl/24–240h Limited, no offline credit | Heartbeat/gap/month rollover tests |
| Reward Inbox | Permanent rewards/claim history, selection-required claims, Claim All exclusion | Reward selection/duplicate tests |
| Delivery Inbox | Permanent purchases/returns, claim after storage check, duplicate protection | Delivery tests + browser claim |
| Offline | Cached shell/tank, visual swimming, writes disabled, reconnect and authoritative refresh | Chromium offline refresh test |
| Maintenance | Operator CLI, view-only tank, writes/time paused, auction remaining time preserved | Unit maintenance + Chromium mode test |
| Security | Rate limits, input/ownership checks, secure RNG, hashing/cookies, same-origin writes, idempotency, audit | API + economy security tests |
| Build/operations | Production assets, Node launcher, Docker non-root/durable volume, health | Build + container smoke (see progress for final results) |
| Public deployment | Instructions and image prepared; no hosting account/domain provisioned | Not deployed; authorization/target needed |

The browser journey waits a real two minutes for breeding. Online milestones and long auction deadlines are verified with controlled server test timestamps, not by claiming that 240 real hours or 48 real hours were observed. No client can supply those test timestamps to a running API. Cross-browser/Safari, Windows launcher and production-scale load tests are not claimed. Complete functional coverage does not mean public launch operations and abuse mitigation are finished.
