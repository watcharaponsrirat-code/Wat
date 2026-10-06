import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
const context=vm.createContext({window:{}});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].startsWith('window.SLH_DATA='))[1],context);
for(const file of ['engine','grade1','grade2','grade3'])vm.runInContext(await readFile(new URL('assets/exams/'+file+'.js',root),'utf8'),context);
const {SLH_DATA:data,SLH_FINAL_EXAMS:api}=context.window;
const lessons=Object.values(data.curriculum).flatMap(units=>units.flatMap(u=>u.lessons));
let md='# ผังข้อสอบท้ายบท เวอร์ชัน 2\n\nสร้างจากคลังจริงด้วย `scripts/final-exam-blueprint.mjs` • 20 ข้อต่อบท • ตัวเลขประเภทเป็นการจัดตามงานที่ถาม ยังไม่ใช่ระดับความยากจากการทดลองใช้\n\n| บท | เรื่อง | ความเข้าใจ | ประยุกต์ | วิเคราะห์หลักฐาน | รวม |\n| --- | --- | ---: | ---: | ---: | ---: |\n';
for(const l of lessons){const b=api.blueprints[l.id];md+=`| ${l.id} | ${l.title} | ${b.skills.understand} | ${b.skills.apply} | ${b.skills.analyze} | ${b.count} |\n`}
md+='\n## จำนวนข้อรายหัวข้อ\n\nรหัสหัวข้ออ้างถึงเนื้อหาในแอป ไม่ใช่รหัสตัวชี้วัดหลักสูตรอย่างเป็นทางการ แต่ละชุดใช้ครบตามจำนวนนี้และสุ่มลำดับเท่านั้น\n';
for(const l of lessons){md+=`\n### ${l.id} ${l.title}\n\n| หัวข้อ | จำนวนข้อ |\n| --- | ---: |\n`;for(const s of data.packs[l.id]){const n=api.blueprints[l.id].topics[s.code];md+=`| ${s.code} ${s.title}${n===0?' (เนื้อหาเสริม ไม่ออกสอบ)':''} | ${n} |\n`}}
await writeFile(new URL('docs/final-exam-blueprint.md',root),md);
console.log('Wrote blueprint for '+lessons.length+' lessons');
