# Google Sheets สำหรับ Science Learning Hub — ปีการศึกษา 2569

รอบนี้ต่อยอดเว็บเดิม ไม่ได้เปิดใช้ Supabase หรือสร้างเครื่องมือเรียนใหม่ บัญชี คะแนน และประวัติอยู่ใน Google Sheets ส่วนตัว ส่วน GitHub Pages มีเฉพาะโค้ดเว็บและ URL ของ Apps Script

## ตรวจระบบเดิมก่อนแก้ (22 ตุลาคม 2026)

| ส่วน | สิ่งที่มีอยู่ | ช่องว่างที่ต่อเพิ่ม |
| --- | --- | --- |
| บัญชี | `index.html`: `USERS`, `SESSION`, `bindGlobal` มีบัญชีสาธิต ตรวจใน browser | ตรวจบัญชีจริงและบทบาทผ่าน Apps Script |
| ความคืบหน้า | `index.html`: `pkey`, `getP`, `saveP`, `UNSAVED_PROGRESS` | คง synchronous API, return value และ localStorage เดิม |
| เกม 1–3 | `assets/games/engine.js` และ `gameAPI` เก็บ state, attempts, done | ส่งผลการประเมินแต่ละครั้ง ไม่มีการเพิ่มเกณฑ์คะแนนใหม่ |
| แบบฝึก | `index.html` เก็บ e1–e3; `assets/exercises/onet-practice.js` เก็บ O-NET แยก | ส่งผลทุกระดับและ O-NET |
| Simulation | `assets/simulations/engine.js` เก็บค่าตัวควบคุม/การทดลอง | เก็บผลคำนวณด้วย ไม่สร้างคะแนนหรือเงื่อนไขผ่านใหม่ |
| สอบ | `index.html` แยก `last`/`best` แล้ว แต่เก็บประวัติ 10 ครั้ง | เก็บประวัติใหม่ทั้งหมดพร้อม ID ป้องกันส่งซ้ำ |
| Dashboard | `assets/dashboard/dashboard.js` มีหน้าสรุปของตนเอง | เพิ่มส่วนครูในหน้าเดิมเฉพาะบัญชี Teacher/Admin |
| ฐานข้อมูลเดิม | `preparation/`, `supabase/`, `docs/database-preparation/` เป็นงานเตรียมที่ไม่ต่อ production | เก็บไว้ทั้งหมด ไม่เปิดใช้งานซ้อนกับ Sheets |

คง IDs บทเรียนและกิจกรรม, key `slh_v163_<encodeURIComponent(username)>_<lessonId>`, fallback `slh_v162_` เฉพาะบัญชีสาธิตเดิม, resume, ข้อสอบที่กำลังทำ, XP แบบค่าสูงสุดต่อบท, แบบฝึกผ่านเมื่อถูกครบ และสอบผ่านที่ 60% การสอบครั้งใหม่ที่คะแนนต่ำลงไม่ล้างการผ่านหรือคะแนนสูงสุดเดิม

## ข้อมูลบัญชีที่ตรวจแล้ว

อ่านโครงสร้างจากไฟล์ Excel ที่ผู้ใช้ส่งมาโดยไม่คัดลอกข้อมูลบัญชีเข้า repository: `Students` มี 907 Username ไม่ซ้ำ ปี 2569 ชั้น 1–3 และ `Staff` มีบัญชี `watcharapon` พร้อมบทบาท `teacher`, `admin` อยู่แล้ว สถานะบัญชีครูในต้นฉบับคือ `เตรียมข้อมูล` ซึ่งรองรับตามคำขอใช้บัญชีเดิม การตรวจไฟล์นี้ยังไม่ใช่การยืนยันเนื้อหาหรือสิทธิ์ของชีตออนไลน์

ชีตหลักตามลิงก์ใหม่ของผู้ใช้:

[เปิด Google Sheets บัญชีและคะแนน](https://docs.google.com/spreadsheets/d/1shigRDfR_Gh4pejwKjh5iW9UDnLFHoMz-bcZozVdGg8/edit?gid=960657473)

ผู้ใช้ยืนยันว่าแปลงเป็น Google Sheets แล้ว เก็บ `Students`, `Staff`, `Summary`, `READ_ME` เดิมไว้ทั้งหมด ห้าม Publish to web หรือแบ่งปันชีตบัญชีให้นักเรียน ครูเจ้าของ script เป็นผู้เข้าถึงชีต นักเรียนเข้าเว็บไซต์ด้วยบัญชีของตนเอง

## ไฟล์โค้ด

- [Code.gs](../integrations/google-sheets/Code.gs): คัดลอกทั้งไฟล์ไปวางใน Apps Script
- [appsscript.json](../integrations/google-sheets/appsscript.json): manifest ของ Apps Script
- [sheets-config.js](../assets/integrations/sheets-config.js): ตั้ง URL `/exec` ที่เว็บเรียก
- [sheets-client.js](../assets/integrations/sheets-client.js): login, คิวผลกิจกรรม, ส่งซ้ำด้วย ID เดิม
- [teacher-dashboard.js](../assets/integrations/teacher-dashboard.js): ตัวกรองและประวัติสอบรายคน

## ติดตั้ง Apps Script

1. เปิดชีตใหม่ด้านบน เลือก **Extensions → Apps Script** ที่ผู้ใช้เปิดไว้แล้ว วางเนื้อหาทั้งหมดจาก `integrations/google-sheets/Code.gs` ใน `Code.gs` แล้ว Save หาก project มีโค้ดเดิมที่ใช้งานอยู่ให้เก็บสำเนาไว้ก่อน และตรวจไม่ให้มี `doGet`/`doPost` ชื่อซ้ำ
2. ใน **Project Settings → Script properties → Add script property** ตั้งค่าตารางด้านล่าง ค่าเหล่านี้อยู่ฝั่ง Apps Script ไม่ใส่ใน JavaScript สาธารณะ
3. เลือกฟังก์ชัน `inspectSetup` กด Run และอนุญาตด้วยบัญชีเจ้าของชีต ตรวจ Execution log ว่านักเรียนครบ 907 บัญชี จากนั้นเลือก `setup` แล้วกด Run เพื่อสร้างชีตระบบ ดูรายละเอียดด้านล่าง
4. เลือก **Deploy → New deployment → Web app**, **Execute as: Me**, **Who has access: Anyone** แล้ว Deploy ระบบใช้ username/password ของโรงเรียนตรวจสิทธิ์ภายใน `doPost` การเข้าถึง URL ได้ไม่ได้ทำให้อ่านคะแนนได้เอง หาก Workspace ไม่อนุญาต Anyone ต้องให้ผู้ดูแลเปิด deployment ที่เหมาะสมก่อน ไม่แก้ชีตให้สาธารณะเพื่อข้ามข้อจำกัด
5. คัดลอก **Web app URL** รูปแบบ `https://script.google.com/macros/s/…/exec` มาใส่ `endpoint` ใน `assets/integrations/sheets-config.js` แล้ว build/deploy เว็บไซต์ตาม workflow เดิม URL ของ Google Sheets และ URL `/dev` ใช้แทนไม่ได้
6. เมื่อแก้ Code.gs ภายหลัง ใช้ **Deploy → Manage deployments → Edit → New version → Deploy** โดยใช้ deployment เดิมเพื่อคง URL

Google อธิบายการ deploy และสิทธิ์การ execute ใน [Web Apps](https://developers.google.com/apps-script/guides/web) ส่วน [Content Service](https://developers.google.com/apps-script/guides/content) คืน JSON ผ่าน redirect ไป `script.googleusercontent.com` ตัว client จึงใช้ POST แบบ `text/plain` และตาม redirect ต้องทดสอบจากโดเมน GitHub Pages จริงด้วย ไม่ใช้ `no-cors` เพราะจะอ่านผลยืนยันบันทึกไม่ได้

| Script property | ค่า |
| --- | --- |
| `SLH_SPREADSHEET_ID` | `1shigRDfR_Gh4pejwKjh5iW9UDnLFHoMz-bcZozVdGg8` |
| `SLH_STUDENTS_SHEET` | `Students` |
| `SLH_STAFF_SHEET` | `Staff` |

ปีการศึกษา `2569` กำหนดใน `Code.gs` อยู่แล้ว ไม่ต้องเพิ่ม property ปี ส่วน `SLH_READY` ระบบตั้งให้อัตโนมัติหลัง `setup` ผ่าน ห้ามตั้งเองเพื่อข้ามการตรวจ

### ฟังก์ชันที่ต้องรันครั้งแรก

1. **`inspectSetup()`** — ตรวจหัวคอลัมน์ ชื่อผู้ใช้ซ้ำ จำนวน 907 บัญชี และ Teacher/Admin ของ watcharapon โดยไม่แก้ชีต ผลตรวจใน Execution log มีเฉพาะข้อมูลสรุป ไม่มีรายชื่อหรือรหัสผ่าน
2. **`setup()`** — ตรวจซ้ำก่อนสร้าง `SLH_Events` และ `SLH_Sessions` หากชีตระบบมีอยู่แล้วจะตรวจโครงสร้างและเก็บแถวเดิมไว้ รันซ้ำได้ ไม่ล้างบัญชีหรือผลการเรียน
3. **ไม่ต้องรัน `doPost()` เอง** — เว็บไซต์จะเรียกเมื่อ login/ส่งผล/เปิดข้อมูลครู ส่วน `doGet()` ใช้ตรวจว่า deployment ตอบได้เท่านั้น

หาก `inspectSetup` หรือ `setup` แจ้งหัวคอลัมน์/จำนวนบัญชีผิด ให้ตรวจชื่อชีตและหัวแถวแรก ห้ามลบชีตเดิมเพื่อให้ผ่านการตรวจ

ไม่ต้องใส่รหัสผ่านใน properties, HTML, GitHub Secrets หรือ config เว็บ โค้ดอ่านรหัสผ่านเดิมจากคอลัมน์ส่วนตัวในชีต และไม่ส่งคอลัมน์รหัสผ่านกลับไปยัง client

## การรักษาข้อมูลและขอบเขตผลคะแนน

บัญชีต้นฉบับเป็นแหล่งตรวจ login การเพิ่มชีตภายในระบบไม่แก้ชื่อ รหัสผ่าน บทบาท หรือแถวในชีตเดิม การตั้งค่าซ้ำต้องไม่ล้างผลที่บันทึกแล้ว session มีอายุและเพิกถอนได้ สิทธิ์การดูนักเรียนตรวจจากบัญชีฝั่ง server ทุกคำขอ การแก้ role ใน browser จึงไม่ให้สิทธิ์อ่านชีต

แต่ละผลกิจกรรมมี ID ถาวร คิวส่งซ้ำใช้ ID และเนื้อหาเดิม server ใช้ [LockService](https://developers.google.com/apps-script/reference/lock/lock-service) และตรวจรายการที่บันทึกแล้วก่อนเพิ่มแถว ถ้าพบ ID เดิมที่เนื้อหาเปลี่ยนจะปฏิเสธ การส่งช้าหรือส่งย้อนหลังไม่ควรทับความหมายของคะแนนล่าสุด

ผลเกมเดิมมีการผ่านและจำนวนครั้ง ไม่มีสูตรคะแนนตัวเลขสำหรับทุกชนิดเกม จึงเก็บผลตามที่ engine คำนวณ แบบฝึกเก็บจำนวนถูก/เต็มและผลการตรวจ Simulation เก็บค่าที่ปรับและผลคำนวณ สอบเก็บแต่ละครั้ง คะแนนล่าสุดและคะแนนสูงสุดคำนวณแยกกัน

คะแนนมาจากการคำนวณในเว็บไซต์ผู้เรียนและมีป้าย `clientReported` จึงยังไม่ใช่ข้อสอบที่ตรวจคำตอบบน server ผู้ที่แก้ข้อมูลใน browser อาจส่งผลที่ไม่ตรงการทำจริงได้ การตรวจ login/สิทธิ์และการกันบันทึกซ้ำไม่ได้แก้ข้อจำกัดนี้

ความคืบหน้าและการเรียนต่อยังอยู่ใน browser เดิม ไม่ได้ย้ายไปเครื่องใหม่โดยอัตโนมัติ ไม่ดึงคะแนนจากบัญชีสาธิตไปผูกกับบัญชีจริง ประวัติที่ระบบเก่าเคยตัดเกิน 10 ครั้งไปแล้วไม่สามารถกู้จากเว็บได้ และผลที่เกิดก่อนเปิดการเชื่อมจะไม่ถูกอ้างว่าได้ส่งเข้า Sheets แล้ว

## ตรวจหลังติดตั้งจริง

1. รันการตรวจบัญชีแล้วต้องพบ 907 บัญชีไม่ซ้ำ ปี 2569 และ watcharapon มีสองบทบาทโดยไม่มีรหัสผ่านในผลตรวจ
2. Login นักเรียนหนึ่งบัญชี ทำเกม g1–g3, แบบฝึก e1–e3, O-NET และทดลอง Simulation ตรวจว่าคิวส่งสำเร็จและผลเข้าชีต
3. สอบสองครั้ง ให้ครั้งหลังคะแนนต่ำลง ตรวจว่า **ล่าสุด** ลดลงได้ แต่ **สูงสุด** คงเดิม และเปิดประวัติได้ทั้งสองครั้ง
4. ปิดอินเทอร์เน็ตชั่วคราวแล้วส่งกิจกรรม เปิดกลับ ตรวจว่าคิวส่งใหม่ได้และไม่มีแถวซ้ำ ห้ามล้าง browser storage ขณะที่มีคิวรอส่ง
5. Login watcharapon กรองชั้น ห้อง บทเรียน และนักเรียน ตรวจรายละเอียดประวัติสอบ จากนั้น logout แล้ว login นักเรียน ตรวจว่าไม่มีข้อมูลครูค้างอยู่
6. ทดสอบจาก GitHub Pages ทั้งคอมพิวเตอร์และโทรศัพท์ เมื่อครบจึงทยอยเปิดใช้รายห้อง

907 บัญชีเป็นจำนวนทะเบียน ไม่ใช่ผลรับรองว่าใช้งานพร้อมกัน 907 คนแล้ว Apps Script มี [โควตาและข้อจำกัดการทำงานพร้อมกัน](https://developers.google.com/apps-script/guides/services/quotas) และการอ่านประวัติจะมากขึ้นตามข้อมูล ต้องทดสอบกับ deployment จริงและติดตาม Apps Script Executions ก่อนใช้งานทั้งโรงเรียน

## สถานะการเชื่อม

ตั้ง URL `/exec` ที่ผู้ใช้ส่งมาใน `assets/integrations/sheets-config.js` แล้ว และวันที่ 23 ตุลาคม 2026 ทดสอบผ่าน Chrome กับ Apps Script ที่ deploy จริง จากเว็บ source ที่เปิดผ่าน local HTTP server สำเร็จ ทั้ง Login นักเรียนสามบัญชี, Teacher/Admin, การปฏิเสธสิทธิ์นักเรียน, การส่งผลกิจกรรมครบทุกประเภท, ประวัติสอบ, คะแนนล่าสุด/สูงสุด และการส่งซ้ำ ผู้ใช้ระบุบัญชีทดสอบก่อนเขียนข้อมูลจริง ผลทดสอบถูกเก็บในบัญชีที่ได้รับอนุญาตเท่านั้น ไม่มีการแก้ไขบัญชีในชีตต้นทาง

รายงานการทดสอบจริงเก็บไว้ที่ `tmp/sheets-live-report.json` ซึ่ง Git ไม่นำไปเผยแพร่ ไม่ใส่ผลคะแนนรายบัญชีในเอกสารหรือ assets สาธารณะ ข้อมูลรับรองอ่านเข้า memory จากไฟล์บัญชีเดิมและไม่ได้บันทึกลงไฟล์เว็บ

ขณะทดสอบ local ข้างต้นยังไม่ได้เผยแพร่รุ่นนี้ขึ้น GitHub Pages การยืนยันรุ่นออนไลน์ต้องอ้างอิง workflow `Deploy Science Learning Hub` ของ commit ที่เผยแพร่ และผลตรวจจากโดเมนจริงใน `tmp/sheets-online-report.json` ส่วนการทดสอบจำนวนผู้ใช้พร้อมกัน 907 คนยังไม่ได้ทำ รหัสผ่านและรายชื่อนักเรียนไม่ได้ถูกคัดลอกลง public assets ไฟล์ source `Code.gs` มีเฉพาะตรรกะ ไม่มีข้อมูลบัญชีจริง และ build เดิมเลือกเฉพาะ `index.html`/`assets` จึงไม่รวม backend หรือไฟล์นำเข้าบัญชีไปกับ Pages

ก่อนเผยแพร่ตรวจ diff เทียบกับข้อมูลในไฟล์บัญชีเดิมแบบ in-memory โดยไม่บันทึกข้อมูลนั้นลง repository และนำ directory/รหัสผ่านสาธิตเดิมออกจากโค้ดเว็บด้วย ข้อมูลสาธิตอยู่เฉพาะ `tests/offline-sheets-fixture.mjs` ซึ่งไม่ถูก build ไปกับ Pages; compatibility identifier ของ localStorage เดิมยังคงไว้

## ผลทดสอบในเครื่อง (23 ตุลาคม 2026)

- Server 8 tests ผ่าน: บัญชีจำลอง 907 รายการ, ตรวจและตั้งค่าซ้ำโดยไม่เปลี่ยนต้นทาง, session/สิทธิ์/หมดอายุ/logout, ส่งซ้ำ/ชน ID, ประวัติสอบ 17 ครั้งและผลส่งย้อนหลัง, validation ทุกประเภท, rate limit และ payload ที่สร้างจาก handler เว็บจริงครบทั้ง 9 กิจกรรม
- Client ผ่าน: ID คงเดิมหลัง retry/reload, รับผลยืนยันบางส่วน, เปลี่ยนบัญชีขณะส่ง, หลายแท็บ, session หมดอายุ, timeout และพื้นที่จัดเก็บเต็ม
- Privacy 2 tests ผ่าน: ตรวจ config ที่มีเฉพาะ endpoint และ build 967 ไฟล์ (text 95 ไฟล์) พร้อมตรวจ scripts/styles และลำดับโหลดตรงกับ source
- Browser ผ่านบน Chrome ที่ 1366px และ 375px: login จริงของหน้าเว็บโดยจำลอง API, filters ทั้งสี่, pagination, ประวัติสอบเกิน 10 ครั้ง, latest/best, ป้องกัน HTML injection, ซ่อนข้อมูลครูจากนักเรียน และส่งผลสอบครบ 20 คำตอบ ไม่มี page error
- Regression เดิมผ่าน: บัญชี/localStorage, navigation, เกม 120 ชุด, แบบฝึก 120 ชุด, O-NET, final exam/migration, simulation/native models/plant growth, readiness, formulas และการรักษาหน้า Login/Dashboard

ปรับ assertions ของงานดีไซน์เก่าที่เคยห้ามเปลี่ยนโค้ดนอกหน้าตนนั้น ให้ตรวจเนื้อหาและรูปแบบเดิมโดยตรงและยอมรับเฉพาะ hooks ที่อนุญาตในงานนี้ อัปเดต hash ของ simulation engine สำหรับการส่งผลเท่านั้น; fixtures ของโมเดลวิทยาศาสตร์และเนื้อหายังคงเดิม ผลในหัวข้อทดสอบในเครื่องนี้ใช้ข้อมูลจำลอง ส่วนการทดสอบ Google deployment จริงระบุแยกในหัวข้อสถานะการเชื่อม

เมื่อกำหนด endpoint จริงแล้ว ชุด VM regression ใช้ config ออฟไลน์เฉพาะใน harness เพื่อป้องกันการส่งข้อมูลทดสอบเข้าโรงเรียน ชุด `deployment-browser.mjs` ใช้ `tests/offline-sheets-fixture.mjs` ปิดกั้น hosts ของ Apps Script และผ่านการตรวจ subpath, Login/Dashboard, ภาพ, 3D และการเรียนต่อ ชุด browser รุ่นเก่าอื่นที่ใช้บัญชีสาธิตต้องใช้ fixture นี้ก่อนเปิดหน้า ไม่ควรรันบัญชี demo กับ endpoint จริง

```powershell
node --test tests/google-sheets-server.test.mjs tests/google-sheets-client.test.mjs tests/google-sheets-privacy.test.mjs
node tests/google-sheets-browser.mjs
```

คำสั่ง browser ใช้ Playwright และ Chrome ที่ติดตั้งไว้แล้ว ใน workspace นี้ Node ที่ใช้ตรวจคือ `tmp/browser-check/playwright/driver/node.exe` โดยไม่ได้ติดตั้ง dependency ใหม่
