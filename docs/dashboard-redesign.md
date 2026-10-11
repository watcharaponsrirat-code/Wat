# Dashboard redesign — TASK 02

วันที่ตรวจ: 11 ตุลาคม 2026
สถานะ: ผ่านการตรวจในเครื่อง และผู้ใช้อนุญาตให้ส่งขึ้น GitHub แล้ว โดยใช้ GitHub Pages workflow เดิมในการเผยแพร่

## พรีวิวและ Checkpoint

- พรีวิว: http://127.0.0.1:4186/
- ใช้บัญชีเดิมของระบบเพื่อเข้าสู่ Dashboard
- Git checkpoint: `backup/dashboard-before-20261011-089b6f5`
- Baseline commit: `089b6f5ccbb154c413b5b7058f5262eca2f351ef`
- Build ที่ตรวจ: `tmp/dashboard-build-20261011-final`
- ภาพและรายงานใน `tmp/` เป็นหลักฐานการตรวจในเครื่อง ไม่รวมในไฟล์ที่เผยแพร่

## สิ่งที่เปลี่ยน

- Dashboard ใช้ฉาก Voxel เดิม ตราโรงเรียนจริง และป้ายไม้แบบภาพ WebP
- ปรับท่าตัวละครนักเรียนเดิมให้หันหน้าทักทาย ไม่แก้ภาพตัวละครที่หน้า Login ใช้
- แยกแขนด้วย CSS clip-path เพื่อโบกมือ พร้อม Idle, เมฆ และแสงเบา ๆ
- ลดการเคลื่อนไหวตาม prefers-reduced-motion และหยุดตัวละครเมื่อเลื่อนพ้นพื้นที่แสดงผล
- เมนู 2×2 มีภาพหนังสือ สมุด/ดินสอ ขวดทดลอง และจอยเกมจริง พร้อม Press Animation
- แบบฝึกหัดเปิดตัวเลือกชั้น บทเรียน และชุดฝึกบน Dashboard แล้วเข้าสู่ระบบแบบฝึกหัดเดิม
- เมนูบทเรียน / Simulation / เกม / Bottom Navigation ใช้ navigation hooks ของระบบเดิม
- แถบนำทางมีแถวของตัวเอง และรองรับ safe-area ด้านล่าง เนื้อหาเลื่อนได้โดยไม่ถูกแถบนำทางทับ
- มือถือเป็นคอลัมน์เดียว โน้ตบุ๊กใช้สองคอลัมน์ หน้าจอสั้นเลื่อนเนื้อหาได้
- รูปเมนูใช้ lazy loading; ไม่มี WebGL หรือไลบรารีใหม่สำหรับ Dashboard

## ข้อมูลที่แสดง

| รายการ | แหล่งข้อมูล / ความหมาย |
|---|---|
| ชื่อและชั้นเรียน | SESSION.user.name / SESSION.user.grade; ครูแสดง “ครูผู้สอน” |
| Avatar | ภาพตัวแทนเริ่มต้นจากตัวละครเดิม ไม่อ้างว่าเป็นรูปบัญชีที่นักเรียนอัปโหลด |
| จำนวนบทเรียนที่ผ่าน | userStats().done — นับ exam.passed |
| ความก้าวหน้ารวม | จำนวนบทที่ผ่านข้อสอบ ÷ จำนวนบททั้งหมด × 100; ปัดเศษเป็นจำนวนเต็ม |
| กิจกรรมของฉัน | สถานะของบทเรียนที่แนะนำให้เรียนต่อ: อ่านจบ, แบบฝึกครบ 3 ชุด, สำรวจ Simulation, เกมครบ 3 เกม |
| Simulation | อ่าน simulation[lessonId].explored ไม่ใช้ lab.done แทน |
| เรียนต่อ | เลือกบทที่เริ่มแล้วแต่ยังไม่ผ่าน โดยให้ชั้นของนักเรียนก่อน แล้วเรียก openLesson ผ่าน data-lesson |
| ไม่มีบทค้าง | เสนอบทที่ยังไม่ผ่านในชั้นเรียน; เมื่อผ่านทั้งหมดใช้ข้อความทบทวน |

ระบบเดิมไม่มีเวลาเข้าบทเรียนล่าสุดข้ามบท จึงไม่อ้างว่าบทที่เลือกเป็น “บทเรียนล่าสุด” และไม่เพิ่ม timestamp หรือช่องข้อมูลใหม่
ไม่เพิ่ม XP, Level, Gems, Coins, ระบบรางวัล หรือภารกิจรายวัน

## ขอบเขตไฟล์

