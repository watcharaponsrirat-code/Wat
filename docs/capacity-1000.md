# เตรียมเว็บสำหรับผู้ใช้พร้อมกัน 1,000 คน

วันที่ 7 ตุลาคม 2569 — ขอบเขตรอบนี้คือประสิทธิภาพการส่งเว็บแบบ static ตามระบบเดิม ผู้ใช้ยังไม่ได้ยืนยันว่าต้องการบัญชีรายบุคคลและฐานข้อมูลกลาง จึงยังไม่ได้เปลี่ยนระบบบัญชี

## สิ่งที่ปรับ

- แยกรูป base64 ที่ฝังซ้ำใน `index.html` เป็นไฟล์ต้นฉบับ 5 ภาพใน `assets/branding/` ใช้ชื่อจาก hash เนื้อหา รูปไม่ถูกบีบอัดซ้ำและเก็บแคชแยกจาก HTML ได้
- HTML ในซอร์สลดจากประมาณ 3.39 MB เป็น 0.56 MB (83.4%) เพราะไม่ส่งรูปเดิมซ้ำหลายครั้ง ตัวเลขนี้ไม่ใช่ขนาดดาวน์โหลดทั้งหน้า
- เพิ่ม `scripts/build-site.mjs` แยก CSS/ข้อมูล/โค้ดที่ฝังในหน้าเป็นไฟล์ชื่อ hash สำหรับเผยแพร่ เก็บลำดับสคริปต์และสถานะ defer เหมือนเดิม รองรับ URL โครงการแบบ `/school/`
- HTML สำหรับเผยแพร่เหลือประมาณ 3 KB ส่วน CSS/JS ที่แยกออกมีรวมประมาณ 561 KB ผู้เข้าครั้งแรกยังต้องโหลดไฟล์เหล่านี้ ชื่อไฟล์เปลี่ยนเมื่อเนื้อหาเปลี่ยน การใช้งานแคชจริงขึ้นกับ HTTP headers ของโฮสต์
- Workflow GitHub Pages ใช้ build ใหม่และตรวจว่าเนื้อหา/ลำดับสคริปต์กับ CSS ตรงกับซอร์สก่อนอัปโหลด ไม่เผยแพร่ไฟล์งาน `.ps1`, `.jsonl` หรือเอกสารจากโฟลเดอร์ assets เก็บไฟล์ภาพต้นฉบับและ license ไว้
- เพิ่มสคริปต์ทดสอบ k6 ซึ่งเพิ่มโหลดเป็น 100 → 500 → 1,000 ผู้ใช้ และค้างที่ 1,000 คน 5 นาที กำหนด HTTP error <1%, p95 <2 วินาที, p99 <5 วินาที และ checks >99%

## ผลตรวจที่รันแล้ว

- บัญชี/การย้ายข้อมูลเดิม, แบบฝึก 120 ชุด, Simulation 40 บท/245 กรณี, ข้อสอบ 800 ข้อ/4,000 ชุดสุ่ม: ผ่าน
- ชุดเผยแพร่: เนื้อหาและลำดับสคริปต์/CSS ตรงกัน ไฟล์อ้างอิงครบ: ผ่าน
- Chrome ที่ความกว้าง 390 px บน URL ใต้ `/school/`: รูปโรงเรียน, เข้าสู่ระบบ, dashboard, รูปบทเรียน, native 3D, ค่าทดลองหลัง reload, ไม่มีแนวนอนล้น: ผ่าน ไม่มี page error หรือ request failure
- k6 2.3.0 **local-smoke**: ramp 20 วินาที, ค้าง 1,000 VUs 30 วินาที, ramp down 10 วินาที; สูงสุด 1,000 VUs, 121,104 HTTP requests, 0 failures, p95 9.51 ms, p99 19.08 ms; เกณฑ์ผ่านทั้งหมด ผลดิบอยู่ที่ `tmp/k6/local-summary.json`

