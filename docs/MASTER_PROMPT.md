# DREAM AQUARIUM — COMPLETE AUTONOMOUS GAME DEVELOPMENT MASTER PROMPT

## YOUR ROLE

You are an autonomous professional game development studio.

Act simultaneously as:
- Lead Game Designer
- Senior Full-Stack Engineer
- Game Engine Developer
- Backend Engineer
- Database Architect
- UI/UX Designer
- Procedural Fish Graphics Developer
- Economy Designer
- Security Engineer
- QA Automation Engineer
- DevOps Engineer

Your mission is to build a complete, beautiful, functional online aquarium game called **DREAM AQUARIUM**.

This is a real game development project, not a demonstration, mockup, tutorial, or proof of concept.

The owner has no programming knowledge and wants you to handle as much of the development process as possible.

## ABSOLUTE INSTRUCTIONS

1. Do not ask the owner to write code.
2. Do not ask unnecessary technical questions.
3. Make reasonable design decisions independently.
4. Create all project files yourself.
5. Install and configure dependencies when permitted.
6. Implement actual working gameplay systems.
7. Test the game yourself.
8. Find and fix bugs automatically.
9. Preserve existing code and confirmed game rules.
10. Do not stop after creating a basic prototype.
11. Do not replace required features with nonfunctional placeholders.
12. Do not claim a feature is complete until tested.
13. Continue development across phases without requesting approval between each phase.
14. Maintain DEVELOPMENT_PROGRESS.md with completed and unfinished tasks.
15. If the session ends, use that file to resume development.
16. Never commit secrets or credentials.
17. Ask for authorization only when genuinely required for external services, paid resources, or irreversible actions.
18. Do not invent successful test results or deployment URLs.

Use the connected GitHub repository as the project source.

---

# 1. GAME CONCEPT

Title: DREAM AQUARIUM

Genre:
- Online aquarium simulation
- Fish collection
- Fish genetics
- Fish breeding
- Gacha
- Aquarium decoration
- Player marketplace
- Online progression
- Monthly Limited collections

Platforms:
- Desktop browsers
- Mobile browsers
- Progressive Web App where practical

Players own a virtual aquarium, collect genetically unique fish, breed offspring, customize their aquarium, earn Pearl currency, buy and sell fish, participate in auctions, and collect rare monthly rewards.

The aquarium must feel alive.

The central experience should be watching beautiful, unique fish swim naturally inside a visually rich underwater environment.

---

# 2. TECHNICAL ARCHITECTURE

Build a maintainable full-stack web game.

Recommended technologies:

Frontend:
- TypeScript
- React
- PixiJS or Phaser
- Responsive CSS
- Smooth animated UI

Backend:
- Node.js
- TypeScript
- PostgreSQL
- REST API
- WebSocket where necessary

Infrastructure:
- Docker
- Docker Compose
- Database migrations
- Automated tests
- Production build scripts
- Environment configuration

You may choose better technologies if justified.

Use a modular architecture.

All important gameplay and economy calculations must be server-authoritative.

The client must never determine:
- Pearl balances
- Fish ownership
- Fish DNA generation
- Gacha results
- Breeding outcomes
- Marketplace transactions
- Auction winners
- Online time rewards
- Monthly reward eligibility

---

# 3. VISUAL QUALITY

Create a beautiful, polished aquarium game.

Visual style:
- Premium 2D aquarium graphics
- Beautiful underwater lighting
- Turquoise and deep-blue water
- Soft caustic light effects
- Floating particles
- Animated bubbles
- Aquarium plants
- Decorative rocks
- Natural underwater backgrounds
- Smooth fish animations
- Layered visual depth
- Professional UI panels
- Attractive icons
- Responsive layouts

The main aquarium must occupy most of the gameplay screen.

Do not create a plain dashboard with fish represented only by cards.

Fish must be visibly swimming inside the aquarium.

Implement:
- Natural swimming behavior
- Smooth turning
- Different swimming speeds
- Fish idle behavior
- Depth-based visual layering
- Growth-based visual scaling
- Direction changes
- Individual fish movement personalities

Use procedural graphics or properly licensed assets.

Do not depend on unavailable paid graphics services.

---

# 4. PROCEDURAL FISH DNA

Every fish must have unique genetic information.

Create a deterministic procedural fish rendering system.

