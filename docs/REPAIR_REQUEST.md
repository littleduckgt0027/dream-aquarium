# MASTER PROMPT — DREAM AQUARIUM
## FULL AUTO REPAIR, WINDOWS LAUNCHER & GITHUB DEPLOYMENT

คุณคือ Senior Full-Stack Game Developer, DevOps Engineer, QA Engineer และ Security Engineer ที่รับผิดชอบโปรเจกต์ Dream Aquarium ตั้งแต่ต้นจนจบ

**ภารกิจหลัก:** ตรวจสอบ ซ่อมแซม ปรับปรุง ทดสอบ และ Deploy เกม Dream Aquarium ให้สามารถเปิดเล่นผ่านเว็บไซต์ออนไลน์ได้จริง พร้อมสร้างเวอร์ชัน Windows สำหรับเปิดเล่นในเครื่อง

ทำงานให้สำเร็จด้วยตัวเองให้มากที่สุด โดยไม่ต้องถามฉันทีละขั้นตอน

---

## PHASE 1 — PROJECT AUDIT

1. ตรวจสอบโครงสร้างไฟล์ทั้งหมดของ Dream Aquarium
2. ตรวจสอบ Frontend, Backend, Database, API และ Dependencies
3. ตรวจสอบ package.json, Build Scripts และ Environment Variables
4. ตรวจสอบระบบ Authentication, Session และ Data Persistence
5. ค้นหา Missing Files, Broken Imports, Runtime Errors และ Build Errors
6. ตรวจสอบว่าระบบที่สร้างไว้ก่อนหน้านี้ครบถ้วนหรือไม่
7. รักษาระบบเกมเดิมทั้งหมด ห้ามลบฟีเจอร์เพื่อแก้ปัญหาให้ผ่านแบบชั่วคราว
8. สร้างรายการปัญหาที่ตรวจพบและแก้ไขตามลำดับความสำคัญ

หากพบข้อผิดพลาด ให้แก้ไขและทดสอบซ้ำโดยอัตโนมัติ

## PHASE 2 — WINDOWS ONE-CLICK LAUNCHER

สร้างระบบเปิดเกมบน Windows ที่ใช้งานง่ายที่สุด

1. สร้าง START-GAME.bat ที่โฟลเดอร์หลัก
2. ตรวจสอบ Node.js และ Dependencies ที่จำเป็น
3. ติดตั้ง Dependencies ที่ขาดโดยอัตโนมัติเมื่อทำได้
4. เริ่ม Backend และ Frontend ตามลำดับที่ถูกต้อง
5. รอจนเซิร์ฟเวอร์พร้อมใช้งาน
6. เปิด Default Browser ไปยังหน้าเกมโดยอัตโนมัติ
7. แสดง Error Message ที่เข้าใจง่ายเมื่อเปิดเกมไม่สำเร็จ
8. ป้องกันการเปิดเซิร์ฟเวอร์ซ้ำโดยไม่จำเป็น
9. สร้างไฟล์ STOP-GAME.bat เพื่อปิดเซิร์ฟเวอร์ของเกม
10. ตรวจสอบการทำงานบน Windows

เป้าหมายคือให้ผู้ใช้แตกไฟล์ ZIP แล้วดับเบิลคลิก START-GAME.bat เพื่อเปิดเกมได้ โดยไม่ต้องพิมพ์คำสั่งเอง หลังจากติดตั้งข้อกำหนดเบื้องต้นที่จำเป็นแล้ว

## PHASE 3 — GITHUB REPOSITORY

เตรียมโปรเจกต์สำหรับ GitHub

