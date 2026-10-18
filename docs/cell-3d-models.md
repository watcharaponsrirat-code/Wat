# โมเดลเซลล์ 3D — G1U3L1

เพิ่มแบบจำลองตัดเปิดของ **เซลล์พืชจากใบ** และ **เซลล์สัตว์** สำหรับบทเรียน `G1U3L1` โดยใช้ Three.js ที่มีอยู่ในโครงการ ไม่เพิ่ม dependency หรือโหลดโมเดลจากบริการภายนอก ผลตรวจด้านล่างอ้างอิง baseline `6a120ba` และรายงานใน `tmp/cell-model-review/` ณ 18 ตุลาคม 2026

## Architecture

| ไฟล์ใน `assets/simulations/` | หน้าที่ |
| --- | --- |
| `cell-model-kit.js` | Geometry helpers สำหรับผิวตัดเปิด ถุงเยื่อ ท่อ และรายละเอียดออร์แกเนลล์ รวม geometry ตามส่วนประกอบ/วัสดุ และใช้ instancing กับอนุภาคซ้ำ |
| `cell-animal-model.js` | รูปร่างเซลล์สัตว์ ออร์แกเนลล์ และเซนทริโอลคู่ที่ประกอบด้วยไมโครทูบูลเก้าชุด ชุดละสามท่อ |
| `cell-plant-model.js` | ผนังเซลล์ทรงเหลี่ยมมน แวคิวโอลกลางขนาดใหญ่ นิวเคลียสบริเวณขอบ และคลอโรพลาสต์ที่มีกรานาซ้อนกัน |
| `cell-data.js` | ID ชื่อภาษาไทย คำอธิบาย และสีของส่วนประกอบ |
| `cell-studio.js` | สลับโมเดล เลือกด้วย raycast/highlight แสดงป้ายและคำอธิบาย ควบคุม lifecycle |
| `cell-studio.css` | Layout ป้าย รายการส่วนประกอบ และรูปแบบ responsive ที่จำกัดเฉพาะบทเรียนนี้ |
| `scene3d.js`, `studio3d.css` | เชื่อม adapter และ stylesheet เข้าระบบ 3D เดิม พร้อมกล้อง/แสงเฉพาะบทเรียน |

Factories `createAnimalCellModel({quality})` และ `createPlantCellModel({quality})` คืนค่า `{group, organelles, dispose}` โดยแต่ละรายการมี `{id, objects, anchor}` ทุก mesh ที่มองเห็นมี `userData.cellOrganelle` สำหรับการเลือก โมเดลอยู่รอบจุดกำเนิดและเปิดด้านหน้าไปทาง `+Z`; ค่า `quality` เป็น `high` หรือ `low` โดยใช้ตำแหน่งและชนิดส่วนประกอบเดียวกัน

Adapter สร้างและเก็บโมเดลแต่ละชนิดเมื่อใช้ครั้งแรก แสดงเฉพาะชนิดที่เลือก และคืน geometry, material, instanced mesh รวมถึงวัสดุ highlight เมื่อออกจากบทเรียน `dispose()` เรียกซ้ำได้ ไม่มี animation หรือค่าทางชีววิทยาที่สร้างขึ้นเองในโมเดล

## ส่วนประกอบ 12 ชนิดต่อโมเดล

ทั้งสองโมเดลมีส่วนประกอบร่วมกันเก้าชนิด:

| ID | ชื่อ |
| --- | --- |
| `membrane` | เยื่อหุ้มเซลล์ |
| `cytoplasm` | ไซโทพลาซึม |
| `nucleus` | นิวเคลียส |
| `nucleolus` | นิวคลีโอลัส |
| `mitochondria` | ไมโทคอนเดรีย |
| `golgi` | กอลจิบอดี |
| `rough-er` | ร่างแหเอนโดพลาซึมชนิดหยาบ |
| `smooth-er` | ร่างแหเอนโดพลาซึมชนิดเรียบ |
| `ribosomes` | ไรโบโซม |

เซลล์พืชเพิ่ม `wall` — ผนังเซลล์, `vacuole` — แวคิวโอลกลางขนาดใหญ่ และ `chloroplasts` — คลอโรพลาสต์ รวมเป็น 12 ชนิด เซลล์สัตว์เพิ่ม `lysosomes` — ไลโซโซม, `vesicles` — เวสิเคิล และ `centrioles` — เซนทริโอล รวมเป็น 12 ชนิด