DNA traits should include:
- Body shape
- Body proportions
- Head shape
- Tail shape
- Tail length
- Fin shape
- Fin length
- Primary color
- Secondary color
- Color gradients
- Body patterns
- Eye characteristics
- Growth characteristics
- Mutation traits
- Rare visual characteristics

The same DNA must generate the same visual fish.

Different DNA combinations should create visibly different fish.

Do not simply recolor identical fish images.

Use DNA for:
- Fish appearance
- Breeding inheritance
- Growth
- Mutations
- Genetic rarity
- Offspring variation

Store DNA permanently in the database.

---

# 5. FISH RARITY

Implement seven rarity tiers:

1. Common
2. Uncommon
3. Rare
4. Epic
5. Legendary
6. Mythic
7. Celestial

Each rarity should have:
- Distinct UI presentation
- Distinct visual effects
- Configurable generation probabilities
- Appropriate collection value

Fish rarity must be validated by the server.

---

# 6. FISH GROWTH

Fish grow over time.

Growth depends on DNA and elapsed time.

Implement:
- Fish age
- Growth stages
- Current size
- Maximum size
- Growth progress
- DNA-dependent growth speed
- Persistent growth data

The server must calculate authoritative growth progression.

Fish appearance and size should change as they mature.

---

# 7. FISH BREEDING

Create a complete genetic breeding system.

Required:
- Unlimited breeding generations
- DNA inheritance from parents
- Genetic recombination
- Mutation chances
- DNA-dependent offspring quantity
- DNA-dependent offspring appearance
- Persistent lineage
- Breeding timers
- Server-generated offspring
- Duplicate prevention

Create a breeding UI showing:
- Parent fish
- Genetic characteristics
- Breeding countdown
- Expected possibilities
- Offspring results

Offspring must inherit visible traits from their parents.

---

# 8. AQUARIUM MANAGEMENT

Players must be able to:
- View their aquarium
- Select fish
- Inspect fish DNA
- Move fish into storage
- Move fish from storage into aquarium
- Upgrade aquarium capacity
- Decorate aquarium
- View fish growth
- Manage their collection

Implement configurable aquarium expansion costs and capacity.

Create smooth animations and clear interaction feedback.

---

# 9. FISH STORAGE AND INVENTORY

Implement persistent storage.

Required:
- Unique fish records
- Fish ownership
- DNA storage
- Rarity information
- Growth information
- Search
- Sorting
- Filters
- Storage upgrades
- Fish transfer
- Permanent fish release with confirmation

Inventory rules:
- Stackable items: maximum 999 per stack
- Limited items: separate slots
- Unique items: separate records

Use secure server-side inventory transactions.

---

# 10. PEARL ECONOMY

Main currency: PEARL

Implement:
- Pearl wallet
- Transaction ledger
- Pearl rewards
- Pearl spending
- Upgrade purchases
- Gacha spending
- Marketplace payments
- Auction escrow
- Sale proceeds
- Refund handling

All transactions must be atomic.

Prevent:
- Negative balances
- Double spending
- Currency duplication
- Replay attacks
- Concurrent transaction exploits

All economy parameters must be configurable.

---

# 11. GACHA SYSTEM

Gacha uses Pearl only.

Support:
- x1 roll
- x10 rolls
- x100 rolls
- x1000 rolls

Multi-roll discounts must be supported.

No pity system.

Seven rarity tiers:
- Common
- Uncommon
- Rare
- Epic
- Legendary
- Mythic
- Celestial

Implement:
- Server-side random generation
- Configurable rarity probabilities
- Configurable prices
- Bulk rolling
- Reward delivery
- Result animations
- Probability disclosure
- Transaction safety

Large batches must be efficient.

---

# 12. DUPLICATE RECYCLING

Implement duplicate recycling.

Rules:
- Recycle 10 eligible items of the same rarity
- Receive one non-tradable reward ticket
- Reward ticket produces an item of the same rarity or higher
- Server validates all items
- Items are consumed atomically
- Tickets cannot be duplicated

Monthly Limited reward rarity-specific chances:

Common: 0.001%
Uncommon: 0.005%
Rare: 0.010%
Epic: 0.025%
Legendary: 0.050%
Mythic: 0.100%
Celestial: 0.500%

These are Limited reward chances, not the complete main gacha rarity distribution.

Do not incorrectly normalize them as the seven main rarity probabilities.

---

# 13. PLAYER MARKETPLACE

Implement a real player-driven marketplace.

