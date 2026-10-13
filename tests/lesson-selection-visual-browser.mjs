import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const checkpoint='e3de2ef',root=resolve(process.argv[2]||'.'),out=resolve('tmp/lesson-selection-review');
const viewports=[[320,568],[375,812],[390,844],[430,932],[768,1024],[1024,1366],[1366,768],[1440,900]];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024});
const oldIndex=git('show',`${checkpoint}:index.html`),currentIndex=await readFile('index.html','utf8');
const stripPresentation=source=>source.replaceAll('\r\n','\n')
 .replace('<main class="shell lessonSelectionPage">','<main class="shell">')
 .replace('class="woodSign lessonTitleSign"','class="woodSign"')
 .replace(/^[ \t]*<link\b[^\r\n]*href=["']assets\/lesson-selection\/[^"']+\.css(?:\?[^"']*)?["'][^\r\n]*>\r?\n/gm,'');
assert.equal(stripPresentation(currentIndex),stripPresentation(oldIndex),'Entire index is unchanged except the two presentation classes, new stylesheet import and line endings');
const listTemplate=source=>{
 const start=source.indexOf('function renderLessons(){'),end=source.indexOf('function contentProgress(',start),renderer=source.slice(start,end);
 const begin=renderer.indexOf('<div class="lessonList">'),tail="}).join('')}</div>",finish=renderer.indexOf(tail,begin);
 assert(start>0&&end>start&&begin>=0&&finish>begin,'Original lesson list template exists');return renderer.slice(begin,finish+tail.length);
};
assert.equal(listTemplate(currentIndex),listTemplate(oldIndex),'Lesson list markup, lesson IDs, cover paths, order, status and button logic remain exact');
const protectedChanges=git('diff','--name-only',checkpoint,'--','assets','scripts','.github').trim().split('\n').filter(p=>p&&!p.startsWith('assets/lesson-selection/'));
assert.deepEqual(protectedChanges,[],'All pre-existing assets, learning content, handlers and deployment files remain unchanged');
await mkdir(out,{recursive:true});
const report={checkpoint,scope:'PASS',units:[],viewports:[],stateComparisons:[],checks:[],errors:[]};
const baselineRecords={checkpoint,untouched:{},layouts:{},savedStates:{}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),baseline=pathname.startsWith('/baseline/');
  const relative=pathname.replace(/^\/(?:baseline|current)\//,'/');
  if(relative==='/favicon.ico'){res.writeHead(204);res.end();return}
  const asset=relative.endsWith('/')?relative+'index.html':relative,path=resolve(root,'.'+asset);
  if(!path.startsWith(root+sep))throw Error('Outside preview root');
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');
  res.end(baseline&&asset==='/index.html'?oldIndex:await readFile(path));
 }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,current,baseline;
try{
 try{browser=await playwright.chromium.launch({channel:'chrome',headless:true});report.browser='Chrome'}catch{browser=await playwright.chromium.launch({headless:true});report.browser='Playwright Chromium'}
 const makePage=async(prefix)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`${prefix} JavaScript: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))report.errors.push(`${prefix} Console: ${m.text()}`)});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(`${prefix} HTTP ${r.status()}: ${r.url()}`)});
  await page.goto(`http://127.0.0.1:${server.address().port}/${prefix}/`);await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});return page;
 };
 baseline=await makePage('baseline');current=await makePage('current');
 const login=async(page,id='M20105')=>{await page.locator('#loginUser').fill(id);await page.locator('#loginPass').fill('1234');await page.locator('[data-action=login]').click();await page.locator('.dashboardPage').waitFor()};
 const home=async page=>{await page.locator('[data-action=home]').click();await page.locator('.dashboardPage').waitFor()};
 const openList=async(page,grade,unit)=>{await page.locator('[data-dashboard-grades]').click();await page.locator(`.gradeCard[data-grade="${grade}"] button`).click();await page.locator(`[data-unit="${unit}"]`).click();await page.locator('.lessonList').waitFor()};
 const storage=page=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));
 const scrollTop=page=>page.evaluate(async()=>{scrollTo({top:0,left:0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const ready=async page=>{
  for(const image of await page.locator('.lessonList img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode())}
  const artwork=await page.evaluate(async()=>{
   const sign=document.querySelector('.lessonTitleSign');if(!sign)return [];
   const styles=[getComputedStyle(document.querySelector('#app'),'::before'),getComputedStyle(sign),getComputedStyle(sign,'::before')];
   const urls=[...new Set(styles.flatMap(style=>[style.backgroundImage,style.borderImageSource].flatMap(value=>[...value.matchAll(/url\(["']?(.*?)["']?\)/g)].map(match=>match[1]))))];
   return Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();return {src:new URL(url).pathname.replace(/^\/(?:baseline|current)\//,''),width:image.naturalWidth,height:image.naturalHeight}}));
  });
  await page.evaluate(()=>document.fonts.ready);await scrollTop(page);await page.mouse.move(0,0);return artwork;
 };
 const snapshot=page=>page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const decorative=property=>property==='box-shadow'||property==='text-shadow'||property==='filter'||property.startsWith('background-')||property.startsWith('outline-')||(/^border-.*-color$/.test(property));
  const style=(e,allowDecoration=false)=>{const s=getComputedStyle(e);return Object.fromEntries([...s].filter(k=>!k.startsWith('--')&&!(allowDecoration&&decorative(k))).map(k=>[k,s.getPropertyValue(k).replaceAll('/baseline/','/SITE/').replaceAll('/current/','/SITE/')]))};
  const relative=(e,parent,allowDecoration=false)=>{const r=box(e),p=box(parent);return {tag:e.tagName,class:e.className,box:{x:r.x-p.x,y:r.y-p.y,width:r.width,height:r.height},style:style(e,allowDecoration)}};
  const list=document.querySelector('.lessonList'),cards=[...list.querySelectorAll('.lessonCard')];
  const bar=selector=>{const e=document.querySelector(selector);return {html:e.outerHTML,box:box(e),style:style(e),children:[...e.querySelectorAll('*')].map(child=>relative(child,e))}};
  return {
   header:document.querySelector('main h1').innerText,subtitle:document.querySelector('main .subWood').innerText,
   data:cards.map(card=>({id:card.dataset.lesson,title:card.querySelector('h3').innerText,status:card.querySelector('.lessonStatus').innerText,button:card.querySelector('button').innerText,buttonClass:card.querySelector('button').className,cover:card.querySelector('img')?.getAttribute('src'),html:card.outerHTML})),
   geometry:{width:box(list).width,height:box(list).height,style:style(list),cards:cards.map(card=>({...relative(card,list,true),children:[...card.querySelectorAll('*')].map(child=>relative(child,card,true))}))},
   nav:{topbar:bar('.topbar'),bottomNav:bar('.bottomNav')},
   checkpoint:document.querySelector('.checkpointBanner')?.innerText||'',flag:document.querySelectorAll('.checkpointBanner svg.uiIcon--flag').length,
   images:cards.map(card=>{const image=card.querySelector('img'),r=box(image);return {src:image.getAttribute('src'),loaded:image.complete&&image.naturalWidth>0,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:r.width,height:r.height,fit:getComputedStyle(image).objectFit}}),
   overflow:document.documentElement.scrollWidth>innerWidth,textOverflow:[...document.querySelectorAll('.lessonCard h3,.lessonStatus,main h1,.subWood,.checkpointBanner p')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>e.innerText),
   collisions:cards.flatMap((a,i)=>cards.slice(i+1).filter(b=>{const ar=box(a),br=box(b);return ar.x<br.right&&ar.right>br.x&&ar.y<br.bottom&&ar.bottom>br.y}).map(()=>i))
  };
 });
 await login(baseline);await login(current);
 const curriculum=await baseline.evaluate(()=>Object.entries(window.SLH_DATA.curriculum).flatMap(([grade,units])=>units.map((u,index)=>({grade:+grade,index,title:u.title,lessons:u.lessons.map(l=>({id:l.id,title:l.title}))}))));
 assert.equal(curriculum.length,21);assert.equal(curriculum.reduce((n,u)=>n+u.lessons.length,0),40);
 const pristine=await storage(current);
 for(const unit of curriculum){
  await openList(baseline,unit.grade,unit.index);await openList(current,unit.grade,unit.index);await ready(baseline);await ready(current);
  const old=await snapshot(baseline),actual=await snapshot(current),key=`G${unit.grade}U${unit.index+1}`;baselineRecords.untouched[key]=old.data;
  assert.deepEqual(actual.data,old.data,`${key}: all original lesson IDs, title text, covers, order, status and native button markup`);
  assert.equal(actual.header,unit.title);assert.equal(actual.subtitle,old.subtitle);assert.equal(actual.checkpoint,'','Fresh lessons have no fabricated resume notice');
  assert.equal(await storage(current),pristine,'Reading a lesson list never writes progress');report.units.push({key,lessonCount:actual.data.length,exactOriginalData:true});
  await home(baseline);await home(current);
 }
 const largestUnits=[1,2,3].map(grade=>curriculum.filter(u=>u.grade===grade).sort((a,b)=>b.lessons.length-a.lessons.length)[0]);
 const longestHeader=[...curriculum].sort((a,b)=>b.title.length-a.title.length)[0];
 const longestLesson=[...curriculum].sort((a,b)=>Math.max(...b.lessons.map(l=>l.title.length))-Math.max(...a.lessons.map(l=>l.title.length)))[0];
 const cases=[...new Map([...largestUnits,longestHeader,longestLesson].map(u=>[`${u.grade}-${u.index}`,u])).values()];
 report.representativeCases=cases.map(u=>({grade:u.grade,unit:u.index+1,title:u.title}));
 for(const [width,height] of viewports){
  await baseline.setViewportSize({width,height});await current.setViewportSize({width,height});
  for(const unit of cases){
   await openList(baseline,unit.grade,unit.index);await openList(current,unit.grade,unit.index);await ready(baseline);const artwork=await ready(current);
   const old=await snapshot(baseline),actual=await snapshot(current),key=`${width}x${height}-G${unit.grade}U${unit.index+1}`;baselineRecords.layouts[key]={data:old.data,geometry:old.geometry,nav:old.nav};
   assert.deepEqual(actual.data,old.data,`${key}: original cards`);assert.deepEqual(actual.geometry,old.geometry,`${key}: original geometry, fonts, spacing, grid and nondecorative styles`);
   assert.deepEqual(actual.nav,old.nav,`${key}: navigation markup, geometry and complete styles are unchanged`);
   assert(!actual.overflow,`${key}: horizontal overflow`);assert.deepEqual(actual.textOverflow,[],`${key}: title/text overflow`);assert.deepEqual(actual.collisions,[],`${key}: lesson cards collide`);
   assert(actual.images.every(i=>i.loaded),`${key}: original covers decode`);assert(actual.images.every(i=>['cover','contain','scale-down'].includes(i.fit)||Math.abs(i.width/i.height-i.naturalWidth/i.naturalHeight)<.03),`${key}: cover images preserve proportions`);
   assert.equal(artwork.length,2,`${key}: backdrop and title frame artwork`);assert(artwork.every(i=>i.src.startsWith('assets/lesson-selection/')&&i.src.endsWith('.webp')&&i.width>0&&i.height>0),`${key}: real WebP artwork loads`);
   const titleClear=await current.evaluate(()=>document.querySelector('.lessonTitleSign').getBoundingClientRect().bottom<=document.querySelector('.lessonList').getBoundingClientRect().top+1);assert(titleClear,`${key}: title artwork overlaps lessons`);
   await scrollTop(current);await current.screenshot({path:resolve(out,`lessons-${key}.png`),fullPage:true});
   await current.locator('.lessonCard button').last().scrollIntoViewIfNeeded();await current.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
   const navClear=await current.evaluate(()=>document.querySelector('.lessonCard:last-child button').getBoundingClientRect().bottom<=document.querySelector('.bottomNav').getBoundingClientRect().top+1);assert(navClear,`${key}: bottom navigation covers the last lesson`);
   report.viewports.push({width,height,grade:unit.grade,unit:unit.index+1,unchangedCardGeometry:true,unchangedNavigation:true,titleClear,navClear,artwork});await home(baseline);await home(current);
  }
 }
 report.checks.push('All21units/40lessons retain exact original markup/data; representative dense units and longest titles compared at8sizes, including320px and1024px portrait');
 const fixtures={G1U1L1:{contentDone:true,contentIndex:1,resume:'lab',visited:{content:true,lab:true}},G2U3L1:{contentDone:true,contentIndex:2,resume:'e2',visited:{content:true,e2:true}},G2U3L2:{contentIndex:2,resume:'content',visited:{content:true}},G3U1L1:{exam:{passed:true,best:80,attempts:1},resume:'result'}};
 for(const page of [baseline,current]){
  await page.setViewportSize({width:390,height:844});await page.evaluate(records=>{localStorage.clear();for(const [id,p] of Object.entries(records))localStorage.setItem(`slh_v163_M20105_${id}`,JSON.stringify(p))},fixtures);
 }
 const earned=await storage(current);
 for(const [grade,unit] of [[1,0],[2,2],[3,0]]){
  await openList(baseline,grade,unit);await openList(current,grade,unit);await ready(baseline);await ready(current);
  const old=await snapshot(baseline),actual=await snapshot(current),key=`G${grade}U${unit+1}`;baselineRecords.savedStates[key]=old;
  assert.deepEqual(actual.data,old.data,`${key}: untouched, resumed and passed lesson labels/markup remain unchanged`);assert.deepEqual(actual.geometry,old.geometry,`${key}: resumed and passed card layout remains unchanged`);
  assert.equal(actual.checkpoint,old.checkpoint,`${key}: original resume notice text`);assert.equal(actual.flag,old.flag,`${key}: original SVG resume flag`);
  if(grade!==3){assert.equal(actual.flag,1);assert(actual.checkpoint.includes('เรียนต่อจากจุดล่าสุด'));assert(actual.checkpoint.includes('แตะ “เรียนต่อ” ที่ภารกิจเพื่อกลับไปยังจุดที่บันทึกไว้'))}
  if(grade===3){const card=current.locator('[data-lesson="G3U1L1"]');assert.equal(await card.locator('button').innerText(),'ทบทวน');assert(await card.locator('button').evaluate(e=>e.classList.contains('green')));assert.deepEqual(await card.locator('button').evaluate(e=>({background:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).color})),await baseline.locator('[data-lesson="G3U1L1"] button').evaluate(e=>({background:getComputedStyle(e).backgroundImage,color:getComputedStyle(e).color})),'Passed green button decoration is preserved')}
  assert.equal(await storage(current),earned,'Reading resumed/completed status preserves stored bytes');await scrollTop(current);await current.screenshot({path:resolve(out,`lesson-state-${key}.png`),fullPage:true});
  report.stateComparisons.push({grade,unit:unit+1,exactLabels:true,resumeFlag:actual.flag});await home(baseline);await home(current);
 }
 for(const [grade,stage,key] of [[1,'lab','Enter'],[2,'content','Space'],[3,'result',null]]){
  await openList(current,grade,0);const first=current.locator('.lessonCard').first(),id=await first.getAttribute('data-lesson');assert(id.startsWith(`G${grade}U1L`));
  const button=first.locator('button');if(key){await current.keyboard.press('Tab');await button.focus();assert.equal(await button.evaluate(e=>document.activeElement===e),true);assert(await button.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'&&parseFloat(getComputedStyle(e).outlineWidth)>=2),'Keyboard focus has a visible outline');await button.press(key)}else await button.click();
  await current.locator('.stageDot.active').waitFor();assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),stage,'Native card button opens the actual saved stage');
  await current.locator('[data-action=back]').click();assert.equal(await current.locator('.lessonSelectionPage').count(),1,'Learning Back returns to the lesson list');
  await current.locator('[data-action=back]').click();assert.equal(await current.locator('.unitSelectionPage').count(),1,'Lesson list Back returns to units');await home(current);
 }
 await openList(current,2,2);await current.locator('[data-lesson="G2U3L2"] button').click();assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'content');assert.equal(await current.evaluate(()=>window.__SLH_QA__.snapshot('G2U3L2').contentIndex),2,'Saved content index is preserved');await home(current);
 await openList(current,2,2);await current.locator('[data-lesson="G2U3L1"] button').click();assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'e2');
 await current.locator('[data-ex-q="0"]').first().click();const saved=await current.evaluate(()=>window.__SLH_QA__.snapshot('G2U3L1').ex.e2.state);
 const reopen=async()=>{await openList(current,2,2);await current.locator('[data-lesson="G2U3L1"] button').click();assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'e2');assert.deepEqual(await current.evaluate(()=>window.__SLH_QA__.snapshot('G2U3L1').ex.e2.state),saved,'Exact exercise questions and answers resume')};
 await home(current);await reopen();await home(current);await current.locator('[data-action=logout]').click();await login(current);await reopen();await home(current);await current.reload();await login(current);await reopen();await home(current);
 report.checks.push('Original resume notice/SVG, passed green button, nativeEnter/Space, actual grade lesson IDs, Back/Home, lab/contentindex/e2 resume, exact exercise answers afterHome/Logout/Reload');
 // Open identical real reading pages and ensure the presentation stylesheet matches nothing there.
 for(const page of [baseline,current]){await openList(page,1,1);await page.locator('.lessonCard button').first().click();await page.locator('.readingMode').waitFor()}
 assert.equal(await current.locator('.lessonSelectionPage,.lessonTitleSign').count(),0,'Lesson-selection classes are absent from reading');
 const matchedRules=await current.evaluate(()=>{
  const matches=[];const walk=rules=>{for(const rule of rules){if(rule.cssRules){if(!rule.conditionText||!rule.media||matchMedia(rule.conditionText).matches)walk(rule.cssRules);continue}if(!rule.selectorText)continue;for(const selector of rule.selectorText.split(',')){const base=selector.trim().replace(/::(?:before|after)\b/g,'');try{if(document.querySelector(base))matches.push(selector.trim())}catch{}}}};
  for(const sheet of document.styleSheets)if(sheet.href?.includes('/assets/lesson-selection/'))walk(sheet.cssRules);return matches;
 });
 assert.deepEqual(matchedRules,[],'Lesson-selection CSS does not match reading-page elements');
 const readingStyle=page=>page.locator('.readingMode').evaluate(e=>{const s=getComputedStyle(e),pseudo=getComputedStyle(document.querySelector('#app'),'::before');return {font:s.font,fontSize:s.fontSize,color:s.color,padding:s.padding,background:s.backgroundImage,pseudoBackground:pseudo.backgroundImage,pseudoContent:pseudo.content}});
 assert.deepEqual(await readingStyle(current),await readingStyle(baseline),'Reading typography and backdrop remain identical');
 await home(current);await openList(current,2,2);
 assert.deepEqual(await current.locator('.lessonSelectionPage').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName||'transition')),[],'Reduced motion disables list animations');
 await current.emulateMedia({reducedMotion:'no-preference'});
 const pressButton=current.locator('.lessonCard > .pixelBtn.blue').first();await pressButton.scrollIntoViewIfNeeded();
 const rect=await pressButton.boundingBox();await current.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await current.mouse.down();
 assert.notEqual(await pressButton.evaluate(e=>getComputedStyle(e).transform),'none','Blue lesson button provides press feedback');
 await current.mouse.move(0,0);await current.mouse.up();await current.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await current.locator('.lessonSelectionPage').count(),1,'Releasing outside the pressed button does not enter a lesson');
 report.checks.push('No presentation CSS leakage into reading; reading computed styles unchanged; reduced-motion, visible keyboard focus and button press feedback');
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){
 report.status='FAIL';report.failure=error.stack;
 if(current)try{await current.evaluate(()=>scrollTo({top:0,left:0,behavior:'instant'}));await current.screenshot({path:resolve(out,'failure.png'),fullPage:true})}catch{}
 throw error;
}finally{
 await writeFile(resolve(out,'baseline-records.json'),JSON.stringify(baselineRecords));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,checkpoint,scope:report.scope,units:report.units.length,lessons:report.units.reduce((n,u)=>n+u.lessonCount,0),layoutComparisons:report.viewports.length,stateComparisons:report.stateComparisons.length,checks:report.checks,errors:report.errors,failure:report.failure},null,2));
 await browser?.close();await new Promise(r=>server.close(r));
}