1. ตรวจสอบ Git Repository เดิมก่อน
2. หากมี Repository อยู่แล้ว ให้ใช้ Repository เดิม
3. หากไม่มี ให้เตรียม Repository ชื่อ dream-aquarium
4. สร้าง .gitignore ที่เหมาะสม
5. ห้าม Commit node_modules, .env, Passwords, Tokens หรือ Secrets
6. จัดโครงสร้างโปรเจกต์ให้เหมาะกับการพัฒนาและ Deploy
7. สร้าง README.md อธิบายวิธีใช้งาน
8. เตรียม GitHub Actions Workflow
9. Commit และ Push โค้ดเมื่อได้รับสิทธิ์ GitHub ที่จำเป็น
10. ห้าม Force Push หรือเขียนทับข้อมูลเดิมโดยไม่จำเป็น

## PHASE 4 — GITHUB PAGES FRONTEND

Deploy Frontend ของ Dream Aquarium ผ่าน GitHub Pages

1. ตรวจสอบ Framework ที่โปรเจกต์ใช้อยู่
2. ปรับ Frontend ให้รองรับ Static Production Build
3. ตั้งค่า Base URL และ Asset Paths
4. แก้ไข Routing ให้รองรับ GitHub Pages
5. สร้าง GitHub Actions สำหรับ Build และ Deploy
6. ตั้งค่า Deployment ให้ทำงานเมื่อ Push ไปยัง Branch หลัก
7. ตรวจสอบว่า CSS, JavaScript, Images, Fonts และ Game Assets โหลดได้ครบ
8. ตรวจสอบ Console Errors และ Network Errors
9. รองรับ Desktop, Tablet และ Mobile
10. ทดสอบหน้าเกมจริงหลัง Deploy

URL เป้าหมาย:

https://GITHUB_USERNAME.github.io/dream-aquarium/

ใช้ชื่อผู้ใช้ GitHub จริงที่ได้รับจากระบบ ห้ามสมมติว่ามี Repository หรือ URL ใช้งานได้แล้ว

## PHASE 5 — ONLINE BACKEND & DATABASE

Dream Aquarium เป็นเกมออนไลน์ที่มีข้อมูลผู้เล่น จึงต้องมี Backend และ Database ที่ใช้งานจริง

1. ตรวจสอบ Backend และ Database ที่มีอยู่
2. รักษา Business Logic เดิมทั้งหมด
3. เลือกบริการ Hosting ที่รองรับเทคโนโลยีของโปรเจกต์
4. ให้ความสำคัญกับ Free Tier ที่เหมาะสม
5. ห้ามเลือกบริการที่ทำให้ข้อมูลสำคัญสูญหายเมื่อ Restart
6. ตั้งค่า Environment Variables อย่างปลอดภัย
7. เชื่อม Frontend กับ Backend ผ่าน HTTPS
8. ตั้งค่า CORS ให้ถูกต้อง
9. ตรวจสอบ Authentication และ Session Persistence
10. จัดทำ Database Migrations
11. ตรวจสอบการบันทึกและโหลดข้อมูลผู้เล่น
12. ตรวจสอบการทำงานพร้อมกันของผู้เล่นหลายคน
13. ป้องกัน Duplicate Transactions และ Race Conditions
14. ตรวจสอบ Rate Limiting และ Input Validation
15. สร้าง Health Check Endpoint
16. เตรียม Backup และ Recovery ตามความสามารถของ Hosting

ห้ามนำ Database Credentials หรือ Secret Keys ไปไว้ใน Client Code

หากต้องใช้บริการภายนอกที่ยังไม่ได้เชื่อมต่อ ให้เตรียมทุกอย่างที่ทำได้ก่อน แล้วแจ้งเฉพาะขั้นตอนยืนยันสิทธิ์ที่ฉันจำเป็นต้องทำ

## PHASE 6 — GAME SYSTEM VERIFICATION

ตรวจสอบระบบเกม Dream Aquarium ทั้งหมดที่มีอยู่ในโปรเจกต์ รวมถึง:

- สมัครสมาชิกและเข้าสู่ระบบ
- บันทึกข้อมูลผู้เล่น
- ระบบตู้ปลา
- ระบบปลาและการเติบโต
- ระบบเงินและเศรษฐกิจ
- ระบบร้านค้า
- ระบบตลาดผู้เล่น
- ระบบประมูล
- ระบบรางวัล
- ระบบออนไลน์และออฟไลน์
- ระบบ Connection Recovery
- ระบบ Auto Reconnect
- ระบบ Maintenance Aquarium Mode
- ระบบ Cache และ Data Synchronization

ใช้กฎเกมและข้อกำหนดที่ตกลงไว้ก่อนหน้านี้เป็นหลัก ห้ามเปลี่ยนสมดุลเกมหรือกฎธุรกิจโดยไม่จำเป็น

ต้องรักษาหลัก Server Authoritative สำหรับข้อมูลสำคัญ เช่น เงิน ไอเทม ปลา การซื้อขาย และการประมูล

### Offline & Maintenance Rules

เมื่อผู้เล่นหลุดการเชื่อมต่อ:
- เปิด Offline Aquarium View จากข้อมูล Cache ล่าสุด
- สามารถดูตู้ปลาได้
- ห้ามทำธุรกรรมหรือแก้ไขข้อมูลเกม
- พยายาม Auto Reconnect
- เมื่อเชื่อมต่อกลับมา ให้ Synchronize ข้อมูลจาก Server

เมื่อ Server Maintenance:
- แสดง Maintenance Aquarium Mode
- แสดงตู้ปลาจาก Cache ล่าสุด
- ห้ามทำธุรกรรมหรือแก้ไขข้อมูล
- ห้ามนับเวลาออนไลน์ระหว่าง Maintenance
- แสดงเวลาคาดว่าจะเปิดบริการเฉพาะเมื่อมีประกาศจริง
- หยุดเวลาประมูลชั่วคราวระหว่าง Maintenance
- เมื่อกลับมาออนไลน์ ให้ดำเนินการประมูลต่อจากเวลาที่เหลือ
- ป้องกันการทำธุรกรรมซ้ำหลัง Reconnect

## PHASE 7 — AUTOMATED TESTING

สร้างและรัน Automated Tests

1. Unit Tests สำหรับ Game Logic
2. Integration Tests สำหรับ Backend และ Database
3. API Tests
4. Authentication Tests
5. Database Persistence Tests
6. Transaction Consistency Tests
7. Auction Timer Tests
8. Offline / Reconnect Tests
9. Maintenance Mode Tests
10. Production Build Tests
11. Browser End-to-End Tests
12. Responsive Layout Tests
13. Basic Security Tests
14. Multi-user Concurrency Tests
15. Windows Launcher Tests

หาก Test ล้มเหลว:
- วิเคราะห์สาเหตุ
- แก้ไขโค้ด
- ทดสอบซ้ำ
- บันทึกผล

ห้ามรายงานว่าผ่านหากยังไม่ได้ทดสอบจริง

## PHASE 8 — PRODUCTION DEPLOYMENT

ดำเนินการ Deploy ระบบจริงตามลำดับ

1. Build Frontend
2. Run Automated Tests
3. Prepare Production Database
4. Deploy Backend
5. Verify Backend Health
6. Configure Production API URL
7. Deploy Frontend to GitHub Pages
8. Verify Public HTTPS URL
9. Test Login and Gameplay
10. Test Database Persistence
11. Test Multiple Users
12. Test Mobile Browser
13. Test Refresh and Reconnect
14. ตรวจสอบว่าไม่มี Secret หลุดออกไปใน Production Build

หากขั้นตอนใดไม่สามารถทำได้เพราะขาดสิทธิ์หรือบัญชี ให้บันทึกเป็น Blocker และทำงานส่วนอื่นต่อ

ห้ามอ้างว่าเกมออนไลน์แล้วหากยังไม่ได้ตรวจสอบ Public URL จริง

## PHASE 9 — FINAL WINDOWS PACKAGE

สร้าง ZIP เวอร์ชันใหม่ที่พร้อมใช้งาน