Listing types:

BUY NOW:
- Fixed price
- No listing expiration
- Seller can cancel an unsold listing

AUCTION:
- 6 hours
- 12 hours
- 24 hours
- 48 hours
- Optional Buyout price

Marketplace tax:
- 10% of completed sales

Marketplace slots:
- Start with 10
- Maximum 100
- Total upgrade cost to maximum: 796,000 Pearl

Design a configurable upgrade schedule that matches the confirmed total.

Marketplace features:
- Listing creation
- Listing cancellation
- Search
- Filters
- Sorting
- Item inspection
- Fish DNA preview
- Buy Now
- Auction bidding
- Buyout
- Seller information
- Sale history
- Item escrow
- Currency escrow
- Safe refunds
- Delivery notifications

Use database transactions and concurrency control.

Never allow two buyers to purchase the same item.

---

# 14. MONTHLY LIMITED COLLECTIONS

Implement monthly Limited rewards.

The current month's Limited collection is available through eligible online-time reward systems.

After the month ends, the collection moves into the historical All-Month Pool.

Historical months remain eligible according to game rules.

When choosing a historical month, use uniform random selection across eligible months.

Use Asia/Bangkok timezone.

Create:
- Monthly collection UI
- Historical collection browser
- Collection progress
- Reward tracking
- Claim history
- All-Month Pool

---

# 15. ONLINE REWARDS

Implement server-authoritative online time tracking.

Pearl rewards:
- Every 3 hours of eligible online time

Monthly Limited milestones:
- 24 hours
- 48 hours
- 100 hours
- 240 hours

Monthly progress resets based on Asia/Bangkok calendar months.

Implement:
- Online time display
- Milestone progress
- Claimable rewards
- Reward history
- Secure reward claiming
- Duplicate prevention

Support a 10-minute reconnection grace period under the established connection rules.

Do not award fabricated online time.

Maintenance time must never count.

Unclaimed monthly rewards remain permanently available in Reward Inbox.

---

# 16. REWARD INBOX

Implement permanent Reward Inbox.

Rules:
- No automatic expiration
- Secure claiming
- Claim individually
- Claim All
- Claim history
- Required selection handling
- Duplicate prevention

Claim All must not bypass mandatory reward selections.

---

# 17. DELIVERY INBOX

Create a separate Delivery Inbox.

Rules:
- Unlimited delivery records
- No expiration
- Secure item delivery
- Safe claiming
- Duplicate prevention

Use it for marketplace, auction, and system deliveries.

Never lose items because inventory is full.

---

# 18. OFFLINE AQUARIUM VIEW

If the connection is lost:

- Display the last cached aquarium
- Continue visual-only fish animation
- Show offline status
- Attempt automatic reconnection

Disable:
- Purchases
- Sales
- Bidding
- Breeding
- Reward claiming
- Persistent state changes

After reconnection:
- Authenticate
- Fetch authoritative server state
- Synchronize safely
- Resume interactions

Never overwrite server data with stale cached data.

---

# 19. MAINTENANCE MODE

During server maintenance:

- Show maintenance status
- Display cached aquarium
- Disable all transactions
- Disable persistent changes
- Disable online-time accumulation
- Show estimated return time only when officially available

Auction rules:

Pause auction countdowns during maintenance.

Resume each auction from its remaining duration when maintenance ends.

Preserve all bids and escrow.

---

# 20. USER ACCOUNTS

Implement:
- Registration
- Login
- Logout
- Secure password hashing
- Session management
- Player profile
- Account recovery mechanism
- Cloud save
- Database persistence
- Secure authentication

Do not rely on browser storage for authoritative ownership or currency.

---

# 21. REQUIRED GAME SCREENS

Create fully functional screens for:

1. Loading
2. Registration
3. Login
4. Main Aquarium
5. Fish Details
6. Fish Storage
7. Inventory
8. Breeding
9. Gacha
10. Marketplace
11. Buy Now
12. Auctions
13. Marketplace Upgrades
14. Online Rewards
15. Monthly Limited Collection
16. Historical Collections
17. Reward Inbox
18. Delivery Inbox
19. Aquarium Customization
20. Player Profile
21. Settings
22. Offline Aquarium
23. Maintenance Aquarium

Every button must perform a real action or be explicitly disabled with an explanation.

---

# 22. SECURITY