คำอธิบายใน `cell-data.js` อ้างอิง [OpenStax Biology 2e: Eukaryotic Cells](https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells) และ [The Endomembrane System and Proteins](https://openstax.org/books/biology-2e/pages/4-4-the-endomembrane-system-and-proteins)

## พฤติกรรมเดิมและการใช้งาน

คง builder เดิมของบทเรียนไว้ทั้งหมด: ชนิดเซลล์ `cell=0/1`, ตัวเลื่อน `zoom=1..2`, SVG 2D, metrics, ข้อสรุป และค่าที่บันทึกไม่เปลี่ยน ปุ่มสลับชนิดในส่วนหัวส่ง event ผ่าน control เดิม สัดส่วนการขยายจาก 1 เป็น 2 ยังคงเป็นสองเท่า การ reset, persistence, navigation และ fallback 2D ใช้ระบบเดิม ไม่แก้ `index.html`, engine, เนื้อหาหลักสูตร หรือโมเดลต้นถั่ว

ผู้เรียนหมุนด้วยเมาส์/นิ้ว ซูมด้วย wheel/pinch หรือปุ่ม ใช้มุมหน้า/บน/เริ่มต้น และเปิดหมุนอัตโนมัติได้ แตะ geometry หมายเลข หรือรายการชื่อเพื่อเลือกส่วนประกอบและอ่านหน้าที่ การลากหรือใช้หลายนิ้วไม่ถือเป็นการเลือก หมายเลข 01–12 อยู่ในสองคอลัมน์คงที่ ไม่สลับตำแหน่งหรือขยายเมื่อหมุนและเลือก แสดงเส้นชี้เฉพาะส่วนที่เลือก (หรือ hover เมื่อยังไม่ได้เลือก) พร้อมชื่อภาษาไทย การปิดป้ายซ่อนคอลัมน์หมายเลข แต่รายการชื่อด้านล่างยังอยู่ครบ

จุดชี้ทุกส่วนถูกยึดบนผิวสามเหลี่ยมจริงของโมเดลตั้งแต่สร้าง ไม่ใช้พิกัด Z ที่กะไว้ ตรวจ ray จากกล้องไปยังจุดชี้ทุกครั้งที่มุมมองเปลี่ยน โดยทั้ง ID และระยะของผิวแรกต้องตรงกัน ไม่ยอมให้ส่วนอื่นหรือออร์แกเนลล์ชนิดเดียวกันที่อยู่ใกล้กว่ามารับรองจุดที่ถูกบัง ถ้าจุดชี้ถูกบังหรืออยู่นอกกรอบ จะเก็บหมายเลขไว้และแจ้งเหตุผล พร้อมซ่อนเส้นและจุดปลายแทนการชี้ทะลุเซลล์ เลข 02 ของเซลล์สัตว์ย้ายไปยังผิวไซโทพลาซึมที่เปิดโล่งข้างนิวเคลียส

Hotspot และปุ่มควบคุมมีพื้นที่แตะอย่างน้อย 44×44 CSS px รายการใช้ button ที่เข้าถึงด้วยคีย์บอร์ด มี focus indicator, `aria-pressed` และคำอธิบายแบบ `aria-live` รองรับ `prefers-reduced-motion` การสลับไป 2D หรือ WebGL context loss ซ่อนส่วนสำรวจ 3D และคงการทดลอง 2D ที่ใช้งานได้

## Render budget และผลวัด

เพดานต่อโมเดล: **64 draw calls**, **130,000 สามเหลี่ยมในระดับสูง**, **60,000 ในระดับต่ำ** เลือกระดับต่ำเมื่อ viewport กว้างน้อยกว่า 600 px หรืออุปกรณ์รายงาน RAM ไม่เกิน 4 GB

ค่าจาก `tmp/cell-model-review/cell-factory-report.json` ล่าสุด:

| โมเดล | ระดับ | Meshes / draw calls | Geometry ที่ใช้แสดง | สามเหลี่ยม | ทรัพยากรที่สังเกตการ dispose |
| --- | --- | ---: | ---: | ---: | ---: |
| พืช | high | 45 / 45 | 43 | 103,764 | 91 |
| พืช | low | 45 / 45 | 43 | 44,388 | 91 |
| สัตว์ | high | 42 / 42 | 37 | 94,536 | 83 |
| สัตว์ | low | 42 / 42 | 37 | 38,940 | 83 |

Geometry bounds โดยประมาณ `(width, height, depth)` เป็น `(321.85, 357.85, 105.75)` สำหรับพืชระดับสูง และ `(311.06, 299.03, 90.50)` สำหรับสัตว์ระดับสูง ในหน่วยของฉาก ตัวเลข draw calls/สามเหลี่ยมเป็น pass ที่แสดงโมเดลในชุดทดสอบ ไม่ใช่ผลวัด FPS หรือผลรวมทุก shadow pass

Factory suite ผ่านครบสี่คู่โมเดล/คุณภาพ ตรวจ ID และ mesh tags, geometry/index/normal/transform ที่มีค่าจำกัด, WebGL rendering และการคืนทรัพยากรครั้งเดียวแม้เรียก dispose สองครั้ง การ render สี ID ยืนยันว่า **ทั้ง 12 ส่วนประกอบมี pixel ที่มองเห็นจริง** ในทุกคู่ ไม่ได้ตรวจเพียงว่ามี object อยู่ใน scene

## Validation

การแก้ป้ายหลังเผยแพร่ `f854fae`: `tests/cell-label-browser.mjs` **PASS** ทั้งพืชและสัตว์บนจอ 1440×1000 และ 375×812 ตรวจการเลือก 96 กรณีในมุมเริ่มต้น/ด้านหน้า พร้อม 496 ตัวอย่างขณะลาก หมุนอัตโนมัติ และหมุนรอบ 360° รวมถึงมุมบนและ zoom 1/2 ตัวทดสอบสร้าง geometry และกล้องแยกอิสระ แล้วตรวจปลาย SVG กับผิวแรกที่ ray ชนจริง ตำแหน่งหมายเลขไม่เปลี่ยนระหว่างหมุน/เลือกครบ 12 ป้ายทุกกรณี จอมือถือสำรองพื้นที่ให้สองคอลัมน์ป้ายเพื่อไม่ให้บังขอบเซลล์ในมุมเริ่มต้น รายงานและภาพอยู่ที่ `tmp/cell-label-review/` Build สำหรับการแก้ครั้งนี้คือ `tmp/cell-label-build-20261018/` และผ่าน deployment regression

`tmp/cell-model-review/cell-browser-report.json`: **PASS**

- 22 คู่ชนิดเซลล์/ระดับขยายตรง baseline ทั้ง control, SVG 2D, metrics, summary และค่าที่บันทึก
- 20 responsive cases: สองโมเดล × zoom 1/2 × จอ 375×812, 390×844, 768×1024, 1024×768 และ 1440×1000 พร้อมตรวจมุมหน้า/บน ไม่มี page overflow หรือป้ายทับกันในกรณีที่ตรวจ
- WebKit จำลองมือถือ 375×812 และแท็บเล็ต 1024×768 ครบสองโมเดล รวมสี่กรณี ตรวจ tab สลับชนิด การเลือก ER ป้าย ซูม และ reset
- ตรวจรายการส่วนประกอบ ป้าย raycast, clear, การล้าง selection เมื่อสลับชนิด, mouse drag/wheel, keyboard, camera presets, auto rotation, touch orbit/pinch, 2D/3D, persistence, reset และ navigation/dispose/reopen
- ตรวจ WebGL context loss และการไม่มี WebGL: กลับสู่ 2D เดิมได้ มีภาพตรวจ 18 ภาพ ไม่มี unexpected browser errors; ข้อความสร้าง WebGL context ไม่สำเร็จที่เกิดจากการจำลอง fallback ถูกแยกไว้ในรายงาน

Regression รวม `tests/simulation-3d-browser.mjs` **PASS**: 40 บทเรียน, 84 controls, 120 layouts และไม่มี browser errors ตรวจการหมุนทีละ 15° ซูมเข้า/ออกแบบย้อนกลับ camera presets, auto rotation, labels และ reduced motion ครบ 40 บทเรียน รวมถึง touch/pinch, fallback 2D, context loss และ WebKit 3D ผ่าน Build สุดท้ายที่ `tmp/cell-3d-build-20261018/` และ `tests/deployment-regression.mjs` **PASS**

Focused smoke บน build ผ่าน path `/Wat/` **PASS**: ทั้งสองโมเดลที่ 1440×1000 และ 375×812 โหลดไฟล์ สลับชนิด เลือกนิวคลีโอลัส และจัด layout ได้ ไม่มี browser errors ตรวจ hover และเคอร์เซอร์กลับปกติหลังคลิกบนทั้งสองโมเดลด้วย ไฟล์ production ทั้งแปดตรงกับ source ทุก byte รายงานอยู่ที่ `tmp/cell-model-review/cell-built-smoke-report.json` พร้อมภาพ `final-plant-1440.png`, `final-animal-1440.png`, `final-plant-375.png` และ `final-animal-375.png`

## รันซ้ำและข้อจำกัด

```powershell
node tests/cell-model-browser.mjs --models
node tests/cell-model-browser.mjs
node tests/cell-label-browser.mjs
node tests/simulation-3d-browser.mjs
node tests/deployment-regression.mjs tmp/cell-label-build-20261018
```

ต้องมี Node, Git history ที่มี baseline `6a120ba`, Playwright, Chrome และ WebKit พร้อมใช้งาน ชุดทดสอบรองรับ Playwright ใน `tmp/browser-check/playwright/driver/package` เมื่อไม่ได้ติดตั้งเป็น package ปกติ และใช้ browser context ชั่วคราว รายงานและภาพของเซลล์อยู่ใน `tmp/cell-model-review/` ส่วนชุด regression รวมและ deployment มีรายงานแยก

สี สัดส่วน จำนวน และตำแหน่งออร์แกเนลล์เป็นภาพแทนเพื่อการเรียนรู้ ไม่ใช่ภาพกล้องจุลทรรศน์หรือค่าขนาดจริง เซลล์พืชนี้แทนเซลล์จากใบ ไม่ได้หมายความว่าเซลล์พืชทุกชนิดมีคลอโรพลาสต์ การทดสอบ Chrome/WebKit และ touch เป็นการจำลองบนเครื่องพัฒนา ไม่ใช่การวัด FPS ความร้อน หรือการทำงานบนมือถือ/iPad เครื่องจริง
