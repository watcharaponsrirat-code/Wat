# อัปเดต Apps Script deployment เดิม — 25 ตุลาคม 2569

เอกสารนี้เป็นบันทึกรุ่น performance วันที่ 25 ตุลาคม สำหรับการรีเซ็ตคะแนนรุ่น 26 ตุลาคมให้ใช้ [ขั้นตอนใหม่](student-score-reset.md) ซึ่งต้องเพิ่มชีต `SLH_Resets` ด้วย `setup()` และใช้ไฟล์ `tmp/apps-script-reset-20261026/Code.gs` แทนสำเนาเก่ารุ่นนี้

สถานะ: ผู้ใช้ยืนยันว่าอัปเดตแล้วและ `inspectSetup` ผ่าน จากนั้นส่ง endpoint ใหม่ หลังเปลี่ยนเว็บ local ให้ใช้ URL นี้ การทดสอบจริงผ่านครบ 6 journeys พร้อมรูปแบบ API ใหม่ทั้งสามรอบ ดูตาราง Display/Data/Ready ใน [รายงาน performance](performance-audit.md) ผู้ใช้อนุญาตให้ commit และ push เมื่อผ่าน แล้วตรวจ GitHub Pages จริงต่อ

หมายเหตุรอบนี้: URL เดิมในเว็บยังตอบรูปแบบเก่า จึงเก็บผลรอบนั้นแยกไว้และไม่ใช้ยืนยันการปรับความเร็ว URL ใหม่จากผู้ใช้อยู่ใน [sheets-config.js](../assets/integrations/sheets-config.js) ส่วนขั้นตอนด้านล่างอธิบายการอัปเดต deployment ที่เลือกโดยคง URL ของ deployment นั้น สำหรับการอัปเดตครั้งถัดไปให้ตรวจว่า URL ตรงกับ config ปัจจุบัน

## ไฟล์ที่ใช้

ใช้ [Code.gs ฉบับเต็ม](../integrations/google-sheets/Code.gs) แทนเนื้อหาทั้งไฟล์ในโปรเจกต์เดิม สำเนาที่ตรึงไว้สำหรับรอบนี้อยู่ที่ `tmp/apps-script-update-20261025/Code.gs` และตรงกับ source ทุก byte

SHA-256 ของไฟล์รอบนี้:

```text
bfa5cd71f62df3ac721b16cfa407f36201b4e794a5b7bdf3b55b286bcfba43e1
```

รุ่นนี้ส่งห้องและรายชื่อนักเรียนหน้าแรกพร้อม Login ของครู และส่งรายชื่อพร้อมการโหลดห้องใหม่ โดยตรวจสิทธิ์จากข้อมูลล่าสุดทุกคำขอ นักเรียนไม่ได้รับข้อมูลครู ไม่มี schema, ชีต, คอลัมน์, Script Properties หรือ OAuth scopes ใหม่ ไม่ต้องเปลี่ยน `appsscript.json` เนื้อหา ดีไซน์ สูตร Simulation และหลักการตรวจสิทธิ์เดิมคงไว้

## ต้องรัน setup เพิ่มหรือไม่

**ไม่ต้องรัน `setup()` ซ้ำ** สำหรับระบบเทอม 2 เดิมที่ติดตั้งครบแล้ว เพราะรอบนี้เปลี่ยนวิธีอ่านข้อมูลและจัดผล API เท่านั้น `setup()` มีหน้าที่สร้างเฉพาะชีตระบบที่ยังขาดและตั้ง `SLH_READY` ไม่ได้เปิดใช้งานการลด API

หลัง Save โค้ดใหม่ ให้รัน **`inspectSetup()`** ซึ่งอ่านอย่างเดียว ผลต้องมี:

```json
{
  "ok": true,
  "academicYear": "2569",
  "term": "2",
  "studentCount": 907,
  "sourceTabsModified": false,
  "existingAppTabs": ["SLH_Events", "SLH_Sessions", "SLH_Teachers"]
}
```

ผลจริงมี `accountCount` เพิ่มได้ ข้างต้นยกเฉพาะ fields ที่ต้องตรวจ

- ถ้าครบทั้งสามชีตและระบบเดิมใช้งานได้ ให้ข้าม `setup()`
- ถ้าขาดชีตระบบจริง ให้ตรวจว่าเป็นโปรเจกต์และ Spreadsheet เดิมก่อน แล้วจึงรัน `setup()` หนึ่งครั้งและตรวจ `inspectSetup()` ซ้ำ ฟังก์ชันสร้างเฉพาะชีตที่ขาด ไม่ล้างชีตเดิม
- ถ้าปี จำนวนบัญชี หัวคอลัมน์ หรือเทอมผิด ให้หยุดอัปเดตและแก้สาเหตุจากผลตรวจ ไม่รัน `setup()` เพื่อกลบข้อผิดพลาดหรือเปลี่ยนข้อมูลนักเรียน

