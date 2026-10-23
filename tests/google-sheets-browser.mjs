// Local browser integration with synthetic accounts and a mocked Apps Script API.
// This never contacts Google or opens the private account workbook.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('../tmp/browser-check/playwright/driver/package'); }
const root = fileURLToPath(new URL('..', import.meta.url));
const endpoint = 'https://script.google.com/macros/s/SYNTHETIC_TEST_ONLY/exec';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) throw Error('Invalid path');
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const calls = [], errors = [], report = {checks: []};
const student = {id:'synthetic-student',name:'Synthetic Student',roles:['Student'],grade:1,room:'1',number:1};
const teacher = {id:'synthetic-teacher',name:'Synthetic Teacher',roles:['Teacher','Admin']};
const row = {studentId:student.id,username:student.id,name:'<img src=x onerror="window.__unsafe=true">',grade:1,room:'1',number:1,lessonId:'G1U1L1',games:{g1:{pct:50},g2:{pct:60},g3:{pct:70}},exercises:{e1:{pct:70},e2:{pct:80},e3:{pct:90}},simulation:{summary:'Synthetic experiment'},exam:{last:20,best:95,attempts:13}};
let browser;
try {
  browser = await playwright.chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
  await context.route('**/assets/integrations/sheets-config.js*', route => route.fulfill({contentType:'text/javascript',body:`window.SLH_SHEETS_CONFIG = {endpoint:${JSON.stringify(endpoint)}};`}));
  await context.route(endpoint, async route => {
    const body = route.request().postDataJSON();
    calls.push(body);
    let data;
    if (body.action === 'login') {
      if (body.payload.username !== teacher.id && body.payload.username !== student.id) {
        await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'INVALID_CREDENTIALS',message:'Synthetic login rejected'}})});
        return;
      }
      data = {token:'synthetic-token-' + body.payload.username,user:body.payload.username === teacher.id ? teacher : student};
    } else if (body.action === 'teacherSummary') {
      assert.equal(body.token, 'synthetic-token-' + teacher.id);
      data = {rows:[row],total:26};
    } else if (body.action === 'examHistory') {
      assert.equal(body.token, 'synthetic-token-' + teacher.id);
      data = {rows:[{occurredAt:1792620000000,result:{pct:20,score:4,total:20,responses:[{q:'Synthetic question',selected:'A',correct:'B',ok:false,why:'Synthetic explanation'}]}}],total:13};
    } else if (body.action === 'sync') {
      data = {acknowledged:body.payload.events.map(event => event.id)};
    } else if (body.action === 'logout') data = {};
    else throw Error('Unexpected action: ' + body.action);
    await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.locator('#loginUser').inputValue(), '', 'Configured login must not prefill a demo username');
  assert.equal(await page.locator('#loginPass').inputValue(), '', 'Configured login must not prefill a demo password');
  assert(!(await page.locator('.loginDemo').innerText()).includes('โหมดสาธิต'), 'Configured login must describe the connected account mode');
  assert((await page.locator('.loginDemo').innerText()).includes('ความคืบหน้าการเรียนต่อยังเก็บในเบราว์เซอร์นี้'), 'Connected notice must retain the local resume limitation');
  async function login(username) {
    await page.locator('#loginUser').fill(username);
    await page.locator('#loginPass').fill('synthetic-test-password');
    await page.locator('[data-action="login"]').click();
  }
  await login('teacher');
  await page.waitForFunction(() => document.body.innerText.includes('Synthetic login rejected'));
  assert.equal(await page.locator('#loginUser').count(), 1, 'Configured login must not fall back to a local demo account');
  report.checks.push('configured authentication rejects demo fallback');

  await login(teacher.id);
  await page.locator('[data-exam-history]').first().waitFor();
  assert.equal(await page.locator('[data-teacher-rows] img').count(), 0, 'Student names must be escaped');
  assert.equal(await page.evaluate(() => window.__unsafe), undefined);
  const rowText = await page.locator('[data-teacher-rows]').innerText();
  assert(rowText.includes('20%') && rowText.includes('95%'), 'Teacher sees separate latest and best exam scores');
  assert(rowText.includes('50% / 60% / 70%') && rowText.includes('70% / 80% / 90%'));
  assert(rowText.includes('Synthetic experiment'));
  await page.locator('[data-teacher-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-teacher-page]')?.textContent.includes('26'));
  assert.equal(calls.filter(c => c.action === 'teacherSummary').at(-1).payload.offset, 25);
  await page.locator('[data-teacher-filters] [name="grade"]').selectOption('1');
  await page.locator('[data-teacher-filters] [name="room"]').fill('1');
  await page.locator('[data-teacher-filters] [name="lessonId"]').selectOption('G1U1L1');
  await page.locator('[data-teacher-filters] [name="student"]').fill(student.id);
  await page.locator('[data-teacher-filters] button[type="submit"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-teacher-next]')?.disabled);
  const filters = calls.filter(c => c.action === 'teacherSummary').at(-1).payload;
  assert.deepEqual({grade:filters.grade,room:filters.room,lessonId:filters.lessonId,student:filters.student,offset:filters.offset}, {grade:'1',room:'1',lessonId:'G1U1L1',student:student.id,offset:0});
  report.checks.push('teacher filters and pagination; games/exercises/simulation; latest and best scores; HTML escaping');

  await page.locator('[data-exam-history]').first().click();
  await page.locator('[data-history-next]').waitFor();
  assert((await page.locator('[data-teacher-history]').innerText()).includes('13'));
  await page.locator('[data-teacher-history] summary').first().click();
  assert(await page.locator('[data-teacher-history]').innerText().then(text => text.includes('Synthetic explanation')));
  await page.locator('[data-history-next]').click();
  await page.waitForFunction(() => document.querySelector('[data-history-prev]')?.disabled === false);
  assert.equal(calls.filter(c => c.action === 'examHistory').at(-1).payload.offset, 10);
  report.checks.push('individual exam history opens with response details and pagination beyond ten attempts');
  await mkdir(resolve(root, 'tmp/google-sheets-browser'), {recursive:true});
  await page.screenshot({path:resolve(root,'tmp/google-sheets-browser/teacher.png'),fullPage:true});
  await page.setViewportSize({width:375,height:812});
  await page.screenshot({path:resolve(root,'tmp/google-sheets-browser/teacher-mobile.png'),fullPage:true});
  const mobileWidth = await page.evaluate(() => ({document:document.documentElement.scrollWidth, viewport:innerWidth}));
  assert(mobileWidth.document <= mobileWidth.viewport, 'Teacher dashboard must not overflow the mobile viewport: ' + JSON.stringify(mobileWidth));
  const controlsFit = await page.locator('[data-teacher-filters] input,[data-teacher-filters] select,[data-teacher-filters] button').evaluateAll(controls => controls.every(el => {
    const box = el.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.width > 0 && box.height > 0;
  }));
  assert(controlsFit, 'Every teacher filter must fit the mobile viewport');
  const tableScrolls = await page.locator('[data-teacher-rows]').evaluate(el => {
    el.scrollLeft = el.scrollWidth;
    return el.scrollWidth > el.clientWidth && el.scrollLeft > 0;
  });
  assert(tableScrolls, 'The wide score table must be horizontally scrollable within the mobile panel');
  await page.locator('[data-exam-history]').first().click();
  await page.locator('[data-history-next]').waitFor();
  report.checks.push('teacher filters fit 375px viewport; score table scrolls inside its container');
  await page.setViewportSize({width:1366,height:900});

  await page.locator('[data-action="logout"]').click();
  await login(student.id);
  await page.locator('.dashboardPage').waitFor();
  assert.equal(await page.locator('[data-teacher-filters]').count(), 0);
  assert.equal(await page.evaluate(() => typeof window.__SLH_QA__.login), 'undefined', 'Configured mode must disable the demo QA login shortcut');
  await page.locator('[data-nav="lessons"]').click();
  await page.locator('[data-unit="0"]').click();
  await page.locator('[data-lesson="G1U1L1"]').click();
  await page.locator('[data-stage="exam"]').click();
  await page.evaluate(() => {
    const id = 'G1U1L1', key = 'slh_v163_synthetic-student_' + id;
    const p = JSON.parse(localStorage.getItem(key));
    p.exam.current.qs.forEach((question, i) => { p.exam.current.answers[i] = question.correct; });
    p.exam.current.idx = 19;
    localStorage.setItem(key, JSON.stringify(p));
  });
  await page.locator('[data-stage="exam"]').click();
  await page.locator('[data-exam-submit]').click();
  await page.evaluate(() => window.SLH_SHEETS.flush());
  const sync = calls.filter(c => c.action === 'sync').at(-1);
  assert(sync, 'Submitting the original exam must produce a sync request');
  assert.equal(sync.token, 'synthetic-token-' + student.id);
  const exam = sync.payload.events.find(event => event.kind === 'exam');
  assert(exam && exam.result.pct === 100 && exam.result.responses.length === 20);
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('slh_v163_synthetic-student_G1U1L1')));
  assert.equal(snapshot.exam.last, 100);
  assert.equal(snapshot.exam.best, 100);
  assert.equal(snapshot.exam.passed, true);
  report.checks.push('student has no teacher panel; original exam submission uploads all responses and preserves passing progress');
  assert.deepEqual(errors, []);
  report.errors = errors;
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
  console.log(report);
}
