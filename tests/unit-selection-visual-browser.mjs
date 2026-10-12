import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const checkpoint='49c08d8',root=resolve(process.argv[2]||'.'),out=resolve('tmp/unit-selection-review');
const viewports=[[320,568],[375,812],[390,844],[430,932],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900]];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024});
const oldIndex=git('show',`${checkpoint}:index.html`),oldDashboardCSS=git('show',`${checkpoint}:assets/dashboard/dashboard.css`);
const currentIndex=await readFile('index.html','utf8'),currentDashboardCSS=await readFile('assets/dashboard/dashboard.css','utf8');
const renderer=source=>{
 const start=source.indexOf('function renderUnits(){'),end=source.indexOf('const LESSON_COVERS=',start);
 assert(start>0&&end>start,'Unit renderer boundaries exist');return {start,end,text:source.slice(start,end)};
};
const stripUnitPresentation=source=>{
 return source
  .replaceAll('\r\n','\n')
  .replace('<main class="shell unitSelectionPage">','<main class="shell">')
  .replace('class="woodSign unitTitleSign"','class="woodSign"')
  .replace(/^[ \t]*<link\b[^\r\n]*href=["']assets\/unit-selection\/[^"']+\.css(?:\?[^"']*)?["'][^\r\n]*>\r?\n/gm,'')
  .replace(/(assets\/dashboard\/dashboard\.css)\?[^"']*/g,'$1');
};
assert.equal(stripUnitPresentation(currentIndex),stripUnitPresentation(oldIndex),'The entire index remains byte-for-byte identical except the two unit presentation classes, stylesheet import and dashboard stylesheet version');
const gridTemplate=source=>{
 const text=renderer(source).text,start=text.indexOf('<div class="grid unitGrid">'),tail="}).join('')}</div>",end=text.indexOf(tail,start);
 assert(start>=0&&end>start,'Original unit grid template is present');return text.slice(start,end+tail.length);
};
assert.equal(gridTemplate(currentIndex),gridTemplate(oldIndex),'Original unit grid, cards, descriptions, order and progress calculation remain exact');
assert(currentDashboardCSS.replaceAll('\r\n','\n').startsWith(oldDashboardCSS.replaceAll('\r\n','\n')),'Dashboard position fix appends overrides without rewriting existing styles or keyframes');
const protectedChanges=git('diff','--name-only',checkpoint,'--','assets','scripts','.github').trim().split('\n').filter(p=>p&&!p.startsWith('assets/unit-selection/')&&p!=='assets/dashboard/dashboard.css');
assert.deepEqual(protectedChanges,[],'Login, grade cards, learning content, images, handlers and other protected assets remain unchanged');

await mkdir(out,{recursive:true});
const report={checkpoint,scope:'PASS',unitComparisons:[],welcomeComparisons:[],checks:[],errors:[]};
const baselineRecords={checkpoint,units:{},welcome:{}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),baseline=pathname.startsWith('/baseline/');
  const relative=pathname.replace(/^\/(?:baseline|current)\//,'/');
  if(relative==='/favicon.ico'){res.writeHead(204);res.end();return}
  const asset=relative.endsWith('/')?relative+'index.html':relative,path=resolve(root,'.'+asset);
  if(!path.startsWith(root+sep))throw Error('Outside preview root');
  res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');
  res.end(baseline&&asset==='/index.html'?oldIndex:baseline&&asset==='/assets/dashboard/dashboard.css'?oldDashboardCSS:await readFile(path));
 }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,current,baseline;
const near=(actual,expected,message,tolerance=.08)=>assert(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected}`);
try{
 try{browser=await playwright.chromium.launch({channel:'chrome',headless:true});report.browser='Chrome'}catch{browser=await playwright.chromium.launch({headless:true});report.browser='Playwright Chromium'}
 const makePage=async(prefix)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(`${prefix} JavaScript: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))report.errors.push(`${prefix} Console: ${m.text()}`)});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(`${prefix} HTTP ${r.status()}: ${r.url()}`)});
  await page.goto(`http://127.0.0.1:${server.address().port}/${prefix}/`);
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  return page;
 };
 baseline=await makePage('baseline');current=await makePage('current');
 const login=async(page,id='M20105')=>{await page.locator('#loginUser').fill(id);await page.locator('#loginPass').fill('1234');await page.locator('[data-action=login]').click();await page.locator('.dashboardPage').waitFor()};
 const home=async page=>{await page.locator('[data-action=home]').click();await page.locator('.dashboardPage').waitFor()};
 const openUnits=async(page,grade)=>{await page.locator('[data-dashboard-grades]').click();await page.locator(`.gradeCard[data-grade="${grade}"] button`).click();await page.locator('.unitGrid').waitFor()};
 const scrollTop=page=>page.evaluate(async()=>{scrollTo({top:0,left:0,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
 const storage=page=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))));
 const readyUnits=async page=>{
  for(const image of await page.locator('.unitIcon img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode())}
  for(const image of await page.locator('.unitTitleSign img').all())await image.evaluate(i=>i.decode());
  const artwork=await page.evaluate(async()=>{
   const sign=document.querySelector('.unitTitleSign');if(!sign)return [];
   const backgrounds=[getComputedStyle(document.querySelector('#app'),'::before').backgroundImage,getComputedStyle(sign).backgroundImage];
   const urls=backgrounds.flatMap(value=>[...value.matchAll(/url\(["']?(.*?)["']?\)/g)].map(match=>match[1]));
   return Promise.all(urls.map(async url=>{const image=new Image();image.src=url;await image.decode();return {src:new URL(url).pathname.replace(/^\/(?:baseline|current)\//,''),width:image.naturalWidth,height:image.naturalHeight}}));
  });
  await page.evaluate(()=>document.fonts.ready);await scrollTop(page);await page.mouse.move(0,0);
  return artwork;
 };
 const unitSnapshot=page=>page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const style=e=>{const s=getComputedStyle(e);return Object.fromEntries([...s].filter(k=>!k.startsWith('--')).map(k=>[k,s.getPropertyValue(k).replaceAll('/baseline/','/SITE/').replaceAll('/current/','/SITE/')]))};
  const element=(e,parent)=>{const r=box(e),p=box(parent);return {tag:e.tagName,class:e.className,relative:{x:r.x-p.x,y:r.y-p.y,width:r.width,height:r.height},style:style(e)}};
  const grid=document.querySelector('.unitGrid');
  const bar=selector=>{const e=document.querySelector(selector);return {html:e.outerHTML,box:box(e),style:style(e),children:[...e.querySelectorAll('*')].map(child=>element(child,e))}};
  return {
   header:document.querySelector('main h1').innerText,subtitle:document.querySelector('main .subWood').innerText,
   grid:{html:grid.outerHTML,width:box(grid).width,height:box(grid).height,style:style(grid),cards:[...grid.children].map(card=>({...element(card,grid),children:[...card.querySelectorAll('*')].map(child=>element(child,card))}))},
   topbar:bar('.topbar'),bottomNav:bar('.bottomNav'),
   images:[...grid.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,loaded:i.complete&&i.naturalWidth>0})),
   overflow:document.documentElement.scrollWidth>innerWidth,textOverflow:[...document.querySelectorAll('.unitCard h3,.unitCard small,main h1,.subWood')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+1).map(e=>e.innerText)
  };
 });
 await login(baseline);await login(current);
 const pristine=await storage(current);
 for(const [width,height] of viewports){
  await baseline.setViewportSize({width,height});await current.setViewportSize({width,height});
  for(const grade of [1,2,3]){
   await openUnits(baseline,grade);await openUnits(current,grade);await readyUnits(baseline);const artwork=await readyUnits(current);
   const original=await unitSnapshot(baseline),actual=await unitSnapshot(current),key=`${width}x${height}-G${grade}`;
   baselineRecords.units[key]=original;
   assert.equal(actual.header,original.header,`${key}: original dynamic header text`);assert.equal(actual.subtitle,original.subtitle,`${key}: original subtitle`);
   assert.equal(actual.header,`ม.${grade} • เลือกหน่วยการเรียนรู้`);
   assert.deepEqual(actual.grid,original.grid,`${key}: every card and its content, full computed style, image, size, ordering and grid geometry remain identical`);
   assert.deepEqual(actual.topbar,original.topbar,`${key}: topbar markup, style and geometry remain identical`);
   assert.deepEqual(actual.bottomNav,original.bottomNav,`${key}: bottom navigation markup, style and geometry remain identical`);
   assert.deepEqual(actual.images,original.images,`${key}: original unit images remain identical`);assert(actual.images.every(i=>i.loaded),`${key}: all original unit images decode`);
   assert.equal(artwork.length,2,`${key}: backdrop and title use real images`);assert(artwork.every(i=>i.src.startsWith('assets/unit-selection/')&&i.src.endsWith('.webp')&&i.width>0&&i.height>0),`${key}: new WebP background and sign decode`);
   assert(!actual.overflow,`${key}: horizontal overflow`);assert.deepEqual(actual.textOverflow,[],`${key}: text overflow`);
   const titleClear=await current.evaluate(()=>document.querySelector('.unitTitleSign').getBoundingClientRect().bottom<=document.querySelector('.unitGrid').getBoundingClientRect().top+1);
   assert(titleClear,`${key}: title overlaps unit cards`);assert.equal(await storage(current),pristine,`${key}: browsing units is read-only`);
   await scrollTop(current);await current.screenshot({path:resolve(out,`units-${key}.png`),fullPage:true});
   report.unitComparisons.push({width,height,grade,units:actual.grid.cards.length,identicalGridAndCards:true,identicalTopbarAndNav:true,titleClear,artwork});
   await home(baseline);await home(current);
  }
 }
 await writeFile(resolve(out,'baseline-cards.json'),JSON.stringify(baselineRecords));
 report.checks.push('27 paired checkpoint/current unit pages: exact original grid markup, every computed CSS property and relative card geometry, images, text, order, progress, topbar and bottom navigation');

 // These samples use normal account navigation; no replacement navigation or progress model is introduced.
 await current.setViewportSize({width:390,height:844});
 for(const account of ['M20105','teacher']){
  if(account==='teacher'){await current.locator('[data-action=logout]').click();await login(current,account)}
  for(const grade of [1,2,3]){
   await openUnits(current,grade);const title=await current.locator('.unitCard[data-unit="0"] h3').innerText();
   await current.locator('.unitCard[data-unit="0"]').click();assert.equal(await current.locator('main h1').innerText(),title);
   const ids=await current.locator('.lessonCard[data-lesson]').evaluateAll(nodes=>nodes.map(e=>e.dataset.lesson));
   assert(ids.length&&ids.every(id=>id.startsWith(`G${grade}U1L`)),`${account}: selected first unit contains the actual grade lesson IDs`);
   await current.locator('[data-action=back]').click();assert.equal(await current.locator('.unitGrid').count(),1,'Lesson list Back returns to units');
   await current.locator('[data-action=back]').click();assert.equal(await current.locator('.gradeSelectionPage').count(),1,'Units Back returns to grade selection');
   await current.locator('[data-action=back]').click();assert.equal(await current.locator('.dashboardPage').count(),1,'Grade Back returns to Dashboard');
   await openUnits(current,grade);await home(current);
  }
 }
 report.checks.push('Both accounts and all three grades: first unit → actual lesson IDs, Back lesson list → units → grade selection → Dashboard, Home');
 await current.locator('[data-action=logout]').click();await login(current);
 const expected=await current.evaluate(()=>{
  localStorage.clear();return [1,2,3].map(grade=>{
   const ids=window.__SLH_QA__.lessonIds.filter(id=>id.startsWith(`G${grade}U1L`));
   localStorage.setItem(`slh_v163_M20105_${ids[0]}`,JSON.stringify({exam:{passed:true,best:80,attempts:1}}));return Math.round(100/ids.length);
  });
 });
 const earned=await storage(current);
 for(const grade of [1,2,3]){
  await openUnits(current,grade);const first=current.locator('.unitCard[data-unit="0"]');
  assert((await first.locator('small').innerText()).startsWith(`${expected[grade-1]}%`),'Unit progress uses real passed lessons');
  assert.equal(await first.locator('.progress span').evaluate(e=>e.style.width),`${expected[grade-1]}%`);
  assert.equal(await storage(current),earned,'Viewing unit progress preserves original storage bytes');await home(current);
 }
 report.checks.push('Earned unit progress uses existing passed-exam records and actual unit lesson counts; browsing does not write storage');
 // Reset only test fixtures before comparing the same dashboard account and state.
 await current.evaluate(()=>localStorage.clear());await current.locator('.dashNav [data-nav=home]').click();

 const welcomeSnapshot=page=>page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const welcome=document.querySelector('.dashWelcome'),character=document.querySelector('.dashCharacter'),body=document.querySelector('.dashCharacterBody'),arm=document.querySelector('.dashCharacterArm');
  return {welcome:box(welcome),character:box(character),body:box(body),bubble:box(document.querySelector('.dashBubble')),mission:box(document.querySelector('.dashMission')),bodySrc:body.getAttribute('src'),armSrc:arm.getAttribute('src'),idle:getComputedStyle(character).animationName,wave:getComputedStyle(arm).animationName,clip:getComputedStyle(welcome).clipPath};
 });
 const visibleCharacterOverlap=page=>page.evaluate(()=>{
  const welcome=document.querySelector('.dashWelcome'),wr=welcome.getBoundingClientRect(),clip=getComputedStyle(welcome).clipPath!=='none';
  const targets=['.dashBubble','.dashMission'].map(selector=>({selector,rect:document.querySelector(selector).getBoundingClientRect(),pixels:0}));
  const inside=(x,y,polygon)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit};
  for(const image of document.querySelectorAll('.dashCharacter img')){
   const r=image.getBoundingClientRect(),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const path=getComputedStyle(image).clipPath,polygon=path.startsWith('polygon(')?path.slice(8,-1).split(',').map(point=>point.trim().split(/\s+/).map((value,axis)=>parseFloat(value)*(axis?canvas.height:canvas.width)/100)):null;
   for(let y=0;y<canvas.height;y+=2)for(let x=0;x<canvas.width;x+=2){
    if(data[(y*canvas.width+x)*4+3]<64||(polygon&&!inside(x,y,polygon)))continue;
    const sx=r.x+x/canvas.width*r.width,sy=r.y+y/canvas.height*r.height;
    if(clip&&sy>=wr.bottom)continue;
    for(const target of targets){const t=target.rect;if(sx>t.left+1&&sx<t.right-1&&sy>t.top+1&&sy<t.bottom-1)target.pixels++}
   }
  }
  return targets.map(({selector,pixels})=>({selector,pixels}));
 });
 for(const [width,height] of viewports){
  await baseline.setViewportSize({width,height});await current.setViewportSize({width,height});
  for(const page of [baseline,current]){await page.locator('.dashShell').evaluate(e=>e.scrollTop=0);await page.locator('.dashCharacterBody').evaluate(i=>i.decode());await page.evaluate(()=>document.fonts.ready)}
  const original=await welcomeSnapshot(baseline),actual=await welcomeSnapshot(current),key=`${width}x${height}`;baselineRecords.welcome[key]=original;
  near(actual.character.width,original.character.width,`${key}: character width unchanged`);near(actual.character.height,original.character.height,`${key}: character height unchanged`);
  assert.equal(actual.bodySrc,original.bodySrc,'Original student image remains');assert.equal(actual.armSrc,original.armSrc,'Original waving arm remains');
  const anchor=actual.body.bottom-actual.welcome.bottom;assert(anchor>=1&&anchor<=8.1,`${key}: character stays anchored 1–8px beyond Welcome base (was ${anchor})`);
  const overlap=await visibleCharacterOverlap(current);assert(overlap.every(result=>result.pixels===0),`${key}: visible student overlaps bubble or activities: ${JSON.stringify(overlap)}`);
  assert.equal(actual.idle,'none');assert.equal(actual.wave,'none');assert(await current.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${key}: dashboard overflow`);
  await current.screenshot({path:resolve(out,`welcome-${key}.png`)});
  report.welcomeComparisons.push({width,height,unchangedSize:true,anchor,overlap,reducedMotion:true});
 }
 await current.setViewportSize({width:390,height:844});await current.emulateMedia({reducedMotion:'no-preference'});await current.locator('.dashShell').evaluate(e=>e.scrollTop=0);
 await current.waitForTimeout(50);
 const motionStart=await current.locator('.dashCharacter').evaluate(e=>({idle:getComputedStyle(e).animationName,wave:getComputedStyle(e.querySelector('.dashCharacterArm')).animationName,body:getComputedStyle(e).transform,arm:getComputedStyle(e.querySelector('.dashCharacterArm')).transform}));
 await current.waitForTimeout(1400);
 const motionLater=await current.locator('.dashCharacter').evaluate(e=>({body:getComputedStyle(e).transform,arm:getComputedStyle(e.querySelector('.dashCharacterArm')).transform}));
 assert.equal(motionStart.idle,'dash-idle');assert.equal(motionStart.wave,'dash-wave');assert.notEqual(motionStart.arm,motionLater.arm,'Waving arm still moves');assert.notEqual(motionStart.body,motionLater.body,'Idle still moves');
 await current.emulateMedia({reducedMotion:'reduce'});await openUnits(current,2);
 assert.deepEqual(await current.locator('.unitSelectionPage').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName||'transition')),[],'Unit page obeys reduced motion');
 report.checks.push('Nine dashboard sizes: original character dimensions and source, anchored base, no visible-alpha overlap with bubble/mission; original idle and waving actually move; reduced-motion support');
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){
 report.status='FAIL';report.failure=error.stack;
 if(current)try{await current.evaluate(()=>scrollTo({top:0,left:0,behavior:'instant'}));await current.screenshot({path:resolve(out,'failure.png'),fullPage:true})}catch{}
 throw error;
}finally{
 await writeFile(resolve(out,'baseline-cards.json'),JSON.stringify(baselineRecords));
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,checkpoint,scope:report.scope,unitComparisons:report.unitComparisons.length,welcomeComparisons:report.welcomeComparisons.length,checks:report.checks,errors:report.errors,failure:report.failure},null,2));
 await browser?.close();await new Promise(r=>server.close(r));
}