การทดสอบโหลดใช้ `scripts/preview-site.mjs` บน loopback ของ Windows เครื่องเดียวกัน เซิร์ฟเวอร์ทดสอบเก็บไฟล์ในหน่วยความจำและส่ง gzip สำหรับข้อความ จึงไม่ใช่ผลรับรอง GitHub Pages, CDN, อินเทอร์เน็ตโรงเรียน หรืออุปกรณ์นักเรียน สคริปต์จำลองการโหลด HTML, JS/CSS ที่อ้างตรงจากหน้า และภาพบทเรียน 6 ภาพ ไม่ได้รัน JavaScript/3D ใน 1,000 เบราว์เซอร์ และไม่ได้ครอบคลุมรูปพื้นหลัง CSS, dynamic imports หรือระบบฐานข้อมูล

## รันซ้ำ

ต้องมี Node.js 24 และ k6 สำหรับทดสอบโหลด ในเครื่องพัฒนานี้ใช้ Node ที่ `tmp/browser-check/playwright/driver/node.exe` ได้

```sh
node scripts/build-site.mjs
node tests/deployment-regression.mjs
node tests/deployment-browser.mjs
node scripts/preview-site.mjs
```

Build ต้องใช้โฟลเดอร์ปลายทางใหม่เพื่อไม่ให้ไฟล์รุ่นเก่าปะปน ค่าเริ่มต้นคือ `_site`; หากมีอยู่แล้ว ใช้ `node scripts/build-site.mjs tmp/site-next` และส่ง path เดียวกันให้ deployment-regression, deployment-browser และ preview-site

รันคำสั่งต่อไปนี้ในอีก terminal สำหรับ local smoke:

```sh
k6 run -e BASE_URL=http://127.0.0.1:4173/ -e PROFILE=local-smoke --summary-export=tmp/k6/local-summary.json tests/load-1000.js
```

ก่อนเปิดจริง ให้ใช้โฮสต์ staging ที่ได้รับอนุญาตและรันทดสอบเต็ม:

```sh
k6 run -e BASE_URL=https://YOUR-HOST/YOUR-PROJECT/ --summary-export=capacity-result.json tests/load-1000.js
```

`BASE_URL` ต้องลงท้าย `/` เพื่อรักษา project subpath การทดสอบนี้สร้าง traffic จำนวนมาก และยังไม่ได้รันกับโฮสต์ภายนอก

## สิ่งที่ต้องมีหากหมายถึงระบบนักเรียน 1,000 บัญชี

เว็บปัจจุบันมีบัญชีตัวอย่าง `teacher` และ `M20105` รหัสผ่านตรวจใน JavaScript และผลการเรียนอยู่ใน localStorage การปรับความเร็วครั้งนี้ **ยังไม่ได้เพิ่มระบบบัญชี 1,000 คนหรือซิงก์ข้อมูลข้ามเครื่อง** จำเป็นต้องเพิ่มการยืนยันตัวตนฝั่งเซิร์ฟเวอร์ สิทธิ์นักเรียน/ครู ฐานข้อมูลผลการเรียนรายคน การบันทึกที่รองรับการเขียนพร้อมกัน และสำรองข้อมูล ก่อนใช้งานในรูปแบบนั้น

GitHub Pages มี soft bandwidth limit 100 GB/เดือนและอาจจำกัดอัตราคำขอ ต้องประเมินจำนวนครั้งเข้าเรียนและภาพที่ดาวน์โหลดด้วย ไม่สามารถอนุมานความจุจากจำนวนคนเพียงอย่างเดียว ดู [ข้อจำกัด GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) และ [วิธีตั้งเกณฑ์โหลดของ k6](https://grafana.com/docs/k6/latest/examples/get-started-with-k6/test-for-performance/)

ผลข้างต้นเป็นการตรวจในเครื่องก่อนเผยแพร่ ดูผลตรวจล่าสุดใน [รายงานความพร้อมใช้งาน](readiness-audit.md) และตรวจสถานะเผยแพร่ที่ [GitHub Actions ของ Wat](https://github.com/watcharaponsrirat-code/Wat/actions/workflows/pages.yml)
