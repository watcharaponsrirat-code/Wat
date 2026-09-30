# ภาพสื่อการสอน

ภาพชุดนี้สร้างด้วยเครื่องมือ imagegen ในตัว โดยแยกตามบทและตอนของเนื้อหาใน index.html
ชื่อไฟล์ใช้รหัสบทและลำดับตอน เช่น G1U1L1-01.png
รายการหัวข้อ คำสั่งสร้างภาพ และชื่อไฟล์จะบันทึกไว้ใน manifest.json

ชุดสมบูรณ์ประกอบด้วย 319 หัวข้อ เพิ่มภาพที่ขาด 173 หัวข้อ และเลือกภาพปรับปรุง 43 ภาพ
แต่ละหัวข้อมี PNG ต้นฉบับและ JPG สำหรับหน้าเว็บ ขนาด 1536 × 1024 พิกเซล
ภาพปรับปรุงลงท้าย -v2 โดยเก็บภาพรุ่นเดิมไว้ หน้า index.html และ gallery.html ใช้ภาพที่เลือกตรงกับ manifest.json

เปิด gallery.html เพื่อค้นหาและดูภาพทั้งหมด กดภาพเพื่อเปิด PNG ขนาดเต็ม
บันทึกคำสั่งสร้างภาพรอบนี้อยู่ใน generation-remaining.jsonl และ generation-refinements.jsonl

หลังเพิ่มหรือปรับภาพ ให้รันจากโฟลเดอร์โปรเจกต์:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File assets/lessons/apply-refinements.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File assets/lessons/prepare-web-images.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File assets/lessons/validate-images.ps1
```

ผลตรวจจำนวนไฟล์ การเปิดอ่าน และขนาดภาพบันทึกใน validation.json