ชื่อไฟล์:
dream-aquarium-windows.zip

ภายในประกอบด้วย:
- Source Code ที่จำเป็น
- START-GAME.bat
- STOP-GAME.bat
- Configuration Templates
- Installation Instructions
- README.md
- Dependencies Manifest
- Documentation

ห้ามรวม Secrets หรือข้อมูลส่วนตัวลงใน ZIP

ทดสอบการแตกไฟล์และเปิดเกมจากโฟลเดอร์ใหม่เมื่อสภาพแวดล้อมรองรับ

## PHASE 10 — FINAL REPORT

เมื่อทำงานเสร็จ ให้รายงาน:

1. GitHub Repository URL
2. GitHub Pages URL
3. Backend URL
4. Database Service ที่ใช้
5. ผลการทดสอบแต่ละประเภท
6. ระบบที่แก้ไข
7. ระบบที่ยังมีข้อจำกัด
8. ไฟล์ ZIP สำหรับ Windows
9. ขั้นตอนที่เจ้าของเกมยังต้องดำเนินการ
10. สถานะ Production Deployment จริง

แยกสถานะเป็น:
- COMPLETED
- TESTED
- DEPLOYED
- BLOCKED
- NOT VERIFIED

ห้ามใช้ COMPLETED หรือ DEPLOYED กับงานที่ยังไม่สำเร็จจริง

---

# AUTONOMOUS EXECUTION RULES

1. ทำงานต่อเนื่องด้วยตัวเองให้มากที่สุด
2. ไม่ต้องถามคำถามย่อยที่สามารถตัดสินใจได้เอง
3. เลือกแนวทางที่เสถียร ปลอดภัย และบำรุงรักษาง่าย
4. รักษาฟีเจอร์และข้อมูลเดิมทั้งหมด
5. ห้ามลบระบบเกมเพื่อหลีกเลี่ยงข้อผิดพลาด
6. ห้ามใช้ Mock Data แทนระบบ Production จริงโดยไม่ระบุ
7. ห้ามสร้างผลทดสอบหรือ URL ปลอม
8. ห้ามเผยแพร่ Secrets
9. ห้ามซื้อบริการหรือยอมรับค่าใช้จ่ายโดยไม่ได้รับอนุญาต
10. เมื่อพบ Blocker ให้ดำเนินงานส่วนอื่นที่ทำได้ต่อ
11. ทำงานเป็นลำดับ Phase โดยไม่ต้องรอคำสั่งใหม่ระหว่าง Phase
12. หากต้องได้รับอนุญาตจาก GitHub หรือ Hosting Provider ให้แจ้งขั้นตอนยืนยันอย่างชัดเจน
13. หากเครื่องมือไม่สามารถทำงานต่อได้จริง ให้รายงานสิ่งที่ทำสำเร็จและสิ่งที่ยังค้างโดยไม่กล่าวอ้างว่าเสร็จแล้ว

# FINAL OBJECTIVE

Dream Aquarium ต้องมีผลลัพธ์สองแบบ:

**A. ONLINE VERSION**

ผู้เล่นเปิดเว็บไซต์ผ่าน GitHub Pages ได้จากทุกที่ ใช้งานระบบออนไลน์และฐานข้อมูลจริงได้ โดยเจ้าของเกมไม่ต้องเปิดคอมพิวเตอร์ทิ้งไว้

**B. WINDOWS VERSION**

เจ้าของเกมสามารถแตกไฟล์ ZIP และเปิดเกมด้วย START-GAME.bat ได้อย่างง่ายดาย

เริ่มดำเนินการตรวจสอบโปรเจกต์ปัจจุบันทันที และทำงานต่อเนื่องจนเสร็จทุกขั้นตอนที่เครื่องมือและสิทธิ์อนุญาต

DO NOT STOP AFTER PLANNING. IMPLEMENT, TEST, FIX AND DEPLOY WHERE ACCESS IS AVAILABLE.
