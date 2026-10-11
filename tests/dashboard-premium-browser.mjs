import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve(process.argv[2]||'.'),out=resolve('tmp/dashboard-review');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!path.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const errors=[],report={viewports:[],checks:[]};
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`)});
 const login=async(id='M20105')=>{await page.locator('#loginUser').fill(id);await page.locator('#loginPass').fill('1234');await page.locator('[data-action=login]').click();await page.locator('.dashboardPage').waitFor()};
 const home=async()=>{await page.locator('[data-action=home]').click();await page.locator('.dashboardPage').waitFor()};
 await page.goto(url);await login();
 assert.equal(await page.locator('[data-dashboard-name]').innerText(),'M20105');
 assert.equal(await page.locator('[data-dashboard-grade]').innerText(),'นักเรียนชั้น ม.2');
 assert.equal(await page.locator('[data-dashboard-progress]').innerText(),'0%');
 assert.equal(await page.locator('[data-dashboard-completed]').innerText(),'0/40');
 assert.equal(await page.locator('[data-dashboard-missions]').innerText(),'0/4');
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'viewing dashboard must not write progress');
 report.checks.push('Real student identity/grade, zero-state metrics, read-only dashboard');
 for(const [width,height] of [[320,568],[375,812],[390,844],[430,932],[768,1024],[1280,720],[1366,768],[1440,900]]){
  await page.setViewportSize({width,height});await page.locator('.dashShell').evaluate(e=>e.scrollTop=0);
  await page.locator('.dashCharacterBody').evaluate(i=>i.decode());
  await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
   const collisions=[];const cards=[...document.querySelectorAll('.dashMenu')].map(el=>el.getBoundingClientRect());
   cards.forEach((a,i)=>cards.slice(i+1).forEach(b=>{if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)collisions.push(i)}));
   const textOverflow=[...document.querySelectorAll('.dashMenuCopy,.dashBubble,.dashIdentity>div:last-child,.dashResume h3')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className||e.tagName);
   const fold=document.querySelector('.dashShell').getBoundingClientRect();
   return {horizontal:document.documentElement.scrollWidth>innerWidth,character:rect('.dashCharacter'),bubble:rect('.dashBubble'),nav:rect('.dashNav'),collisions,textOverflow,images:[...document.querySelectorAll('.dashboardPage img')].filter(i=>{const r=i.getBoundingClientRect();return i.offsetWidth&&r.bottom>fold.top&&r.top<fold.bottom}).every(i=>i.complete&&i.naturalWidth>0)};
  });
  assert(!layout.horizontal,`${width}: horizontal overflow`);assert.deepEqual(layout.collisions,[]);assert.deepEqual(layout.textOverflow,[],`${width}: text overflow`);assert(layout.character.width>130&&layout.character.height>120);assert(layout.images,`${width}: image decode`);
  await page.screenshot({path:resolve(out,`dashboard-${width}x${height}.png`),fullPage:true});
  await page.locator('.dashGrades summary').click();
  await page.locator('.dashGradeList [data-grade="3"]').scrollIntoViewIfNeeded();
  await page.locator('.dashShell').evaluate(e=>e.scrollTop=e.scrollHeight);
  const clear=await page.evaluate(()=>document.querySelector('.dashGradeList [data-grade="3"]').getBoundingClientRect().bottom<=document.querySelector('.dashNav').getBoundingClientRect().top);
  assert(clear,`${width}: navigation hides last button`);await page.locator('.dashGrades summary').click();
  await page.locator('.dashMenus').scrollIntoViewIfNeeded();
  await page.locator('.dashMenu img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  await page.screenshot({path:resolve(out,`dashboard-menu-${width}x${height}.png`)});
  report.viewports.push({width,height,...layout,bottomContentClear:clear});
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.dashShell').evaluate(e=>e.scrollTop=0);
 await page.locator('.dashMenus [data-nav=lessons]').click();await page.locator('[data-unit="0"]').waitFor();await home();
 for(const mode of ['lab','games']){await page.locator(`[data-shortcut=${mode}]`).focus();await page.locator(`[data-shortcut=${mode}]`).press(mode==='lab'?'Enter':'Space');await page.locator('[data-activity-grade="2"]').waitFor();assert((await page.locator('[data-activity-lesson]').count())>0);await page.locator(`[data-activity-stage="${mode==='lab'?'lab':'g1'}"]`).first().click();await page.locator('.stageDot.active').waitFor();assert.equal(await page.locator('.stageDot.active').getAttribute('data-stage'),mode==='lab'?'lab':'g1');await home()}
 for(const stage of ['e1','e2','e3']){await page.locator('[data-dashboard-exercises]').click();assert(await page.locator('.dashExerciseDialog').isVisible());await page.locator('.dashExerciseDialog [name=grade]').selectOption('1');await page.locator('.dashExerciseDialog [name=lesson]').selectOption('G1U1L1');await page.locator('.dashExerciseDialog [name=stage]').selectOption(stage);await page.locator('.dashExerciseStart').click();assert.equal(await page.locator('.stageDot.active').getAttribute('data-stage'),stage);await home()}
 await page.locator('[data-dashboard-exercises]').click();await page.locator('[data-dashboard-close]').click();assert(!await page.locator('.dashExerciseDialog').isVisible());
 for(const grade of ['1','2','3']){await page.locator('.dashGrades summary').click();await page.locator(`[data-grade="${grade}"]`).click();assert((await page.locator('[data-unit]').count())>0);await home()}
 for(const nav of ['home','lessons','results','mission','about']){await page.locator(`.dashNav [data-nav=${nav}]`).click();if(nav==='home'){await page.locator('.dashboardPage').waitFor()}else if(nav==='about'){assert((await page.locator('#modalRoot').innerHTML()).length>0);await page.reload();await login()}else{assert.equal(await page.locator('.dashboardPage').count(),0);await home()}}
 report.checks.push('All four menu cards, three exercise sets, all grade selectors, five navigation items, dialog close');
 // Test fixtures live only in this disposable browser profile, never in the app bundle.
 await page.evaluate(()=>{localStorage.clear();localStorage.setItem('slh_v163_M20105_G1U1L1',JSON.stringify({exam:{passed:true,best:80,attempts:1}}));localStorage.setItem('slh_v163_M20105_G2U3L1',JSON.stringify({contentDone:true,contentIndex:2,resume:'e2',visited:{content:true,e2:true},games:{g1:{done:true},g2:{done:true},g3:{done:true}},ex:{e1:{done:true},e2:{done:false},e3:{done:true}},simulation:{G2U3L1:{explored:true}}}));});
 await page.reload();await login();
 assert.equal(await page.locator('[data-dashboard-progress]').innerText(),'3%');
 assert.equal(await page.locator('[data-dashboard-completed]').innerText(),'1/40');
 assert.equal(await page.locator('[data-dashboard-missions]').innerText(),'3/4');
 assert.equal(await page.locator('[data-dashboard-resume]').getAttribute('data-lesson'),'G2U3L1');
 const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await page.locator('.dashNav [data-nav=home]').click();assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);
 await page.locator('[data-dashboard-resume]').click();assert.equal(await page.locator('.stageDot.active').getAttribute('data-stage'),'e2');
 await page.locator('[data-ex-q="0"]').first().click();
 const saved=await page.evaluate(()=>window.__SLH_QA__.snapshot('G2U3L1'));
 await home();await page.locator('[data-action=logout]').click();await login();await page.locator('[data-dashboard-resume]').click();
 assert.deepEqual(await page.evaluate(()=>window.__SLH_QA__.snapshot('G2U3L1').ex.e2.state),saved.ex.e2.state);
 await home();await page.reload();await login();await page.locator('[data-dashboard-resume]').click();assert.deepEqual(await page.evaluate(()=>window.__SLH_QA__.snapshot('G2U3L1').ex.e2.state),saved.ex.e2.state);
 await home();await page.locator('.dashMissionLink').click();assert.equal(await page.locator('.stageDot.active').getAttribute('data-stage'),'e2');await home();
 report.checks.push('Real nonzero metrics from stored progress, mission status, read-only rerender, exact exercise answers and resume survive home/logout/reload');
 await page.locator('[data-action=logout]').click();await login('teacher');assert.equal(await page.locator('[data-dashboard-grade]').innerText(),'ครูผู้สอน');assert.equal(await page.locator('[data-dashboard-completed]').innerText(),'0/40');
 await page.locator('[data-action=logout]').click();await login();
 assert.equal(await page.locator('.dashCharacterArm').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.dashShell').evaluate(e=>e.scrollTop=0);
 assert.equal(await page.locator('.dashCharacterArm').evaluate(e=>getComputedStyle(e).animationName),'dash-wave');
 const transform=await page.locator('.dashCharacterArm').evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(1400);const moved=await page.locator('.dashCharacterArm').evaluate(e=>getComputedStyle(e).transform);assert.notEqual(transform,moved);await page.screenshot({path:resolve(out,'dashboard-wave.png')});
 await page.locator('.dashShell').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(150);assert.equal(await page.locator('.dashCharacterArm').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 report.checks.push('Teacher isolation, prefers-reduced-motion, actual waving transform, offscreen pause');
 assert.deepEqual(errors,[]);report.errors=errors;report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;report.errors=errors;throw error}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();server.close()}
