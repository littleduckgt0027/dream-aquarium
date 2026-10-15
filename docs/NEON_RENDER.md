# Neon PostgreSQL + Render Free + GitHub Pages

เอกสารนี้แทนคำแนะนำ Render แบบเสียเงิน/Persistent Disk ในเอกสารรุ่นก่อน ไม่มีการ Deploy หรือย้ายข้อมูล Production โดยอัตโนมัติจากการแก้โค้ดนี้

## ข้อมูลและการทำงาน

- Backend อ่าน `DATABASE_URL` และใช้ PostgreSQL connection pool (เริ่มต้น 5 connections) ใช้ Neon pooled connection string ได้ ตรวจสอบ TLS certificate/hostname เสมอสำหรับ host ระยะไกล ไม่ใช้ `rejectUnauthorized: false` ไม่บันทึก URL ลง log
- Migration รันอัตโนมัติก่อนเปิด HTTP server และรันเองได้ด้วย `npm run db:migrate` มี version table และ transaction-scoped migration lock ไม่มี DROP หรือการล้างข้อมูล
- ตาราง: `users`, `sessions`, `listings`, `requests`, `lineage`, `audit`, `meta`, `schema_migrations` สถานะ JSON เดิมใน `users.state` เก็บปลา/DNA/ตู้ปลา/เงิน/Inventory/การผสมพันธุ์/รางวัล/Delivery/Collection/ledger/sales ครบ ไม่เปลี่ยนกฎเกมหรือสร้างบัญชีใหม่ให้ผู้เล่นเดิม
- Transaction ใช้ connection เดียวจน COMMIT/ROLLBACK และล็อกแถว maintenance ก่อนอ่านข้อมูล รองรับหลาย Process/หลาย Pool โดยรักษาการเรียงธุรกรรมแบบเดิม รวมการคืน escrow, ซื้อ, bid, buyout, claim, idempotency, recovery และ maintenance เป็นการล็อกทั้ง economy โดยตั้งใจ เหมาะกับเกมขนาดเล็ก ไม่ใช่ผลรับรองการรองรับผู้เล่นจำนวนมาก
- SQL ทั้งหมดส่งค่าด้วย parameters; request keys ถูกเก็บถาวรและ unique ต่อผู้เล่น คำขอล้มเหลว rollback ทั้งเงิน ทรัพย์สิน และ audit ไม่ retry ธุรกรรมที่ไม่ทราบผล COMMIT โดยอัตโนมัติ Client ใช้ key เดิมตรวจสอบ/ส่งซ้ำได้
- Render หยุด/Restart/Redeploy แล้วข้อมูลยังอยู่ที่ Neon Session เก็บเฉพาะ hash ใน DB ไม่เก็บข้อมูลสำคัญไว้เฉพาะ RAM ไฟล์ หรือ browser cache
- หน้าตู้ปลา Offline, reconnect แบบ view-only และ Maintenance Mode ตามกฎเดิมยังอยู่ ช่วง spin down ไม่ได้รับ online rewards และการประมูลที่หมดเวลาจะ settle เมื่อมี request/ticker หลังตื่น
- Per-IP rate limiter อยู่ใน RAM เป็นตัวควบคุม abuse เบื้องต้น ไม่ใช่สถานะผู้เล่น และจะ reset เมื่อ restart ต้องมี abuse controls เพิ่มก่อนเปิดเศรษฐกิจขนาดใหญ่

## Environment Variables ใน Render

| ชื่อ                | ค่า/วิธีตั้ง                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | **Secret**: Neon PostgreSQL pooled connection string จาก Neon Console เก็บใน Render เท่านั้น ใช้ SSL/TLS |
| `NODE_ENV`          | `production`                                                                                             |
| `DATABASE_POOL_MAX` | `5` (เลือกจำนวนเต็ม 1–20 ให้พอดีกับ quota ของ Neon)                                                      |
| `FRONTEND_ORIGIN`   | `https://littleduckgt0027.github.io` ไม่มี path หรือ slash ท้าย                                          |
| `PUBLIC_ORIGIN`     | HTTPS origin จริงของ Render service เช่นค่าที่ Render ออกให้ ไม่มี path/slash ท้าย                       |
| `COOKIE_SECURE`     | `true`                                                                                                   |
| `TRUST_PROXY_HOPS`  | `1` สำหรับ Render reverse proxy                                                                          |
| `PORT`              | Render จัดให้ Backend อ่านค่านี้ ไม่ต้องกำหนดเอง                                                         |
| `HOST`              | ไม่ต้องตั้ง ใช้ `0.0.0.0`                                                                                |

ห้ามตั้ง `DB_PATH` บน Render และห้ามใส่ `DATABASE_URL` ใน GitHub Pages, `VITE_*`, Actions variable, repository หรือ frontend bundle ไม่มี `SESSION_SECRET` ที่ต้องตั้ง: ระบบเดิมใช้ random session token 256-bit และ hash ในฐานข้อมูล ไม่ใช้ session store ใน RAM