- `index.html`: เปลี่ยนเฉพาะ renderDashboard และเพิ่ม CSS/JS ของ Dashboard
- `assets/dashboard/`: CSS, JS และ artwork ใหม่ที่ใช้เฉพาะ Dashboard
- `tests/dashboard-premium-browser.mjs`, `tests/dashboard-premium-regression.mjs`: การตรวจใหม่
- `tests/readiness-regression.mjs`: เปลี่ยนเฉพาะ assertion ของ Dashboard เก่าให้ตรงกับข้อมูล/กิจกรรมใหม่
- ไม่แก้ assets/login, Authentication, ข้อมูลนักเรียน, หลักสูตร, ID บทเรียน, เนื้อหา, เกม, Simulation, แบบฝึกหัด, ข้อสอบ, คลังคำถาม, Mastery, Progression หรือ localStorage schema

การตรวจเทียบ baseline ยืนยันว่าโค้ดใน index นอก renderDashboard และ imports ใหม่เหมือนเดิม และไม่มีการแก้ไฟล์ระบบเดิมนอก assertion ที่ระบุ

## ผลทดสอบจริง

ทดสอบด้วย Chrome headless / Playwright ในเครื่อง ไม่ใช่การทดสอบบนอุปกรณ์จริง

| Viewport | ผล | ภาพส่วนต้อนรับ | ภาพเมนู |
|---|---|---|---|
| 320×568 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-320x568.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-320x568.png) |
| 375×812 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-375x812.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-375x812.png) |
| 390×844 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-390x844.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-390x844.png) |
| 430×932 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-430x932.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-430x932.png) |
| 768×1024 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-768x1024.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-768x1024.png) |
| 1280×720 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-1280x720.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-1280x720.png) |
| 1366×768 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-1366x768.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-1366x768.png) |
| 1440×900 | ผ่าน | [ภาพ](../tmp/dashboard-review/dashboard-1440x900.png) | [ภาพ](../tmp/dashboard-review/dashboard-menu-1440x900.png) |

- ไม่พบ horizontal overflow, เมนูชนกัน หรือข้อความล้นพื้นที่ที่ตรวจ
- ตัวละครแสดงครบทุกขนาด และปุ่มล่างสุดเลื่อนเข้าพื้นที่เหนือ Navigation ได้
- ตรวจภาพด้วยตาจาก screenshots ทั้งส่วนต้อนรับและส่วนเมนู
- ตรวจเมนู 4 ใบ, แบบฝึกทั้ง 3 ประเภท, เลือกชั้นทั้ง 3, Navigation ทั้ง 5, ปิด dialog, ออกจากระบบ และปุ่มเรียนต่อ
- ตรวจ Enter/Space ของเมนูกิจกรรม
- ตรวจข้อมูลเริ่มต้นและข้อมูลความก้าวหน้าที่บันทึกไว้ รวมทั้งการแยกข้อมูลครู/นักเรียน
- Dashboard ไม่เขียนความก้าวหน้าขณะเปิด/กลับหน้าหลัก
- Resume คืน stage และคำตอบแบบฝึกหัดเดิมหลังกลับหน้าหลัก, Logout/Login และ Reload
- ตรวจว่าตัวละครมี transform เปลี่ยนจริง, หยุดนอกจอ และไม่มี animation เมื่อ reduced-motion
- ไม่พบ JavaScript page errors หรือ HTTP resource errors ระหว่างชุดทดสอบ Dashboard
- ตัวเลขที่ใช้ทดสอบถูกสร้างเฉพาะในโปรไฟล์เบราว์เซอร์ชั่วคราว ไม่ถูกใส่ในข้อมูลเว็บ

| ชุดตรวจที่รัน | ผล |
|---|---|
| dashboard-premium-browser.mjs | ผ่าน 8 viewports / navigation / ข้อมูล / resume / motion |
| dashboard-premium-regression.mjs | ผ่านขอบเขตไฟล์, read-only model, การเลือกบทเรียน, งบขนาดภาพ |
| account-regression.mjs | ผ่านบัญชีและการแยกข้อมูล; ชุดแบบฝึกที่นำเข้าทดสอบ 40 บท / 120 ชุด |
| navigation-regression.mjs | ผ่าน 40 บท × 10 stages และการคงคำตอบ |
| readiness-regression.mjs | ผ่านผลสอบ 0%, สถานะกิจกรรม, storage fallback และภาพบทเรียน 302 ภาพ |
| build-site.mjs | สร้าง static build สำเร็จ |
| deployment-regression.mjs | ผ่าน script/CSS byte equality, ลำดับการทำงาน และ resource paths |
| deployment-browser.mjs | ผ่าน project subpath, Login → Dashboard, เนื้อหา, Native 3D, และค่าที่บันทึกหลัง reload |