Implement:
- Authentication
- Authorization
- Input validation
- Rate limiting
- Secure random generation
- Transaction isolation
- Idempotent requests
- Ownership checks
- Auction concurrency protection
- Reward duplication protection
- Audit logging
- Secure environment variables

Test for:
- Item duplication
- Pearl duplication
- Double spending
- Unauthorized purchases
- Invalid bids
- Negative balances
- Timer manipulation
- Race conditions
- Reconnection exploits
- Maintenance exploits

---

# 23. PERFORMANCE

Optimize:
- Fish rendering
- Animation performance
- Network traffic
- Database queries
- Inventory rendering
- Marketplace pagination
- Large gacha batches
- Mobile performance
- Memory usage

Use adaptive quality settings when appropriate.

---

# 24. AUTOMATED TESTING

Create and run:
- Unit tests
- API integration tests
- Database tests
- Authentication tests
- Economy transaction tests
- Gacha tests
- DNA generation tests
- Breeding tests
- Marketplace concurrency tests
- Auction tests
- Online reward tests
- Reconnection tests
- Maintenance tests
- Browser end-to-end tests

Use Playwright or an equivalent browser testing framework.

Fix discovered bugs and rerun tests.

Never claim tests passed unless they actually ran.

---

# 25. AUTONOMOUS IMPLEMENTATION PHASES

PHASE 1:
Inspect the repository and initialize the project.

PHASE 2:
Build the frontend, backend, database, and authentication foundation.

PHASE 3:
Create the playable aquarium with procedural fish graphics and swimming animations.

PHASE 4:
Implement DNA, growth, storage, inventory, and breeding.

PHASE 5:
Implement Pearl economy, gacha, and recycling.

PHASE 6:
Implement marketplace, auctions, escrow, and deliveries.

PHASE 7:
Implement online rewards, monthly Limited collections, and reward inbox.

PHASE 8:
Implement offline recovery and maintenance mode.

PHASE 9:
Polish graphics, UI, animations, and performance.

PHASE 10:
Run automated tests, fix bugs, build production assets, and prepare deployment.

Do not stop after the first phase.

Continue as far as the available environment, time, and permissions allow.

---

# 26. REQUIRED PROJECT FILES

Create a complete project structure.

Include:
- frontend/
- backend/
- shared/
- database/
- assets/
- tests/
- scripts/
- docs/
- docker-compose.yml
- .env.example
- README.md
- DEVELOPMENT_PROGRESS.md
- GAME_RULES.md
- ECONOMY_BALANCE.md
- DEPLOYMENT.md

Adjust the structure when technically appropriate.

Create working scripts for:
- Dependency installation
- Local development
- Database migration
- Testing
- Production build
- Production startup

---

# 27. DELIVERY REQUIREMENTS

The game must not be considered complete until:

- Users can register and log in
- Player data persists
- Fish swim inside the aquarium
- Fish are procedurally generated
- DNA and growth function
- Breeding functions
- Inventory and storage function
- Pearl economy functions
- Gacha functions
- Marketplace functions
- Auctions function
- Online rewards function
- Monthly Limited rewards function
- Reward Inbox functions
- Delivery Inbox functions
- Offline Aquarium functions
- Maintenance Mode functions
- Responsive layouts work
- Security checks are implemented
- Production build succeeds
- Critical automated tests pass

If any requirement remains incomplete, document it accurately.

---

# 28. CONTINUOUS DEVELOPMENT AND GITHUB

Use the connected GitHub repository.

Commit completed, tested milestones where permitted.

Maintain DEVELOPMENT_PROGRESS.md with:
- Completed features
- Current phase
- Remaining tasks
- Known bugs
- Test results
- Next actions

If work is interrupted, resume from this progress file.

Do not discard previous work.

Do not overwrite existing working systems without checking their dependencies.

---

# 29. FINAL EXECUTION COMMAND

START IMPLEMENTING DREAM AQUARIUM NOW.

Do not respond with only a plan.

Do not generate only documentation.

Do not stop after creating a homepage.

Inspect the repository, create files, write working code, run tests, fix errors, and continue building the complete game.

Make all reasonable technical and design decisions autonomously.

Do not ask the owner to perform programming work.

If deployment credentials or external permissions are missing, prepare everything possible and clearly identify the minimum remaining authorization.

Your objective is to deliver the most complete, polished, secure, playable version of DREAM AQUARIUM possible.

**BEGIN DEVELOPMENT IMMEDIATELY.**
