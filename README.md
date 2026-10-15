# Dream Aquarium

เกมตู้ปลาออนไลน์แบบ full-stack: เลี้ยงปลาที่มี DNA เฉพาะตัว ผสมพันธุ์ สุ่มปลา ซื้อขายและประมูลด้วย Pearl พร้อมบันทึกข้อมูลในฐานข้อมูลจริง

## เปิดเล่นบนเครื่องตัวเองแบบง่าย

1. ติดตั้ง **Node.js 24 LTS**
2. ดาวน์โหลดโฟลเดอร์โปรเจกต์นี้
3. Windows: ดับเบิลคลิก `scripts/start-game.bat` แล้วรอข้อความเริ่มเซิร์ฟเวอร์
4. Mac/Linux: รัน `bash scripts/start-game.sh`
5. พิมพ์ `localhost:3000` ในเบราว์เซอร์ของเครื่องนั้น สมัครบัญชี แล้วเก็บ recovery code ไว้ในที่ปลอดภัย

ไม่ต้องเขียนโค้ดหรือสมัครฐานข้อมูลภายนอก สคริปต์จะติดตั้ง dependencies และ build เกมให้ ต้องใช้อินเทอร์เน็ตครั้งแรก เปิดหน้าต่างเซิร์ฟเวอร์ค้างไว้ขณะเล่น Windows launcher จัดเตรียมไว้ แต่ไม่ได้ทดสอบบน Windows ในเซสชันนี้

**สถานะลิงก์ออนไลน์:** ยังไม่ได้ deploy สู่โฮสต์สาธารณะ ไม่มี URL ออนไลน์ที่ยืนยันแล้ว เซิร์ฟเวอร์ที่รันใน workspace นี้เป็นคนละเครื่องกับคอมพิวเตอร์ของคุณ โปรดอย่าเข้าใจว่า localhost ของคุณเชื่อมไปยังเครื่องนี้ได้

## Docker

หากมี Docker Desktop ใช้คำสั่งเดียวจากโฟลเดอร์โปรเจกต์:

```sh
docker compose up --build -d
```

จากนั้นเปิด `localhost:3000` บนเครื่องที่รัน Docker ข้อมูลอยู่ใน volume `aquarium-data` และยังคงอยู่เมื่อ restart อย่าใช้ `docker compose down -v` หากต้องการเก็บปลา

## วิธีเล่น

- เริ่มด้วยปลาโตเต็มวัย 5 ตัว และ 3,000 Pearl
- Aquarium: ดูปลาว่าย คลิกปลาหรือการ์ดเพื่อดู DNA และสายพันธุ์
- Fish storage: ค้นหา เรียง กรอง ย้ายเข้าตู้หรือเก็บในคลัง เพิ่มความจุ และรีไซเคิลปลา 10 ตัวระดับเดียวกัน
- Breeding: เลือกพ่อแม่โตเต็มวัย 2 ตัว จ่าย 200 Pearl รอ 2 นาที แล้วรับลูกปลา
- Discovery: สุ่ม ×1/×10/×100/×1000 ตามพื้นที่คลังและยอด Pearl ที่มี
- Marketplace: ตั้งราคาขายหรือประมูลกับผู้เล่นบัญชีอื่น ซื้อปลาแล้วไปรับที่ Delivery Inbox
- Online rewards: เปิดแท็บเกมไว้เพื่อสะสมเวลาที่เซิร์ฟเวอร์ตรวจสอบได้ รางวัลอยู่ใน Reward Inbox
- Monthly collection: รางวัล Limited ตามเดือนกรุงเทพฯ และประวัติเดือนเก่า
- Customize: เปลี่ยนน้ำ ตกแต่งต้นไม้/ซากโบราณ และขยายตู้
- Profile: ดูบัญชีและประวัติ Pearl / ออกจากระบบ
- เก็บ recovery code ตอนสมัคร หากลืมรหัสผ่านใช้ Recover account บนหน้าล็อกอิน

## Developer commands

Requires Node 24 (built-in `node:sqlite`) and npm. SQLite uses WAL + `BEGIN IMMEDIATE`; run one application instance with a durable local disk. No Redis, external database, graphics CDN or API key required.

```sh
npm ci
npm run db:migrate
npm run dev
npm test
npm run build
COOKIE_SECURE=false npm start
npm run test:e2e
```

`npm run dev` provides Vite middleware + API on port 3000. Production startup serves `dist/`. Windows equivalent: set `COOKIE_SECURE=false` in the process environment before `npm start`. `.env.example` documents options; `.env` is not automatically loaded. Use `node --env-file=.env backend/server.js --production` after building to load it explicitly.

Playwright configuration uses `/usr/bin/chromium` in this cloud workspace. On another machine, install Chromium with `npx playwright install chromium` and set `CHROMIUM_PATH` to the executable, or set that configuration's `executablePath` to `undefined` to use Playwright's managed browser. Browser test database: `/tmp/dream-e2e.sqlite`, separate from real player data. Tests use unique usernames and retain no real passwords or credentials.

See [GAME_RULES.md](GAME_RULES.md), [ECONOMY_BALANCE.md](ECONOMY_BALANCE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md), and [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md).

## Architecture

- `frontend/`: React UI, responsive design, deterministic Canvas fish renderer, swimming, offline shell/service worker.
- `backend/`: Express API, account sessions, SQLite schema/migrations, game transactions and auction scheduler.
- `shared/`: configurable economy probabilities, prices and calendar rules.
- `tests/`: unit, database, API/security/concurrent purchase, and Chromium end-to-end tests.
- `scripts/`: one-step launch and maintenance administration.
- `data/`: ignored live database, created on first run. Back it up; do not commit it.
- `assets/`: licensing notes for generated graphics.

The server is authoritative for balances, fish ownership, DNA, timers, auction escrow and online rewards. Browser caching is visual only. All mutating game requests need an idempotency key. Passwords use salted scrypt; recovery codes are hashed; sessions use hashed random tokens and HttpOnly/SameSite cookies. See deployment documentation before making the service publicly accessible.