Local/Windows ยังใช้ `DB_PATH` แบบเดิมได้เมื่อไม่ได้ตั้ง `DATABASE_URL` โดยต้องมีดิสก์ถาวร ห้ามใช้ local SQLite แทน Neon บน Render

## Authentication ข้าม GitHub Pages / Render

CORS อนุญาตเฉพาะ origin ที่ตั้งไว้และรองรับ preflight/Authorization/Idempotency-Key ไม่มี wildcard ระบบ Pages ใช้ Bearer token ใน `sessionStorage` ของ tab และส่ง `credentials: omit` ตามเดิม เพื่อใช้งานแม้ browser บล็อก third-party cookies การ refresh tab ยังล็อกอินต่อได้ ปิด tab แล้วให้ล็อกอินใหม่ Cookie สำหรับ same-origin เป็น HttpOnly/Secure/SameSite=Strict และ cross-origin production response ใช้ SameSite=None/Secure (frontend ปัจจุบันใช้ Bearer) Recovery เปลี่ยนรหัสและ revoke sessions ภายใน transaction เดียว และตรวจ session ซ้ำใน transaction ก่อนแก้ข้อมูล

## ย้ายข้อมูล SQLite เดิมก่อนเปิด Production

อย่าเริ่ม Neon ว่างแล้วให้ผู้เล่นสมัครใหม่หากยังมีข้อมูลเก่าอยู่:

1. สำรองข้อมูลเดิมนอก Render ให้เรียบร้อย เปิด maintenance บน Backend เดิม แล้วหยุด writers รวม scheduler และ operator commands ก่อน snapshot สุดท้าย
2. ใช้ `node scripts/backup.js backup NEW_BACKUP.sqlite` บนเครื่องเดิม (ไม่ตั้ง DATABASE_URL ในคำสั่ง backup SQLite) เครื่องมือใช้ online WAL backup และตรวจ integrity ห้ามคัดลอกเฉพาะ main SQLite file ขณะมี writers
3. สร้าง Neon database ปลายทางใหม่ที่ว่าง ตั้ง `DATABASE_URL` เป็น secret ของเครื่อง operator แล้วรัน `node scripts/import-sqlite.js NEW_BACKUP.sqlite` ทำขั้นตอนนี้ก่อนเริ่ม Render service
4. Import อ่านต้นฉบับแบบ read-only รวม WAL และตรวจ integrity/FK นำเข้าทุกตารางใน transaction เดียว รักษา listing ordering, serial IDs, sessions, request keys และ maintenance หากปลายทางมีข้อมูลแล้วจะปฏิเสธ หากมี case-insensitive username ซ้ำจะ rollback โดยไม่ลบ/รวมบัญชีเอง
5. ตรวจจำนวน records/ปลา/ยอดเงิน/escrow/บัญชีตัวอย่างด้วยสิทธิ์ operator ก่อนสลับ Backend สำรองต้นฉบับไว้ อย่ารัน Backend เดิมที่เขียนข้อมูลต่อหลัง snapshot เพราะจะมีข้อมูลแยกสองชุด
6. เมื่อเจ้าของอนุมัติ cutover จึงตั้งค่า Render ไปยัง Neon ที่นำเข้าแล้ว หาก snapshot อยู่ใน maintenance ให้รัน `node scripts/maintenance.js off` จากเครื่อง operator ที่ตั้ง DATABASE_URL เดียวกัน เวลา auction จะขยายตามระยะ maintenance จริง

ไม่ overwrite หรือ merge ปลายทางอัตโนมัติ ไม่รัน import ตอน server startup หาก import ล้มเหลวให้แก้สาเหตุและใช้ปลายทางว่างเดิมที่ rollback แล้ว ตรวจ log โดยไม่เผยแพร่ credentials

## Deploy เมื่อเจ้าของอนุมัติ