คง `SLH_SPREADSHEET_ID`, ชื่อชีตต้นทาง, `SLH_CURRENT_TERM=2` และ `SLH_READY` เดิม ไม่รีเซ็ต properties รุ่นนี้จะปฏิเสธ Login ของครูทันทีหากเทอมหรือชีตครูไม่พร้อม เพราะเตรียมข้อมูลหน้าครูภายใน Login แล้ว

## ขั้นตอนอัปเดต

1. เปิด **Apps Script project เดิม** ที่ผูกกับ Google Sheets ที่ใช้อยู่ ไปที่ **Deploy → Manage deployments** จด version ปัจจุบันและตรวจว่าเป็น Web app URL `/exec` เดิม เพื่อใช้ย้อนกลับได้
2. เปิดไฟล์ `Code.gs` ใน editor คัดลอกเนื้อหา **ทั้งไฟล์ฉบับล่าสุด** ด้านบนไปแทน แล้ว Save คง `appsscript.json` และ Script Properties เดิม
3. เลือกฟังก์ชัน **`inspectSetup` → Run** ตรวจผลตามหัวข้อข้างบน ใช้ `setup()` เฉพาะเมื่อจำเป็นตามเงื่อนไข ไม่ต้องรัน `doPost()` ใน editor
4. เลือก **Deploy → Manage deployments → Web app เดิม → Edit (ดินสอ) → Version: New version** ใส่คำอธิบาย `SLH performance 2026-10-25 — staff bootstrap` แล้วกด **Deploy** คง Execute as และ Who has access เดิม ไม่เลือก New deployment
5. ตรวจว่า URL `/exec` ยังเป็น URL เดิม แล้วแจ้งว่า **“อัปเดตแล้ว”** พร้อมเลข version ใหม่และผลสรุป `inspectSetup()` ถ้ามี ไม่ต้องส่งรหัสผ่าน รายชื่อนักเรียน หรือ token

การสร้าง version ใหม่แล้วแก้ deployment เดิมให้ชี้ไปที่ version นั้นจะรักษา URL และ deployment ID เดิม ตาม [เอกสาร Google](https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment) การ Save อย่างเดียวยังไม่อัปเดต versioned Web app ที่ใช้งานอยู่

หากต้องย้อนกลับ ให้ Edit deployment เดิม เลือก version ก่อนอัปเดตแล้ว Deploy โดยคง URL และสิทธิ์เดิม ไม่มีการย้ายโครงสร้างข้อมูลที่ต้องแปลงกลับ เว็บ local ใหม่รองรับ backend รุ่นก่อนด้วย fallback ส่วนเว็บที่เผยแพร่อยู่เดิมยังใช้ backend ใหม่ได้ แต่อาจยังเรียก API หลายครั้งจนกว่าจะอัปเดต frontend

## ทดสอบหลังผู้ใช้แจ้งว่าอัปเดตแล้ว

จะเปิด **เว็บ local รุ่นใหม่** เรียก Apps Script จริงผ่าน `/exec` เดิม ไม่ทดสอบผ่านเว็บ GitHub Pages รุ่นเก่า ผลใช้เทียบกับ `tmp/performance-v2/live-before.json` วันที่ 24 ตุลาคม 2569 เท่านั้น ไม่ใช้ผล mock เป็นตัวเลขความเร็วของบริการจริง

ใช้บัญชีนักเรียนและครูเดิม อ่านรหัสผ่านจากไฟล์ส่วนตัวเข้า memory แล้วส่งให้ชุดทดสอบทาง stdin ไม่เก็บในเว็บ คำสั่ง รายงาน หรือ Git ชุดเดิมใช้บัญชีนักเรียนตัวแรกหลังเรียงซ้ำทั้งสามรอบ; ชุดใหม่จะทำเช่นเดียวกัน

เงื่อนไขที่คงไว้: Chrome headless ช่องติดตั้งเดิม, จอ 1366×900, motion ปกติ, ไม่ throttle CPU/เครือข่าย, context และ localStorage ใหม่ทุก sample, HTTP cache ปิดจาก request interception, นักเรียนแล้วครูอย่างละ 3 รอบ จะบันทึก Chrome version จริงและความต่างของเงื่อนไขหากพบ บริการและอินเทอร์เน็ตคนละวันยังมีความผันผวน

รอบใหม่นี้ใช้ journey `login-roster` จบหลัง Login ของนักเรียน และหลังโหลดห้องใหม่ของครู จึงไม่เปิดเกม/Simulation/คะแนนรายคนต่อเหมือน journey เดิม จุดเริ่มจับเวลา วิธีวัด และสามขั้นตอนที่เปรียบเทียบเหมือนเดิม แต่จะระบุความต่างของ journey ในรายงาน

| ขั้นตอน | สิ่งที่จะตรวจจาก API จริง |
| --- | --- |
| นักเรียน Login | `login` หนึ่งครั้ง และไม่มี staff bootstrap |
| ครู Login จนรายชื่อพร้อม | `login` หนึ่งครั้ง มี staff bootstrap และรายชื่อพร้อม |
| ครูโหลดห้องใหม่ | `teacherOptions` หนึ่งครั้ง พร้อมรายชื่อที่ได้ตามสิทธิ์ล่าสุด |

