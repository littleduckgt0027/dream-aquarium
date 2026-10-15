# Game rules

Confirmed original requirements: `docs/MASTER_PROMPT.md`. Defaults below resolve unspecified details and are server-enforced.

## Fish and genetics
Seven tiers: Common, Uncommon, Rare, Epic, Legendary, Mythic, Celestial. DNA contains body, proportions, head, tail type and length, fin type and length, primary and accent colors, pattern, eyes, growth speed, maximum size, mutation, glow and fertility. Same DNA gives the same shape/colors. Swimming is animation only. The original artwork is generated with Canvas; no paid assets.

Growth is `clamp(elapsed / (24h × DNA.growth), 0, 1)` with speed factor 0.65–1.35. Rendered size grows from 45% to 100% of genetic maximum. New players receive five fully mature tank fish. All new discoveries and children start in storage. DNA/parents are permanently archived in the lineage table, including released fish and transferred ancestors.

Breeding: two different owned mature parents, 200 Pearl, 120 seconds. Each DNA field is inherited independently from one parent. 8% color mutation. Offspring count 1 or 2 with second-child probability `(fertilityA + fertilityB)/4`. Tier is rounded average of parent tiers, with 5% chance of +1 capped at Celestial. Unlimited generation counter. Parents cannot breed again, list, recycle or be released while an unclaimed breeding job references them. Children must be claimed when ready; full storage leaves the job unclaimed safely.

## Capacity and items
Initial tank 12; tank expansion adds 6 and costs current capacity ×100 Pearl. Storage initially 120; adds 120, cost capacity ×2, cap 10,000. Cards are paginated 60/page. Released fish are permanently removed from ownership after explicit confirmation; lineage survives. Inventory has unique non-tradable recycling tickets (separate records) and stackable fish food, split into at most 999 per stack. Food costs 20 Pearl, and feeding an owned young fish consumes one serving for one hour of growth progress without altering birth date or DNA. Fully mature fish cannot consume food. Monthly Limited fish are individual unique fish records, never stacked.

Recycle exactly 10 distinct non-Limited fish of the same tier, atomically, for one non-tradable same-tier ticket. Opening consumes it once, requires storage space, and creates a fish at least its tier. Ordinary ticket rarity uses the main weights conditioned on minimum tier. Limited chance by input tier is 0.001%, 0.005%, 0.010%, 0.025%, 0.050%, 0.100%, 0.500%. These are separate bonus chances, not the main gacha probability distribution. For a Limited ticket result, choose uniformly among eligible historical months. If no historical month exists, use current month.

## Market
Fixed-price listings never expire. Auctions: 6/12/24/48 hours, optional buyout >= start price. Bid >= start price and strictly higher than previous bid. Funds leave wallet immediately into escrow; outbid funds are returned atomically. Own buyout applies one's escrow toward price. Sale tax is floor(10% × price). No self-trading. Seller cancellation allowed only before any bid. All deliveries go to a permanent separate Delivery Inbox, even when storage is full. Items are never returned directly into a potentially full inventory. Failed claims are rolled back.

Auctions settle on server reads/actions and a 15-second background scheduler. No bids returns the fish to seller's Delivery Inbox. Sold listing cannot be purchased again. Market starts at 10 slots; nine upgrades of 10 reach 100 at total 796,000 Pearl. Market endpoint searches/filters/sorts and paginates 24 listings/page.

## Calendar and online time
Asia/Bangkok calendar months. Historical collections start January 2026, with each completed month eligible equally; no historical weighted month favoritism. The current month's Sunrise or Moonlight Limited variant comes from online milestones at 24/48/100/240 hours. Rewards and claims remain permanently recorded after monthly reset. A discovered Limited remains in the collection journal even after trade/release.

A visible authenticated tab sends a heartbeat every 15 seconds. Server time between heartbeats counts only for intervals <=45 seconds. Repeated heartbeat calls cannot add extra time beyond elapsed server time. Reconnecting within a 10-minute grace window retains account, progress, escrow and unclaimed rewards; unobserved time is deliberately not credited. Longer disconnections also preserve permanent player state. There is no offline income or fabricated online time. Monthly time resets; lifetime time remains. 300 Pearl earned every three hours of lifetime eligible time, credited once to Reward Inbox. Claim All skips selection-required Limited rewards; these must be claimed with Sunrise/Moonlight explicitly.

## Offline and maintenance
Offline: last authenticated cached tank keeps visually animating; writes disabled. On reconnection only authoritative state is loaded; cached data is never uploaded. Production service worker caches app shell/assets for offline refresh after first successful visit. Browser caching is no substitute for database backup.

Maintenance: operator-only CLI `node scripts/maintenance.js on|off` using same DB_PATH as server. No public administrative HTTP route. All game actions blocked, online intervals reset, aquarium still visible, no unconfirmed return estimate. Auction end times extend by actual maintenance duration on resume. Bids, escrow and records remain. Existing maintenance state persists across server restarts.

## Accounts
Username 3–24 ASCII letters/digits/underscore (case-insensitive login), password 10–128 characters, salted scrypt hash. One-time-shown 48-character random recovery code, hash stored. Recovery rotates the code and revokes all previous sessions. No email delivery dependency. Session lifetime 30 days. Signup grants are a game design source of currency; anti-bot/account-verification controls remain a prerequisite for a large public economy.