1. Review/Merge PR ตามกระบวนการของเจ้าของ Repository (main มี Pages deploy workflow จึงอาจเผยแพร่เว็บเมื่อ merge)
2. สร้าง Neon Free project/database ใน region ใกล้ Render เก็บ connection string ส่วนตัวและเตรียม backup ตาม quota/retention ของบัญชี Free ไม่พึ่ง Render disk
3. หากมีข้อมูลเก่า ให้ทำขั้นตอน import ด้านบนก่อนเปิด Render
4. Render: New Blueprint จาก repo นี้และ `render.yaml` หรือ New Web Service → Docker → Free ไม่มี disk ตั้ง variables ตามตาราง ปิด Auto Deploy (`autoDeployTrigger: off` ใน blueprint) แล้ว Deploy ด้วยตนเองเมื่ออนุมัติ Migration จะรันก่อน server รับ traffic
5. ตรวจ `https://<Render-host>/api/health`: HTTP 200, `application=dream-aquarium`, `database=ready`, `databaseEngine=postgresql`; เมื่อ DB ใช้งานไม่ได้ต้องได้ 503 ทดลองบัญชีทดสอบเฉพาะเมื่อยอมรับการสร้างข้อมูลทดสอบแล้ว
6. GitHub Repository → Settings → Secrets and variables → Actions → **Variables** ตั้ง `PRODUCTION_API_URL` เป็น HTTPS origin จริงของ Render ห้ามใส่ `/api` หรือ slash/path/query ไม่มี secret ในค่านี้
7. Settings → Pages → Source = GitHub Actions จากนั้นเมื่ออนุมัติการเผยแพร่ จึงรัน workflow `Deploy GitHub Pages frontend` หรือ push main Workflow ตรวจ Backend จริงพร้อม CORS/PostgreSQL (retry เพื่อรอ cold start), รัน unit tests และ PostgreSQL tests ก่อน build ด้วย `VITE_BASE=/dream-aquarium/` และ `VITE_API_URL` จาก repository variable หากตรวจไม่ผ่านจะไม่ publish
8. หน้าเกมอยู่ที่ `https://littleduckgt0027.github.io/dream-aquarium/` ทดสอบ login/refresh/reconnect/logout/recovery จาก browser จริง รวม browser ที่บล็อก third-party cookies

Render Free และ Neon Free มี sleep/compute/storage/bandwidth limits และอาจเปลี่ยนนโยบายได้ ตรวจว่าเลือก Free จริงก่อนสร้าง service ไม่มี uptime guarantee ช่วง cold start เกมแสดงตู้ปลาที่ cache ไว้และปิด writes จนเชื่อมต่อได้

## Backup และไฟล์ถาวร

ใช้ Neon backup/restore ตามสิทธิ์ของแผน และ export แบบเข้ารหัสไปที่เก็บนอกระบบเป็นระยะด้วย `pg_dump` (แนะนำ direct connection ของ Neon สำหรับงานดูแลฐานข้อมูล) ใช้ libpq `sslmode=verify-full` เก็บ credentials ใน secret/ไฟล์ credentials ที่ป้องกันไว้ ทดสอบ `pg_restore` ไปยังฐานข้อมูลทดสอบใหม่ ห้าม restore ทับ production โดยไม่มีอนุมัติ คำสั่ง `scripts/backup.js` รองรับ SQLite เท่านั้นและปฏิเสธเมื่อกำหนด DATABASE_URL เพื่อไม่สร้าง backup ผิดฐาน

ตรวจโค้ดแล้วไม่มี endpoint อัปโหลดรูปหรือไฟล์จากผู้เล่น ปลาเป็น procedural Canvas จาก DNA รูป static/PWA อยู่ใน Git และ GitHub Pages ภาพใน docs เป็น screenshots ทดสอบ จึงยังไม่ต้องใช้ Object Storage สำหรับเกมเดิม หากเพิ่ม avatars/uploads ต้องใช้ S3-compatible storage เช่น Cloudflare R2 หรือ Supabase Storage พร้อม access controls และ lifecycle policy ห้ามเก็บถาวรใน Render filesystem คีย์ storage ต้องอยู่ Backend เท่านั้น และต้องตรวจ quota/ราคาอีกครั้ง

## ทดสอบในเครื่อง/CI

ต้องใช้ Node 24:

```sh
npm ci
npm test
npm run build
npm run test:e2e
npm run test:pages
```

ตั้ง `TEST_DATABASE_URL` ให้ชี้ PostgreSQL ทดสอบแยกจาก Production แล้วรัน `npm run test:postgres` Tests สร้าง schema ชื่อสุ่ม `dream_test_*` และลบเฉพาะ schema ที่ตนสร้างเมื่อจบ ต้องมีสิทธิ์ CREATE SCHEMA ห้ามใช้ connection ของฐานข้อมูลจริง ใน CI ใช้ PostgreSQL 17 service ชั่วคราว; trust authentication อนุญาตเฉพาะฐานข้อมูลทดสอบนี้ ไม่ใช่ค่าตั้ง Production

Tests ครอบคลุม migration ซ้ำ, read/write, restart process, session/key persistence, หลาย API instances, double purchase/idempotency, bids/refunds/settlement, rollback, import สำเร็จ/ล้มเหลว, maintenance, TLS configuration, readiness failure และ connection recovery ดูผลทดสอบที่ทำจริงและข้อจำกัดใน `docs/POSTGRES_VALIDATION.md` หากไม่มี TEST_DATABASE_URL ชุด PostgreSQL integration จะ skip อย่างชัดเจน และ `test:postgres` จะ fail เมื่อไม่กำหนด URL
