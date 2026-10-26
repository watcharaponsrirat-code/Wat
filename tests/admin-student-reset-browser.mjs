// Focused real-browser coverage of the dashboard reset confirmation. All API data is synthetic.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('../tmp/browser-check/playwright/driver/package'); }
const source = await readFile(new URL('../assets/integrations/teacher-dashboard.js',import.meta.url),'utf8');
const html = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local reset UI test</title><body><main id="app"></main><script>${source}</script><script>
  window.testState = {calls:[],resets:new Map(),failNext:false,holdRead:false,holdReset:false,results:new Map()};
  const students = [{id:'fixture0001',username:'fixture0001',name:'นักเรียน <ทดสอบ>',grade:1,room:'01',number:'1'},{id:'fixture0002',username:'fixture0002',name:'นักเรียนคนที่สอง',grade:1,room:'01',number:'2'}];
  const lessons = {G1U1L1:{id:'G1U1L1',title:'บทเรียนที่หนึ่ง'},G1U1L2:{id:'G1U1L2',title:'บทเรียนที่สอง'}};
  const resultKey = (student,lesson) => student + ':' + lesson;
  const record = (action,payload) => testState.calls.push({action,payload:structuredClone(payload)});
  function seed() { for (const student of students) for (const lesson of Object.keys(lessons)) testState.results.set(resultKey(student.id,lesson),3); }
  seed();
  window.SLH_SHEETS = {
    enabled:()=>true,
    teacherOptions:async payload=>{record('teacherOptions',payload);return {academicYear:'2569',term:'2',rooms:[{grade:1,room:'01'}],roster:{grade:1,room:'01',rows:students,total:2,offset:0,limit:25}};},
    studentResults:async payload=>{record('studentResults',payload);const attempts=testState.results.get(resultKey(payload.studentId,payload.lessonId));const data={result:{games:{},exercises:{},exam:{last:attempts?80:null,best:attempts?100:null,attempts,lastAt:123}}};if(testState.holdRead){testState.holdRead=false;await new Promise(resolve=>testState.releaseRead=resolve);}return data;},
    examHistory:async payload=>{record('examHistory',payload);return {rows:[],total:0};},
    adminTeachers:async()=>({rows:[],total:0}),
    adminResetStudent:async payload=>{record('adminResetStudent',payload);if(testState.holdReset){testState.holdReset=false;await new Promise(resolve=>testState.releaseReset=resolve);}if(testState.failNext){testState.failNext=false;throw Error('การเชื่อมต่อขัดข้อง');}if(!testState.resets.has(payload.requestId)){for(const lesson of Object.keys(lessons))if(!payload.lessonId||payload.lessonId===lesson)testState.results.set(resultKey(payload.studentId,lesson),0);testState.resets.set(payload.requestId,payload);}return {reset:true};}
  };
  window.mountTest = roles => {document.getElementById('app').innerHTML='<div class="dashboardPage"><div class="dashShell"></div></div>';window.SLH_TEACHER.mount(document.getElementById('app'),{user:{roles},lessons});};
  mountTest(['Teacher']);