[ผล Browser test แบบ JSON](../tmp/dashboard-review/report.json)

ยังไม่ได้วัด FPS/หน่วยความจำบนโทรศัพท์จริง และไม่ได้ทดสอบ Safari/iOS จริง การตรวจ motion รอบนี้เป็นการตรวจพฤติกรรม CSS และภาพใน Chrome ไม่ใช่คำยืนยันอัตราเฟรมของทุกอุปกรณ์

## Artwork และที่มา

ใช้สกิล imagegen ผ่าน **built-in image_gen** ไม่ใช้ CLI/API key ภาพทั้งหมดบันทึกใน workspace แล้ว
WebP ใหม่ 6 ภาพรวม **271,882 bytes** (ประมาณ 266 KiB) โดยรักษา transparency และขนาดแสดงผล

| ไฟล์ | รายละเอียด | ขนาด |
|---|---|---|
| assets/dashboard/student-welcome-v1.webp | ปรับ pose ตัวละครเดิมจาก world-nature.png และ voxel-student-v1.webp | 800×665 |
| assets/dashboard/wood-sign-v1.webp | ป้ายไม้เปล่าสำหรับวางข้อความ HTML | 1000×333 |
| assets/dashboard/books-v1.webp | หนังสือ Voxel สีน้ำเงิน/แดง/เขียว ขอบทอง | 384×384 |
| assets/dashboard/notebook-v1.webp | สมุดและดินสอ Voxel | 384×384 |
| assets/dashboard/flask-v1.webp | ขวดทดลอง Voxel บนเกาะหญ้า | 384×384 |
| assets/dashboard/gamepad-v1.webp | จอยเกม Voxel สีน้ำเงิน/ม่วง | 384×384 |

ภาพฉาก, เมฆ, ไอคอนขวดในโลโก้ และตราโรงเรียนใช้ไฟล์เดิม ไม่มีการเปลี่ยนภาพ Login

### Prompt — ตัวละคร (ใช้ภาพต้นฉบับ 2 ภาพเป็น reference)

```text
Use case: identity-preserve. Asset type: transparent game welcome character for the existing Science Learning Hub dashboard. Image 1 is the edit target: reuse EXACT SAME brown-haired voxel Thai schoolboy in white short sleeved uniform shirt, navy tie and navy shorts from this existing scene. Image 2 is supporting high-detail reference for his same block hair, navy backpack and materials. Change only camera/pose/background: isolate this same character, face toward viewer with friendly smile, waist-up portrait, right arm (viewer LEFT) raised diagonally outward with a chunky block hand in greeting. Keep raised arm entirely to the left of head, separated with clear transparent space, attach at shoulder around 38% width 68% height; no hand overlapping head or torso so that arm can later be animated independently. Body on right half. One single complete connected character, not sprite sheet, no extra arms. Premium detailed voxel 3D shading, richly shaded brown cuboid hair, clean white shirt, navy tie/backpack straps, warm sunshine from upper left. Camera front three-quarter slight facing viewer right. Crop just below waist, all head and waving hand visible with 8% margin. Transparent background actual alpha. No scenery, book, base, text, UI, badges or new accessories. Keep existing character identity, don't redesign.
```

### Prompt — ป้ายไม้

```text
Use case: stylized-concept. Asset type: a single blank wooden plaque for a premium voxel science learning game dashboard. Wide horizontal 4:1 aspect wooden sign, nearly front-facing orthographic view, warm golden brown oak planks with richly shaded block-built bevelled edge, tiny gray iron square bolts in four corners, subtle pixel wood grain, clean straight continuous center with no writing. Bright warm sunshine from top left, beautifully rendered detailed voxel 3D craft consistent with a cheerful block school garden game. Transparent background actual alpha, wood occupies 90 percent of canvas; no ropes, posts, foliage, characters, icons, letters, symbols, UI or watermark. Keep center quiet so live HTML school name is readable.
```

### ชุดคำบรรยายสำหรับไอคอน

โจทย์ artwork ที่ส่งให้สร้างแยก 4 ภาพ: transparent premium bright voxel menu icons; detailed 3D materials, warm highlights, clean silhouette, no text, no interface, no reward systems. หนังสือเป็น gold/red/green stack, สมุดและดินสอธีม blue, science flask บน tiny grass island ธีม mint/blue, game controller ธีม blue/purple. ทุกภาพมีพื้นหลังโปร่งใส และแปลงเป็น WebP เพื่อใช้ในเมนูจริง
