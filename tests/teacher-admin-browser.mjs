// Real website + real Code.gs in a local Sheets VM. No live school requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {staffFixture} from './helpers/staff-fixture.mjs';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('../tmp/browser-check/playwright/driver/package');}
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),endpoint='https://script.google.com/macros/s/SYNTHETIC_LOCAL_ONLY/exec';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const {h,owner,pupil,teacherId,teacherPassword,lessonId}=staffFixture();
h.students.rows[1][2]='<img src=x onerror="window.__unsafe=true">';
const originalSources=JSON.stringify([h.students.rows,h.staff.rows]),originalEvents=JSON.stringify(h.sheets.get('SLH_Events').rows);
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path!=='/'&&!path.startsWith('/assets/'))throw Error();const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(path!=='/'&&!file.startsWith(root+sep+'assets'+sep))throw Error();res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const calls=[],errors=[],report={mode:'local website + real Code.gs with synthetic Sheets',checks:[]};let browser,failedAction='';
try{
 browser=await pw.chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
 await context.route('**/assets/integrations/sheets-config.js*',r=>r.fulfill({contentType:'text/javascript',body:`window.SLH_SHEETS_CONFIG={endpoint:${JSON.stringify(endpoint)}};`}));
 await context.route('https://script.googleusercontent.com/**',r=>r.abort());
 await context.route('https://script.google.com/**',async r=>{assert.equal(r.request().url(),endpoint);const b=r.request().postDataJSON();calls.push({action:b.action,payload:['login','adminCreateTeacher'].includes(b.action)?{}:b.payload});let result;if(failedAction===b.action){failedAction='';result={ok:false,error:{code:'UNAVAILABLE',message:'ทดสอบการเชื่อมต่อขัดข้อง'}};}else result=h.call(b.action,b.payload,b.token);await r.fulfill({contentType:'application/json',body:JSON.stringify(result)});});
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 async function login(id,pw){await page.locator('#loginUser').fill(id);await page.locator('#loginPass').fill(pw);await page.locator('[data-action="login"]').click();await page.locator('.dashboardPage').waitFor();}
 async function logout(){await page.locator('[data-action="logout"]').click();await page.locator('#loginUser').waitFor();}
 const filter=()=>page.locator('[data-teacher-filters]');
 async function fit(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page must fit mobile width');}
 await login(teacherId,teacherPassword);await page.locator('[data-student-open]').first().waitFor();
 assert.equal(await page.locator('[data-staff-tab="admin"]').count(),0);assert.equal(await page.locator('.dashMain:visible').count(),0);
 for(const [field,expected]of[['grade',['1']],['room',['01']]])assert.deepEqual(await filter().locator('[name="'+field+'"] option').evaluateAll(els=>els.map(e=>e.value).filter(Boolean)),expected);
 assert.equal(await page.locator('[data-teacher-rows] img').count(),0);assert.equal(await page.evaluate(()=>window.__unsafe),undefined);
 assert.equal(calls.filter(c=>c.action==='studentResults').length,0,'No scores loaded before student selection');
 assert.equal(calls.filter(c=>c.action==='teacherRoster').at(-1).payload.limit,25);
 await page.locator('[data-teacher-next]').click();await page.waitForFunction(()=>!document.querySelector('[data-teacher-prev]').disabled);assert.equal(calls.filter(c=>c.action==='teacherRoster').at(-1).payload.offset,25);
 await filter().locator('[name="student"]').fill(pupil.user.id.slice(0,-1));await filter().locator('button[type="submit"]').click();await page.locator('[data-student-open="'+pupil.user.id+'"]').waitFor();
 assert.equal(calls.filter(c=>c.action==='teacherRoster').at(-1).payload.offset,0);
 report.checks.push('assigned room options; roster pagination/search; no eager score requests; escaped student name');
 await page.locator('[data-student-open="'+pupil.user.id+'"]').click();await page.locator('[data-exam-history-open]').waitFor();
 let text=await page.locator('[data-result-body]').innerText();for(const expected of ['ทำแล้วแต่ยังไม่ผ่าน','ผ่านแล้ว','ยังไม่ทำ','ไม่มีข้อมูล','20%','100%'])assert(text.includes(expected),expected);
 assert(/0\s*\/\s*6/.test(text),'Real zero score');assert(/2\s*\/\s*ไม่มีข้อมูล/.test(text),'Missing denominator');
 await page.locator('[data-simulation-details] > summary').click();
 assert((await page.locator('[data-result-body]').innerText()).includes('การเติบโต'));
 await page.locator('[data-exam-history-open]').click();await page.locator('[data-history-next]').waitFor();assert((await page.locator('[data-teacher-history]').innerText()).includes('13'));
 await page.locator('[data-history-next]').click();await page.waitForFunction(()=>!document.querySelector('[data-history-prev]').disabled);assert.equal(calls.filter(c=>c.action==='examHistory').at(-1).payload.offset,10);
 report.checks.push('game states; zero/missing/unattempted distinction; simulation detail; latest20/best100;13 attempts and history pagination');
 await mkdir(resolve(root,'tmp/teacher-admin-review'),{recursive:true});
 await page.screenshot({path:resolve(root,'tmp/teacher-admin-review/teacher-desktop.png'),fullPage:true});await page.setViewportSize({width:375,height:812});await fit();await page.screenshot({path:resolve(root,'tmp/teacher-admin-review/teacher-mobile.png'),fullPage:true});await page.setViewportSize({width:1366,height:900});
 const sentinel='slh_sheets_outbox_v1_fixture0002/pending-review-event';await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({id:'pending-review-event'})),sentinel);
 const otherLesson=await page.locator('[data-student-results] select[name="lessonId"]').evaluate((el,id)=>[...el.options].find(o=>o.value!==id).value,lessonId);
 failedAction='studentResults';await page.locator('[data-student-results] select[name="lessonId"]').selectOption(otherLesson);await page.getByText('ทดสอบการเชื่อมต่อขัดข้อง',{exact:false}).waitFor();await page.locator('[data-result-retry]').click();await page.waitForFunction(()=>document.querySelector('[data-result-body]')?.innerText.includes('ยังไม่ทำ'));assert(await page.evaluate(k=>!!localStorage.getItem(k),sentinel));
 assert.equal(h.call('adminUpdateTeacher',{teacherId,term:'2',rooms:[]},owner.token).ok,true);await page.locator('[data-student-results] select[name="lessonId"]').selectOption(lessonId);await page.locator('[data-result-retry]').waitFor();assert(!(await page.locator('[data-result-body]').innerText()).includes('100%'));
 report.checks.push('read retry; pending learner queue preserved; same-session revocation denies next read and clears stale result');
 await logout();await login('watcharapon',h.staffPassword);await page.locator('[data-student-open]').first().waitFor();
 await filter().locator('[name="grade"]').selectOption('2');await filter().locator('[name="room"]').selectOption('02');await filter().locator('button[type="submit"]').click();await page.locator('[data-student-open="fixture0002"]').waitFor();
 await page.locator('[data-staff-tab="admin"]').click();await page.locator('[data-teacher-edit="'+teacherId+'"]').click();let editor=page.locator('[data-admin-editor]');
 await editor.locator('[name="room"][value="1:01"]').check();await editor.locator('[name="room"][value="2:02"]').check();await page.locator('[data-admin-save]').click();await page.waitForFunction(()=>!document.querySelector('[data-admin-save]')?.disabled);
 assert.equal(h.call('adminTeachers',{},owner.token).data.rows.find(r=>r.id===teacherId).assignments.length,2);
 await editor.locator('[name="enabled"]').uncheck();await page.locator('[data-admin-save]').click();await page.waitForFunction(()=>!document.querySelector('[data-admin-save]')?.disabled);assert.equal(h.call('login',{username:teacherId,password:teacherPassword}).error.code,'INVALID_CREDENTIALS');
 await page.locator('[data-teacher-edit="watcharapon"]').click();assert(await editor.locator('[name="enabled"]').isDisabled());
 await page.getByText('เพิ่มบัญชีครู',{exact:true}).click();
 const create=page.locator('[data-admin-create]');await create.locator('[name="username"]').fill('fixture_new_teacher');await create.locator('[name="name"]').fill('ครูเพิ่มใหม่สำหรับทดสอบ');await create.locator('[name="password"]').fill('synthetic-review-only-password');await create.locator('button[type="submit"]').click();await page.locator('[data-teacher-edit="fixture_new_teacher"]').waitFor();assert.equal(await create.locator('[name="password"]').inputValue(),'');assert.equal(h.call('login',{username:'fixture_new_teacher',password:'synthetic-review-only-password'}).ok,true);
 await page.screenshot({path:resolve(root,'tmp/teacher-admin-review/admin-desktop.png'),fullPage:true});await page.setViewportSize({width:375,height:812});await fit();await page.screenshot({path:resolve(root,'tmp/teacher-admin-review/admin-mobile.png'),fullPage:true});
 assert.equal(JSON.stringify([h.students.rows,h.staff.rows]),originalSources);assert.equal(JSON.stringify(h.sheets.get('SLH_Events').rows),originalEvents);
 report.checks.push('Admin all rooms; create teacher; disable; multiroom assignments; protected owner; original sources/events preserved; desktop/375px');
 await logout();await login(pupil.user.id,h.password);await page.locator('.dashMain').waitFor();assert.equal(await page.locator('[data-teacher-panel]').count(),0);
 await page.locator('[data-nav="lessons"]').click();await page.locator('[data-unit="0"]').click();await page.locator('[data-lesson="'+lessonId+'"]').click();await page.locator('[data-stage="exam"]').click();
 await page.evaluate(({id,user})=>{const k='slh_v163_'+user+'_'+id,p=JSON.parse(localStorage.getItem(k));p.exam.current.qs.forEach((q,i)=>p.exam.current.answers[i]=q.correct);p.exam.current.idx=19;localStorage.setItem(k,JSON.stringify(p));},{id:lessonId,user:pupil.user.id});
 await page.locator('[data-stage="exam"]').click();await page.locator('[data-exam-submit]').click();await page.evaluate(()=>window.SLH_SHEETS.flush());await page.waitForFunction(()=>window.SLH_SHEETS.status().includes('ครบแล้ว'));assert.equal(h.call('examHistory',{studentId:pupil.user.id,lessonId},owner.token).data.total,14);
 report.checks.push('original student dashboard and exam submission still work');assert.deepEqual(errors,[]);report.passed=true;
}finally{await browser?.close();await new Promise(r=>server.close(r));await mkdir(resolve(root,'tmp/teacher-admin-review'),{recursive:true});await writeFile(resolve(root,'tmp/teacher-admin-review/report.json'),JSON.stringify(report,null,2));console.log(report);}
