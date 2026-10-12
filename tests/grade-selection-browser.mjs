import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve(process.argv[2]||'.'),out=resolve('tmp/grade-selection-review');
const checkpoint='02722d0';
await mkdir(out,{recursive:true});
const report={checkpoint,scope:{},viewports:[],checks:[],errors:[]};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:4*1024*1024});
const before=git('show',`${checkpoint}:index.html`),after=await readFile('index.html','utf8');
const withoutGradePresentation=source=>{
 const start=source.indexOf('function renderGrades(){'),end=source.indexOf('function unitImage(',start);
 assert(start>0&&end>start,'Grade renderer boundaries exist');
 return (source.slice(0,start)+'GRADE_RENDERER\n'+source.slice(end)).replace(/^[ \t]*<link\b[^\r\n]*href=["']assets\/(?:grades\/grades|unit-selection\/unit-selection)\.css(?:\?[^"']*)?["'][^\r\n]*>\r?\n/gm,'').replace('assets/dashboard/dashboard.css?v=2','assets/dashboard/dashboard.css?v=1').replace('class="shell unitSelectionPage"','class="shell"').replace('class="woodSign unitTitleSign"','class="woodSign"').replace(/\r\n/g,'\n');
};
assert.equal(withoutGradePresentation(after),withoutGradePresentation(before),'Index outside renderGrades and the grade stylesheet import remains byte-for-byte unchanged');
const protectedChanges=git('diff','--name-only',checkpoint,'--','assets','scripts','.github').trim().split('\n').filter(p=>p&&!p.startsWith('assets/grades/')&&!p.startsWith('assets/unit-selection/')&&p!=='assets/dashboard/dashboard.css');
assert.deepEqual(protectedChanges,[],'Dashboard, Login, learning assets, build and deployment files remain unchanged');
report.scope={index:'PASS',protectedAssets:'PASS'};

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
  const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root+sep))throw Error('Path outside preview');
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');
  res.end(await readFile(path));
 }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,page;