รายงานแยก **Display / Data / Ready** ตามนิยามใน [รายงาน performance](performance-audit.md) ใช้มัธยฐาน `[ต่ำสุด–สูงสุด]` ของก่อนและหลังอย่างละ 3 samples แยกจากกัน ไม่รวม samples ข้ามวันหรือ backend; เก็บจำนวน API, failures และผล logout ด้วย

ชุดวัดอนุญาตเฉพาะ `login`, `logout`, `teacherOptions`, `teacherRoster` ไม่อนุญาต `sync` หรือ API แก้ครู และไม่ส่งคะแนนหรือแก้ข้อมูลนักเรียน การ Login/Logout ยังสร้างและเพิกถอน session ในชีตระบบตามการทำงานปกติ

ใช้ output ใหม่เสมอและรักษา `live-before.json` เดิมไว้ ก่อนสรุปต้องผ่าน 6 journeys, ไม่มี page/network error, blocked writes เป็นศูนย์ และ logout ครบ หาก backend ยังคืนรูปแบบเดิม จะรายงานว่ายังไม่ยืนยันรุ่นใหม่ ไม่เรียกผลนั้นว่า live-after ของการปรับนี้ SHA-256 ของ local ระบุไฟล์ที่เตรียมไว้ ไม่สามารถยืนยัน version ที่รันบน Google ได้ด้วยตัวมันเอง ต้องใช้การยืนยัน deployment จากผู้ใช้ร่วมกับพฤติกรรม API ที่สังเกตได้

ไฟล์เตรียมและ manifest สำหรับรอบนี้อยู่ใน `tmp/apps-script-update-20261025/` รอบที่ผ่านใช้บัญชีเดิมส่งเข้า stdin ของตัวรันด้วยพารามิเตอร์ `--live --manifest tmp/apps-script-update-20261025/manifest-new-endpoint.json --journey login-roster --roles student,teacher --samples 3 --variants after --phase user-provided-new-endpoint --output tmp/apps-script-update-20261025/live-after-new-endpoint.json` หากรันซ้ำต้องเลือก output ใหม่ ห้ามทับผลเดิม

ผลตรวจความพร้อม: server/client/privacy ผ่าน 19 tests, เครื่องมือวัด/สรุปผลผ่าน 12 tests และ smoke ด้วยชีตจำลองผ่าน 2 journeys โดยนักเรียนมีเพียงขั้น Login และครูมี Login กับโหลดห้องใหม่ ไม่มีการเปิดคะแนนรายคน ไม่มีคำขอเขียนที่ถูกบล็อก และ logout ครบ ผล smoke ใช้ตรวจการทำงานของตัววัดเท่านั้น ไม่ใช่หลักฐานความเร็วของ Google

## เงื่อนไขก่อน commit และเผยแพร่

ตรวจเตรียมเผยแพร่ผ่าน 57 tests (regression 11 ไฟล์และ unit tests 46 รายการ) รวม build/privacy และ browser หน้าครู–แอดมิน desktop/mobile ผ่านด้วยชีตจำลอง เพิ่มการตรวจ cache ผิวใบและตัววัด startup ใน workflow แล้ว หลังเปลี่ยน endpoint ตรวจ privacy และ deployment regression ผ่านอีกครั้ง ผลทดสอบจริงรอบ URL ใหม่ผ่านเงื่อนไขด้านล่างครบแล้ว ส่วนผลตรวจ GitHub Pages ต้องเก็บแยกหลังเผยแพร่

หลังผู้ใช้ยืนยัน deployment และการทดสอบจริงผ่าน ต้องตรวจรูปแบบ API ที่คาดไว้ครบทั้งสามรอบด้วย เพราะ `passed: true` เพียงอย่างเดียวยังอาจหมายถึงหน้าใหม่ใช้ fallback กับ backend รุ่นเดิม ต้องเห็น staff bootstrap ใน Login ครู, ไม่มี bootstrap ในนักเรียน และโหลดห้องใหม่ด้วย `teacherOptions` ครั้งเดียว

จากนั้นบันทึกผล live-before/live-after แยก Display/Data/Ready, commit เฉพาะไฟล์การปรับความเร็วและชุดตรวจที่เกี่ยวข้อง แล้ว push ให้ workflow ของ `main` เผยแพร่ ไม่รวมงานฐานข้อมูลอื่นหรือ `tmp/` หลัง workflow ของ commit นั้นสำเร็จ ต้องตรวจไฟล์ที่ GitHub Pages เสิร์ฟตรงกับ build และทดสอบ Login นักเรียน หน้าครู และการเปลี่ยนหน้าจากโดเมนจริง โดยไม่ส่งคะแนนหรือแก้ข้อมูลนักเรียน การตรวจ Pages แยกหลักฐานจากการทดสอบเว็บ local และคงเนื้อหา/ดีไซน์เดิม
