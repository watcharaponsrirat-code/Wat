import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const data=JSON.parse(html.match(/<script>window\.SLH_DATA=([\s\S]*?)<\/script>/)[1].replace(/;\s*$/,''));
const snapshot=JSON.stringify(data),context=vm.createContext({window:{SLH_DATA:data}});
vm.runInContext(await readFile(new URL('../assets/content/formulas.js',import.meta.url),'utf8'),context);
const math=context.window.SLH_MATH;
const sections=Object.values(data.packs).flat(),equations=Object.keys(math.catalog);
assert.equal(equations.length,23);
for(const section of sections.filter(s=>s.formula)){
 assert(math.catalog[section.code],'Every existing formula gets textbook layout: '+section.code);
 assert(math.renderSection(section).includes('role="math"'));
}
for(const code of equations){
 const section=sections.find(s=>s.code===code);assert(section,code+' maps to an existing topic');
 const output=math.renderSection(section);
 assert(!output.includes('undefined'));assert(output.includes('data-equation="'+code+'"'));
 assert(output.includes('aria-label="'),'Each equation has a spoken alternative');
}
const concentration=math.renderSection(sections.find(s=>s.code==='G2U2L2S4'));
assert(concentration.includes('eq-numerator">มวลของตัวละลาย (g)'));
assert(concentration.includes('eq-denominator">ปริมาตรของสารละลาย (cm<sup>3</sup>)'));
assert(concentration.includes('1 cm³ = 1 mL'));
assert(!concentration.includes('ปริมาตรของตัวทำละลาย'));
for(const expression of ['ρ = m/V','P=W/t','T=1/f','n=c/v','I=Q/t','V=W/Q','I=V/R','λ = v ÷ f','900 ÷ 30','5/200']){
 const output=math.text(expression);assert(output.includes('eq-fraction'),expression);
}
const power=math.text('ใช้ P=W/t=600/30=20 W');
assert(power.includes('aria-label="P=W/t"'));assert(power.includes('aria-label="600/30"'));assert(power.endsWith('=20 W'));
const kinetic=math.text('Ek=½mv²');assert(kinetic.includes('<sub>k</sub>'));assert(kinetic.includes('<sup>2</sup>'));assert(kinetic.includes('eq-numerator">1'));
assert(math.text('Q = mcΔT').includes('role="math"'));
for(const plain of ['cm³','g/cm³','m/s²','%w/w','%m/v','9/10/2569','แดง/น้ำเงิน','https://example.test/1/2/3','2/3²','ตัวเลือก A/B','a=b/c']){
 assert.equal(math.text(plain),plain,'Do not reinterpret non-math text or ambiguous expressions: '+plain);
}
const attack=math.text('<img src=x onerror="bad()"> P=W/t & <script>bad()</script>');
assert(!attack.includes('<img'));assert(!attack.includes('<script>'));assert(attack.includes('&lt;img'));assert(attack.includes('&amp;'));
for(const source of ['%w/w = มวลตัวละลาย ÷ มวลสารละลาย × 100','อัตราเร็วเฉลี่ย = ระยะทาง ÷ เวลา','มุมตกกระทบ = มุมสะท้อน','มวลก่อน = มวลของแข็ง + มวลแก๊ส','E (kWh) = P (kW) × t (h)'])assert(math.text(source).includes('role="math"'),source);
assert.equal(JSON.stringify(data),snapshot,'Rendering never mutates stored teaching/answer content');
console.log({sections:equations.length,originalFormulas:sections.filter(s=>s.formula).length,checks:['Thai numerator/denominator and units','all formula topics mapped','subscripts and superscripts','heat and electricity equations','safe inline arithmetic','non-math and unit text preserved','escaped markup','unchanged source data']});