</script></body></html>`;
const server = createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser = await pw.chromium.launch({channel:'chrome',headless:true});
  const page = await browser.newPage({viewport:{width:1366,height:900}}), errors=[];
  page.setDefaultTimeout(10000); page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const student = id=>page.locator('[data-student-open="'+id+'"]');
  const lesson = ()=>page.locator('[data-student-results] [name=lessonId]');
  const openReset = ()=>page.locator('[data-student-reset-open]');
  const confirm = ()=>page.locator('[data-student-reset-form] [name=confirmStudentId]');
  const submit = ()=>page.locator('[data-student-reset-submit]');
  async function loaded(count=3){await page.waitForFunction(n=>document.querySelector('[data-exam-count]')?.textContent===String(n),count);}
  await student('fixture0001').click(); await loaded();
  assert.equal(await openReset().count(),0,'Teachers have no reset controls');
  await page.evaluate(()=>mountTest(['Teacher','Admin'])); await student('fixture0001').click(); await loaded();
  await page.locator('[data-exam-history-open]').click(); await page.locator('[data-history-close]').waitFor();
  await openReset().click(); assert(await submit().isDisabled());
  const confirmationText=await page.locator('[data-student-reset-confirm]').innerText();
  for (const label of ['fixture0001','นักเรียน <ทดสอบ>','บทเรียนที่หนึ่ง','Simulation','ความคืบหน้า']) assert(confirmationText.includes(label),label);
  assert.equal(await page.locator('[data-student-reset-confirm] ทดสอบ').count(),0,'Student name remains text');
  await confirm().fill('fixture0002'); assert(await submit().isDisabled());
  await confirm().fill('fixture0001 '); assert(await submit().isDisabled(),'Confirmation must match exactly');
  await confirm().fill('fixture0001'); assert(await submit().isEnabled());
  await page.evaluate(()=>testState.failNext=true); await submit().click();
  await page.waitForFunction(()=>document.querySelector('[data-student-reset-message]')?.textContent.includes('การเชื่อมต่อขัดข้อง'));
  await page.locator('[data-student-reset-cancel]').click(); await openReset().click(); await confirm().fill('fixture0001');
  await submit().click(); await loaded(0);
  let resets=await page.evaluate(()=>testState.calls.filter(c=>c.action==='adminResetStudent'));
  assert.equal(resets.length,2); assert.deepEqual(resets[0],resets[1],'Retry reuses the exact request including its ID');
  assert.match(resets[0].payload.requestId,/^[a-f0-9-]{36}$/); assert.deepEqual({...resets[0].payload,requestId:'stable'},{requestId:'stable',studentId:'fixture0001',lessonId:'G1U1L1',confirmStudentId:'fixture0001'});
  assert(await page.locator('[data-teacher-history]').isHidden()); assert(await page.locator('[data-student-reset-confirm]').isHidden());
  assert.equal(await page.evaluate(()=>testState.results.get('fixture0001:G1U1L2')),3,'Lesson reset preserves other lessons');
  assert.equal(await page.evaluate(()=>testState.results.get('fixture0002:G1U1L1')),3,'Reset preserves other students');
  await openReset().click(); await confirm().fill('fixture0001');
  await lesson().selectOption('G1U1L2'); await loaded(); assert(await page.locator('[data-student-reset-confirm]').isHidden(),'Changing lesson cancels the confirmation');
  await openReset().click(); await confirm().fill('fixture0001');
  await page.locator('[name=resetScope]').selectOption('all'); assert.equal(await confirm().inputValue(),''); assert(await submit().isDisabled(),'Changing scope requires typing the target again');
  await confirm().fill('fixture0001');
  await page.evaluate(()=>testState.holdReset=true); await submit().click();
  await page.waitForFunction(()=>typeof testState.releaseReset==='function');
  assert(await lesson().isDisabled()); assert(await student('fixture0002').isDisabled()); assert(await page.locator('[data-student-reset-cancel]').isDisabled());
  await page.evaluate(()=>testState.releaseReset()); await loaded(0);
  resets=await page.evaluate(()=>testState.calls.filter(c=>c.action==='adminResetStudent'));
  assert.equal(resets.at(-1).payload.lessonId,''); assert.notEqual(resets.at(-1).payload.requestId,resets[0].payload.requestId);
  assert(await lesson().isEnabled()); assert(await student('fixture0002').isEnabled());
  await openReset().click(); await confirm().fill('fixture0001'); await student('fixture0002').click(); await loaded();
  assert(await page.locator('[data-student-reset-confirm]').isHidden(),'Changing student discards the previous confirmation');
  // Keep a pre-reset read in flight: successful reset must fetch a new snapshot.
  await page.evaluate(()=>testState.holdRead=true); await page.locator('[data-result-refresh]').click();
  await page.waitForFunction(()=>typeof testState.releaseRead==='function');
  await openReset().click(); await confirm().fill('fixture0002'); await submit().click(); await loaded(0);
  await page.evaluate(()=>testState.releaseRead()); await page.waitForTimeout(25); await loaded(0);
  assert(await page.locator('[data-result-refresh]').isEnabled());
  // A response for a detached student panel cannot repaint or reload its replacement.
  await openReset().click(); await confirm().fill('fixture0002'); await page.evaluate(()=>{testState.releaseReset=null;testState.holdReset=true;}); await submit().click();
  await page.waitForFunction(()=>typeof testState.releaseReset==='function');
  await page.evaluate(()=>mountTest(['Teacher','Admin'])); await student('fixture0001').click(); await loaded(0);
  const readCount=await page.evaluate(()=>testState.calls.filter(c=>c.action==='studentResults').length);
  await page.evaluate(()=>testState.releaseReset()); await page.waitForTimeout(25);
  assert.equal(await page.evaluate(()=>testState.calls.filter(c=>c.action==='studentResults').length),readCount,'Detached reset completion does not refetch a different panel');
  await page.setViewportSize({width:375,height:812}); await openReset().click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Confirmation fits a mobile viewport');
  assert.deepEqual(errors,[]);
  console.log('Admin reset browser checks passed: role guard, exact confirmation, scope/student isolation, stable retries, locked selection, stale reads, detached response and mobile layout.');
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
