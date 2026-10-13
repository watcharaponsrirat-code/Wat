import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

// Disposable local profiles only. Production code, content and saved accounts are never altered.
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve(process.argv[2]||'.'),out=resolve(root,'tmp/reading-adventure-review'),checkpoint='424fae3';
const lesson='G1U1L1',stages=['content','lab','g1','g2','g3','e1','e2','e3','exam','result'];
const viewports=[[375,812],[390,844],[430,932],[768,1024],[1280,720],[1366,768],[1440,900]];
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
const oldIndex=git('show',`${checkpoint}:index.html`),newIndex=await readFile(resolve(root,'index.html'),'utf8');
const stripTheme=source=>source.replaceAll('\r\n','\n').replace(/^[ \t]*<link\b[^\r\n]*href=["']assets\/theme\/science-adventure\.css(?:\?[^"']*)?["'][^\r\n]*>\r?\n/gm,'');
assert.equal(stripTheme(newIndex),stripTheme(oldIndex),'Original HTML, educational content, scripts, IDs, DOM templates and logic are byte-exact apart from the isolated stylesheet import and newline encoding');
const protectedChanges=git('diff','--name-only',checkpoint,'--','index.html','assets','scripts','.github').trim().split('\n').filter(file=>file&&file!=='index.html'&&file!=='assets/theme/science-adventure.css');
assert.deepEqual(protectedChanges,[],'No pre-existing learning content, imagery, scripts, contracts or styles have changed');
await mkdir(out,{recursive:true});
const report={checkpoint,lesson,scope:'PASS',viewports:[],stageNavigation:[],stateComparisons:[],isolation:[],checks:[],errors:[],externalRequests:[]};
const baselineRecords={content:null,states:{},isolation:{}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
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
const normalize=value=>{
 if(Array.isArray(value))return value.map(normalize);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,normalize(item)]));
 if(typeof value==='number'&&value>1e12)return '[timestamp]';
 if(typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:/.test(value))return '[timestamp]';
 return value;
};
try{
 try{browser=await playwright.chromium.launch({channel:'chrome',headless:true});report.browser='Chrome'}catch{browser=await playwright.chromium.launch({headless:true});report.browser='Playwright Chromium'}
 const makePage=async prefix=>{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.protocol==='data:'||url.hostname==='127.0.0.1')return route.continue();
   report.externalRequests.push(url.href);return route.abort('blockedbyclient');
  });
  // Both isolated profiles receive identical random sequences; no application code is changed.
  await context.addInitScript(()=>{let seed=712031;window.__reviewSeed=()=>{seed=712031};Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(`${prefix} JavaScript: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('favicon.ico'))report.errors.push(`${prefix} Console: ${message.text()}`)});
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push(`${prefix} HTTP ${response.status()}: ${response.url()}`)});
  await page.goto(`http://127.0.0.1:${server.address().port}/${prefix}/`);return page;
 };
 const settle=async page=>{await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});await page.mouse.move(0,0)};
 const seed=page=>page.evaluate(()=>window.__reviewSeed());
 const login=async page=>{await page.locator('#loginUser').fill('M20105');await page.locator('#loginPass').fill('1234');await seed(page);await page.locator('[data-action=login]').click();await page.locator('.dashboardPage').waitFor();await settle(page)};
 const home=async page=>{await page.locator('[data-action=home]').click();await page.locator('.dashboardPage').waitFor();await settle(page)};
 const list=async page=>{await page.locator('[data-dashboard-grades]').click();await page.locator('.gradeCard[data-grade="1"] button').click();await page.locator('[data-unit="0"]').click();await page.locator('.lessonList').waitFor();await settle(page)};
 const openFirst=async page=>{await list(page);await seed(page);await page.locator(`[data-lesson="${lesson}"] button`).click();await page.locator('.stageDot.active').waitFor();await settle(page)};
 const storage=page=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(key=>{let value=localStorage.getItem(key);try{value=JSON.parse(value)}catch{}return [key,value]})));
 const compareState=async label=>{
  const old=normalize(await storage(baseline)),actual=normalize(await storage(current));
  assert.deepEqual(actual,old,`${label}: original localStorage schema, progress, mastery and saved activity state`);baselineRecords.states[label]=old;report.stateComparisons.push(label);
 };
 const top=page=>page.evaluate(async()=>{scrollTo({top:0,left:0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const content=page=>page.locator('.readingPage').evaluate(element=>({html:element.outerHTML,text:element.textContent,images:[...element.querySelectorAll('img')].map(image=>({src:image.getAttribute('src'),alt:image.alt,html:image.outerHTML})),svg:[...element.querySelectorAll('svg')].map(image=>image.outerHTML),sectionIds:[...element.querySelectorAll('[id]')].map(section=>section.id)}));
 const activityData=page=>page.locator('.stageHUD').evaluate(element=>({html:element.outerHTML,buttons:[...element.querySelectorAll('.stageDot')].map(button=>({stage:button.dataset.stage,text:button.textContent,active:button.getAttribute('aria-current'),classes:button.className}))}));
 const ready=async page=>{
  for(const image of await page.locator('.readingPage img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(element=>element.decode())}
  await settle(page);await top(page);
  return page.evaluate(async()=>{
   const nodes=[document.documentElement,document.body,document.querySelector('#app'),document.querySelector('#skyFX'),...document.querySelectorAll('.readingMode,.stageHUD,.hudTop,.hudTop b,.contentHeader,.readingPage,.contentBody')].filter(Boolean);
   const urls=[...new Set(nodes.flatMap(node=>[null,'::before','::after'].flatMap(pseudo=>{const style=getComputedStyle(node,pseudo);return [style.backgroundImage,style.borderImageSource].flatMap(value=>[...value.matchAll(/url\(["']?(.*?)["']?\)/g)].map(match=>match[1]))})))];
   return Promise.all(urls.filter(url=>!url.startsWith('data:')).map(async url=>{const image=new Image();image.src=url;await image.decode();return {src:new URL(url).pathname.replace(/^\/(?:baseline|current)\//,''),width:image.naturalWidth,height:image.naturalHeight}}));
  });
 };
 const layout=page=>page.evaluate(()=>{
  const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const buttons=[...document.querySelectorAll('.stageDot,[data-content-complete]')];
  const text=[...document.querySelectorAll('.readingPage h1,.readingPage h2,.readingPage p,.readingPage li,.hudTop,.stageHint,.stageDot,.stageDot small')];
  const hiddenText=text.filter(element=>{const s=getComputedStyle(element);return s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0}).map(element=>element.textContent);
  const textOverflow=text.filter(element=>element.clientWidth&&element.scrollWidth>element.clientWidth+1).map(element=>({class:element.className,text:element.textContent}));
  const clippedButtons=buttons.filter(button=>button.scrollWidth>button.clientWidth+1||button.scrollHeight>button.clientHeight+1).map(button=>button.textContent);
  const stageRects=[...document.querySelectorAll('.stageDot')].map(rect);
  const collisions=stageRects.flatMap((a,index)=>stageRects.slice(index+1).filter(b=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y).map(()=>index));
  const hud=rect(document.querySelector('.stageHUD')),article=rect(document.querySelector('.readingPage'));
  return {horizontalOverflow:document.documentElement.scrollWidth>innerWidth,hiddenText,textOverflow,clippedButtons,collisions,hudClear:hud.bottom<=article.y+1,hudPosition:getComputedStyle(document.querySelector('.stageHUD')).position,buttonSizes:buttons.map(button=>({stage:button.dataset.stage||'complete',...rect(button)})),images:[...document.querySelectorAll('.readingPage img')].map(image=>{const r=rect(image),s=getComputedStyle(image);return {src:image.getAttribute('src'),loaded:image.complete&&image.naturalWidth>0,width:r.width,height:r.height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,fit:s.objectFit}}),stageRects};
 });
 const isolation=page=>page.evaluate(()=>{
  const replace=value=>value.replaceAll('/baseline/','/SITE/').replaceAll('/current/','/SITE/');
  const style=(element,pseudo)=>{const s=getComputedStyle(element,pseudo);return Object.fromEntries([...s].filter(name=>!name.startsWith('--')&&name!=='caret-color').map(name=>[name,replace(s.getPropertyValue(name))]))};
  const selected=[...document.querySelectorAll('html,body,#skyFX,#app,.topbar,.topinner,.shell,.stageHUD,.stageDot,.readingPage,.contentHeader,.contentBody,.readingSection,.readingOutline,.readingWorked,.readingSources,.readingComplete,.panel,.simPanel,.gameStage,.exerciseCard,.examCard,.pixelBtn')];
  return selected.map(element=>({tag:element.tagName,class:element.className,style:style(element),before:style(element,'::before'),after:style(element,'::after')}));
 });
 baseline=await makePage('baseline');current=await makePage('current');
 for(const page of [baseline,current]){await login(page);await openFirst(page);await ready(page)}
 assert.equal(await current.locator('#reading-G1U1L1S1').count(),1,'First approved original lesson section identifies the prototype');
 const original=await content(baseline);baselineRecords.content=original;
 assert.deepEqual(await content(current),original,'Every original content character, paragraph, heading, table, formula, scientific image, infographic and DOM node is exact');
 assert.deepEqual(await activityData(current),await activityData(baseline),'Ten activity labels, IDs, order, statuses and markup are exact');
 await compareState('initial-reader');
 report.content={exactDOM:true,exactText:true,images:original.images.length,svg:original.svg.length,sectionIds:original.sectionIds};
 for(const [width,height] of viewports){
  await baseline.setViewportSize({width,height});await current.setViewportSize({width,height});await ready(baseline);const artwork=await ready(current);
  assert.deepEqual(await content(current),original,`${width}: responsive presentation preserves the complete original document`);
  assert.deepEqual(await activityData(current),await activityData(baseline),`${width}: original activity controls`);
  const actual=await layout(current),label=`${width}x${height}`;
  assert(!actual.horizontalOverflow,`${label}: horizontal page overflow`);assert.deepEqual(actual.hiddenText,[],`${label}: hidden educational text`);assert.deepEqual(actual.textOverflow,[],`${label}: text overflow`);assert.deepEqual(actual.clippedButtons,[],`${label}: clipped button text`);assert.deepEqual(actual.collisions,[],`${label}: overlapping activity buttons`);assert(actual.hudClear,`${label}: activity navigation overlaps content`);
  assert(actual.buttonSizes.every(button=>button.width>=44&&button.height>=44),`${label}: activity/continue buttons meet 44px touch size`);
  assert(actual.images.every(image=>image.loaded),`${label}: all original science images decode`);
  assert(actual.images.every(image=>image.fit==='contain'||image.fit==='scale-down'||Math.abs(image.width/image.height-image.naturalWidth/image.naturalHeight)<.03),`${label}: scientific image proportions preserved without cropping`);
  assert(artwork.some(image=>/\.webp$|\.avif$/.test(image.src)),`${label}: dedicated optimized artwork loads`);
  await top(current);await current.screenshot({path:resolve(out,`reading-top-${label}.png`)});await current.screenshot({path:resolve(out,`reading-${label}.png`),fullPage:true});
  await current.locator('[data-content-complete]').scrollIntoViewIfNeeded();
  const continueClear=await current.locator('[data-content-complete]').evaluate(button=>{const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return r.y>=0&&r.bottom<=innerHeight&&button.contains(document.elementFromPoint(x,y))});
  assert(continueClear,`${label}: continue button is visible and not covered by navigation`);
  await current.screenshot({path:resolve(out,`reading-complete-${label}.png`)});report.viewports.push({width,height,...actual,artwork,continueClear});
 }
 report.checks.push('Exact baseline reading DOM, text, section order, scientific imagery and ten navigation controls at all seven requested viewport sizes; 21 review screenshots');
 for(const page of [baseline,current]){await page.setViewportSize({width:390,height:844});await top(page)}
 // All native stage buttons are actually clicked, then compared against baseline saved state.
 for(const stage of stages){
  for(const page of [baseline,current]){await seed(page);await page.locator(`.stageHUD [data-stage="${stage}"]`).click();await settle(page)}
  assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),stage);
  assert.equal(await current.locator('.stageHUD .stageDot').count(),10);
  assert.deepEqual(await activityData(current),await activityData(baseline),`${stage}: actual original status labels and progression`);await compareState(`stage-${stage}`);
  if(stage!=='content'){
   const old=await isolation(baseline),actual=await isolation(current);baselineRecords.isolation[stage]=old;
   assert.deepEqual(actual,old,`${stage}: every selected activity and global computed/pseudo style remains unchanged`);report.isolation.push({stage,exactComputedStyles:true});
  }
  report.stageNavigation.push(stage);
 }
 // Re-enter content through its real control, and exercise the original completion handler.
 for(const page of [baseline,current]){await page.locator('.stageHUD [data-stage="content"]').click();await page.locator('[data-content-complete]').scrollIntoViewIfNeeded();await seed(page);await page.locator('[data-content-complete]').click();await page.locator('.labMode').waitFor();await settle(page)}
 await compareState('complete-to-simulation');
 const saved=await current.evaluate(id=>window.__SLH_QA__.snapshot(id),lesson);
 assert.equal(saved.contentDone,true);assert.equal(saved.contentIndex,await current.evaluate(id=>window.SLH_DATA.packs[id].length,lesson));assert.equal(saved.resume,'lab');
 for(const page of [baseline,current]){await page.locator('[data-action=back]').click();await page.locator('.lessonList').waitFor();await seed(page);await page.locator(`[data-lesson="${lesson}"] button`).click();await settle(page)}
 assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'lab','Native Back and Continue reopen the saved lab');await compareState('back-and-resume');
 for(const page of [baseline,current]){await home(page);await page.reload();await login(page);await openFirst(page)}
 assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'lab','Saved progress survives reload and ordinary login/navigation');await compareState('reload-and-resume');
 report.checks.push('All ten native stage buttons, Back, reading completion to Simulation, native lesson Continue and reload/login resume; exact baseline localStorage states with timestamps normalized');
 // Confirm unrelated readers at mobile and desktop widths do not inherit the prototype styling.
 for(const [width,height] of [[390,844],[1366,768]])for(const id of ['G1U2L1','G2U3L1']){
  for(const page of [baseline,current]){await page.setViewportSize({width,height});await seed(page);await page.evaluate(id=>window.__SLH_QA__.open(id,'content'),id);await settle(page)}
  const old=await isolation(baseline),actual=await isolation(current),key=`${id}-${width}`;baselineRecords.isolation[key]=old;
  assert.deepEqual(await content(current),await content(baseline),`${key}: untouched reader DOM`);assert.deepEqual(actual,old,`${key}: untouched reader and global computed styles`);report.isolation.push({lesson:id,width,exactDOM:true,exactComputedStyles:true});
 }
 for(const page of [baseline,current]){await page.evaluate(id=>window.__SLH_QA__.open(id,'content'),lesson);await ready(page)}
 const activeAnimations=await current.locator('.readingMode').evaluate(element=>element.getAnimations({subtree:true}).filter(animation=>animation.playState==='running').map(animation=>animation.animationName||'transition'));
 assert.deepEqual(activeAnimations,[],'Reduced motion disables all running reading animations');
 await current.locator('.stageHUD [data-stage="content"]').hover();
 assert.equal(await current.locator('.stageHUD [data-stage="content"]').evaluate(button=>getComputedStyle(button).transform),'none','Reduced motion also prevents hover translation');
 await current.mouse.move(0,0);
 await current.keyboard.press('Tab');await current.locator('.stageHUD [data-stage="content"]').focus();
 assert(await current.locator('.stageHUD [data-stage="content"]').evaluate(button=>document.activeElement===button&&getComputedStyle(button).outlineStyle!=='none'&&parseFloat(getComputedStyle(button).outlineWidth)>=2),'Keyboard focus is visible');
 await current.locator('.stageHUD [data-stage="lab"]').focus();await current.locator('.stageHUD [data-stage="lab"]').press('Enter');assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'lab');
 await current.locator('.stageHUD [data-stage="content"]').focus();await current.locator('.stageHUD [data-stage="content"]').press('Space');assert.equal(await current.locator('.stageDot.active').getAttribute('data-stage'),'content');
 report.checks.push('All nine other activities and two unrelated readers preserve baseline styles; reduced motion, visible keyboard focus and Enter/Space activation verified');
 assert.deepEqual(report.externalRequests,[],'No live API or external network request was made');assert.deepEqual(report.errors,[],'No JavaScript, console or failed-resource errors');report.status='PASS';
}catch(error){
 report.status='FAIL';report.failure=error.stack;
 if(current)try{await current.screenshot({path:resolve(out,'failure.png'),fullPage:true})}catch{}
 throw error;
}finally{
 await writeFile(resolve(out,'baseline-records.json'),JSON.stringify(baselineRecords));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,checkpoint,lesson,viewports:report.viewports.length,stageNavigation:report.stageNavigation,stateComparisons:report.stateComparisons.length,isolation:report.isolation.length,checks:report.checks,errors:report.errors,failure:report.failure},null,2));
 await browser?.close();await new Promise(r=>server.close(r));
}