try{
 try{browser=await playwright.chromium.launch({channel:'chrome',headless:true});report.browser='Chrome'}
 catch{browser=await playwright.chromium.launch({headless:true});report.browser='Playwright Chromium'}
 page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 page.on('pageerror',e=>report.errors.push(`JavaScript: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))report.errors.push(`Console: ${m.text()}`)});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(`HTTP ${r.status()}: ${r.url()}`)});
 const login=async(id='M20105')=>{
  await page.locator('#loginUser').fill(id);await page.locator('#loginPass').fill('1234');
  await page.locator('[data-action=login]').click();await page.locator('.dashboardPage').waitFor();
 };
 const home=async()=>{await page.locator('[data-action=home]').click();await page.locator('.dashboardPage').waitFor()};
 const grades=async()=>{await page.locator('[data-dashboard-grades]').click();await page.locator('.gradeSelectionPage').waitFor()};
 const storage=()=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));
 const instantScroll=()=>page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 const scrollTop=()=>page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const readyArtwork=async()=>{
  for(const image of await page.locator('.gradeArtwork img').all()){
   await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());
  }
  await page.evaluate(()=>document.fonts.ready);await scrollTop();
 };
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await instantScroll();await login();
 const untouched=await storage();
 for(const [width,height] of [[320,568],[375,812],[390,844],[430,932],[768,1024],[1280,720],[1366,768],[1440,900]]){
  await page.setViewportSize({width,height});await grades();await readyArtwork();
  assert.equal(await page.locator('.gradeCard').count(),3,'Exactly three grade cards');
  assert.equal(await page.locator('.gradeArtwork img').count(),3,'Each grade has its own artwork');
  const layout=await page.evaluate(()=>{
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
   const cards=[...document.querySelectorAll('.gradeCard')].map(box);
   const collisions=[];cards.forEach((a,i)=>cards.slice(i+1).forEach((b,j)=>{if(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y)collisions.push([i,i+j+1])}));
   const texts=[...document.querySelectorAll('.gradeHeading h1,.gradeHeading p,.gradeCopy h2,.gradeCopy p,.gradeLearningProgress')];
   const textOverflow=texts.filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).map(e=>({selector:e.className||e.tagName,text:e.textContent.trim()}));
   const images=[...document.querySelectorAll('.gradeArtwork img')].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,fit:getComputedStyle(i).objectFit,...box(i)}));
   return {horizontal:document.documentElement.scrollWidth>innerWidth,mainOverflow:document.querySelector('.gradeSelectionPage').scrollWidth>document.querySelector('.gradeSelectionPage').clientWidth+1,cards,collisions,textOverflow,images,buttons:[...document.querySelectorAll('.gradeEnter')].map(box)};
  });
  assert(!layout.horizontal&&!layout.mainOverflow,`${width}: horizontal overflow`);
  assert.deepEqual(layout.collisions,[],`${width}: grade card collision`);
  assert.deepEqual(layout.textOverflow,[],`${width}: text overflow`);
  assert(layout.images.every(i=>i.loaded&&i.width>0&&i.height>0&&/\.webp(?:\?|$)/i.test(i.src)),`${width}: WebP artwork decodes`);
  assert(layout.images.every(i=>['contain','cover','scale-down'].includes(i.fit)||Math.abs(i.width/i.height-i.naturalWidth/i.naturalHeight)<.03),`${width}: artwork preserves proportions`);
  assert.equal(layout.buttons.length,3);assert(layout.buttons.every(b=>b.width>=44&&b.height>=44),`${width}: touch targets`);
  if(width<1000){assert(layout.cards.every(c=>Math.abs(c.x-layout.cards[0].x)<2),`${width}: one column`);assert(layout.cards[1].y>=layout.cards[0].bottom,`${width}: cards stack vertically`)}
  else{assert(layout.cards.every(c=>Math.abs(c.y-layout.cards[0].y)<2),`${width}: three desktop columns`);assert(layout.cards[1].x>=layout.cards[0].right,`${width}: desktop cards sit side by side`)}
  assert.deepEqual(await page.locator('.gradeLearningProgress b').allTextContents(),['0%','0%','0%'],'Fresh account shows earned zero progress');
  // Capture from the top so sticky headers do not end up in the middle of full-page screenshots.
  await scrollTop();await page.screenshot({path:resolve(out,`grades-${width}x${height}.png`),fullPage:true});
  await page.locator('.gradeCard[data-grade="3"] button').scrollIntoViewIfNeeded();
  await page.evaluate(async()=>{scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await new Promise(r=>requestAnimationFrame(r))});
  const lastButtonClear=await page.evaluate(()=>document.querySelector('.gradeCard[data-grade="3"] button').getBoundingClientRect().bottom<=document.querySelector('.bottomNav').getBoundingClientRect().top+1);
  assert(lastButtonClear,`${width}: bottom navigation obscures last grade button`);
  assert.equal(await storage(),untouched,'Viewing grade selection must not write progress');
  report.viewports.push({width,height,...layout,lastButtonClear});
  await page.locator('[data-action=back]').click();assert.equal(await page.locator('.dashboardPage').count(),1,'Back returns to Dashboard');
 }
 report.checks.push('Eight viewport layouts, distinct WebP artwork, aspect ratios, 44px touch targets, zero progress, read-only selection and bottom navigation clearance');

 await page.setViewportSize({width:390,height:844});
 for(const account of ['M20105','teacher']){
  if(account==='teacher'){await page.locator('[data-action=logout]').click();await login(account)}
  for(const grade of [1,2,3]){
   await grades();const beforeView=await storage();
   const card=page.locator(`.gradeCard[data-grade="${grade}"]`),button=card.locator('button');
   assert(await button.isEnabled(),`${account}: grade ${grade} is accessible`);
   const relation=(await card.locator('.gradeRelationText').allTextContents()).join('').trim();
   if(account==='teacher')assert.equal(relation,'','Teacher has no invented current/review/advance relation');
   else assert(relation.includes(['ทบทวน','ระดับปัจจุบัน','เรียนล่วงหน้า'][grade-1]),`Grade ${grade}: real relation to student grade`);
   assert.equal(await storage(),beforeView,'Inspecting grade metadata is read-only');
   if(grade===1)await button.click();else{await button.focus();await button.press(grade===2?'Enter':'Space')}
   await page.locator('[data-unit="0"]').waitFor();assert((await page.locator('main h1').innerText()).startsWith(`ม.${grade}`),`${account}: selected grade opens its units`);
   await page.locator('[data-action=back]').click();assert.equal(await page.locator('.gradeSelectionPage').count(),1,'Units Back returns to grade selection');
   await page.locator('[data-action=back]').click();assert.equal(await page.locator('.dashboardPage').count(),1,'Grade selection Back returns to Dashboard');
   await grades();await page.locator(`.gradeCard[data-grade="${grade}"] button`).click();await page.locator('[data-unit="0"]').click();
   const first=page.locator('.lessonCard[data-lesson]').first(),id=await first.getAttribute('data-lesson'),title=await first.locator('h3').innerText();
   assert(id.startsWith(`G${grade}U`),`${account}: selected grade owns the lesson ID`);
   await first.click();await page.locator('.stageDot.active').waitFor();
   assert((await page.locator('.hudTop>b').innerText()).includes(title),'Actual selected lesson opens');
   assert(await page.evaluate(({id,account})=>!!localStorage.getItem(`slh_v163_${account}_${id}`),{id,account}),'Lesson progress stays in the existing account and lesson key');
   await home();
  }
  await grades();await home();await grades();await page.locator('.bottomNav [data-nav=home]').click();await page.locator('.dashboardPage').waitFor();
 }
 report.checks.push('Student and teacher can open all three grades, actual units and lessons; native Enter/Space; Back units → grades → Dashboard; header and bottom Home');

 // All earned-progress fixtures exist only in this disposable browser profile.
 await page.locator('[data-action=logout]').click();await login();
 const expected=await page.evaluate(()=>{
  localStorage.clear();
  return [1,2,3].map(grade=>{
   const ids=window.__SLH_QA__.lessonIds.filter(id=>id.startsWith(`G${grade}U`));
   localStorage.setItem(`slh_v163_M20105_${ids[0]}`,JSON.stringify({exam:{passed:true,best:80,attempts:1}}));
   return Math.round(100/ids.length)+'%';
  });
 });
 const earned=await storage();await grades();
 assert.deepEqual(await page.locator('.gradeLearningProgress b').allTextContents(),expected,'Percentages use real passed exams and each grade curriculum size');
 assert.equal(await storage(),earned,'Reading earned progress preserves original stored bytes');
 await page.locator('[data-action=back]').click();await grades();assert.equal(await storage(),earned,'Back and re-entry do not rewrite progress');
 const animations=await page.locator('.gradeSelectionScreen').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName||'transition'));
 assert.deepEqual(animations,[],'Reduced motion disables ongoing grade screen animations');
 report.checks.push('Grade progress derived from actual curriculum lesson counts and passed exams, unchanged localStorage on render/re-entry, reduced-motion support');
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){
 report.status='FAIL';report.failure=error.stack;
 if(page)try{await page.evaluate(()=>scrollTo({top:0,left:0,behavior:'instant'}));await page.screenshot({path:resolve(out,'failure.png'),fullPage:true})}catch{}
 throw error;
}finally{
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 await browser?.close();await new Promise(r=>server.close(r));
}
