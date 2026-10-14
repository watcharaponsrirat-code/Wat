import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const {chromium}=playwright;
const root=resolve('.'),out=resolve('tmp/lesson-adventure-review'),checkpoint='f718062';
const smoke=process.argv.find(a=>a.startsWith('--smoke='))?.split('=')[1];
const flowOnly=process.argv.includes('--flows');
const stages=smoke?smoke.split(','):['content','lab','g1','g2','g3','e1','e2','e3','exam','result'];
const sizes=smoke?[[390,844],[1366,768]]:[[375,812],[390,844],[430,932],[768,1024],[1280,720],[1366,768],[1440,900]];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024});
const oldIndex=git('show',checkpoint+':index.html'),newIndex=await readFile('index.html','utf8');
const canonical=s=>s.replaceAll('\r\n','\n').replace(/^[ \t]*<link[^\n]*href="assets\/theme\/adventure-[^"\n]+"[^\n]*>\n/gm,'').replace('science-adventure.css?v=2','science-adventure.css?v=1');
assert.equal(canonical(newIndex),canonical(oldIndex),'All original HTML, scientific data, application code and DOM templates remain exact');
const changes=git('diff','--name-only',checkpoint,'--','assets','index.html','scripts','.github').trim().split('\n').filter(Boolean);
assert(changes.every(p=>p==='index.html'||p==='assets/theme/science-adventure.css'||/^assets\/theme\/adventure-[\w-]+\.css$/.test(p)),`Protected source changed: ${changes}`);
await mkdir(out,{recursive:true});
const report={checkpoint,mode:flowOnly?'flows':smoke||'full',lessons:[],viewports:sizes,layouts:0,exactContent:0,exactStates:0,readerImages:0,simControls:0,checks:[],screenshots:[],errors:[],failures:[]};
const oldCss=git('show',checkpoint+':assets/theme/science-adventure.css');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),old=url.pathname.startsWith('/before/');
 const asset=url.pathname.replace(/^\/(before|after)\//,'/');if(asset==='/favicon.ico'){res.writeHead(204);return res.end()}
 const path=resolve(root,'.'+(asset.endsWith('/')?asset+'index.html':asset));if(!path.startsWith(root+sep))throw Error('Outside root');
 res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');
 res.end(old&&asset==='/index.html'?oldIndex:old&&asset==='/assets/theme/science-adventure.css'?oldCss:await readFile(path));
}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,before,after;
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)])):typeof value==='number'&&value>1e12?'[time]':typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)?'[time]':value;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const make=async prefix=>{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'||r.request().url().startsWith('data:')?r.continue():r.abort());
  await context.addInitScript(()=>{let seed=1;window.__resetReviewSeed=(value=314159)=>seed=value;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(prefix+': '+e.message));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))report.errors.push(prefix+' HTTP '+r.status()+' '+r.url())});
  await page.goto(`http://127.0.0.1:${server.address().port}/${prefix}/`);
  return page;
 };
 before=await make('before');after=await make('after');
 const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const open=async(p,id,stage)=>{await p.evaluate(({id,stage})=>{window.__resetReviewSeed();window.__SLH_QA__.open(id,stage)},{id,stage});if(stage==='lab')await p.waitForSelector('.simPanel[data-sim-view]');await settle(p)};
 const state=(p,id)=>p.evaluate(id=>window.__SLH_QA__.snapshot(id),id);
 const compareState=async(id,label)=>{assert.deepEqual(normalize(await state(after,id)),normalize(await state(before,id)),label+' state matches baseline');report.exactStates++};
 const snapshot=p=>p.evaluate(()=>{
  const main=document.querySelector('main'),clone=main.cloneNode(true);
  // WebGL/SVG viewport pixels and dimensions are runtime renderer output, not lesson text.
  clone.querySelectorAll('.simViewport').forEach(e=>{e.replaceChildren();for(const a of [...e.attributes])if(!['class','data-sim-viewport'].includes(a.name))e.removeAttribute(a.name)});
  clone.querySelectorAll('[style=""]').forEach(e=>e.removeAttribute('style'));
  return {html:clone.innerHTML,nav:[...main.querySelectorAll('.stageDot')].map(e=>({stage:e.dataset.stage,text:e.textContent,classes:e.className,current:e.getAttribute('aria-current')}))};
 });
 const styleSnapshot=p=>p.evaluate(()=>{
  const elements=[document.body,document.querySelector('#app'),...document.querySelectorAll('.readingMode,.readingMode *')];
  return elements.map(e=>[null,'::before','::after'].map(pseudo=>{const s=getComputedStyle(e,pseudo);return Object.fromEntries([...s].filter(k=>!k.startsWith('--')).map(k=>[k,s.getPropertyValue(k).replaceAll('/before/','/SITE/').replaceAll('/after/','/SITE/')]))}));
 });
 const layout=p=>p.evaluate(()=>{
  const main=document.querySelector('main'),nav=main.querySelector('.stageHUD'),buttons=[...nav.querySelectorAll('.stageDot')];
  const boxes=buttons.map(b=>b.getBoundingClientRect()),content=nav.nextElementSibling;
  const title=nav.querySelector('.hudTop>b'),sign=getComputedStyle(title,'::before'),scene=getComputedStyle(document.querySelector('#app'),'::before');
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none'};
  const clipped=buttons.filter(b=>b.scrollWidth>b.clientWidth+1||b.scrollHeight>b.clientHeight+1).map(b=>b.textContent);
  const overflow=[...main.querySelectorAll('h1,h2,h3,p,.qTitle,.choice,.pixelBtn,.simStudioTop,.arcade-card,.stageDot small')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({class:e.className,text:e.textContent.slice(0,110)}));
  return {pageOverflow:document.documentElement.scrollWidth>innerWidth,clipped,overflow,ten:buttons.length===10,touch:boxes.every(b=>b.width>=44&&b.height>=44),clear:!content||nav.getBoundingClientRect().bottom<=content.getBoundingClientRect().top+1,wood:sign.borderImageSource.includes('lesson-sign-v1.webp'),world:scene.backgroundImage.includes('lesson-scene'),navColors:buttons.map(b=>({active:b.classList.contains('active'),bg:getComputedStyle(b).backgroundImage})),viewport:{width:innerWidth,height:innerHeight}};
 });
 const shot=async(p,name)=>{await p.evaluate(()=>scrollTo({top:0,left:0,behavior:'instant'}));await settle(p);await p.screenshot({path:resolve(out,name+'.png')});report.screenshots.push(name+'.png')};
 const imageCheck=async p=>{let count=0;for(const image of await p.locator('.readingPage img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(e=>e.decode());const ok=await image.evaluate(e=>e.naturalWidth>0&&getComputedStyle(e).objectFit==='contain');assert(ok,'Original scientific image loaded without cropping');count++}return count};
 const lessons=await after.evaluate(()=>Object.entries(window.SLH_DATA.curriculum).flatMap(([grade,units])=>units.flatMap((u,unit)=>u.lessons.map(l=>({id:l.id,title:l.title,grade:+grade,unit})))));
 const pure=lessons.find(l=>l.title.includes('สมบัติของสารบริสุทธิ์'));assert(pure,'Requested pure-substance lesson exists');report.pureSubstanceLesson=pure;
 const sampleIds=['G1U1L1',pure.id,'G2U3L1','G3U3L1'];
 if(!smoke&&!flowOnly){
  for(const size of [[390,844],[1366,768]]){
   for(const p of [before,after]){await p.setViewportSize({width:size[0],height:size[1]});await open(p,'G1U1L1','content')}
   assert.deepEqual(await snapshot(after),await snapshot(before),'Approved master reader DOM remains exact');
   assert.deepEqual(await styleSnapshot(after),await styleSnapshot(before),'Approved master reader appearance remains exact');
  }
  report.checks.push('Approved master reader DOM and computed/pseudo styles preserved on mobile and desktop');
 }
 for(const lesson of lessons.filter(l=>!flowOnly&&(!smoke||sampleIds.includes(l.id)))){
  for(const stage of stages){
   await open(before,lesson.id,stage);await open(after,lesson.id,stage);
   const actual=await snapshot(after),expected=await snapshot(before);
   if(JSON.stringify(actual)!==JSON.stringify(expected)){await writeFile(resolve(out,'content-actual.json'),JSON.stringify(actual,null,2));await writeFile(resolve(out,'content-expected.json'),JSON.stringify(expected,null,2));throw Error(`${lesson.id}/${stage}: exact original DOM and labels differ (see content-actual.json/content-expected.json)`)}report.exactContent++;
   await compareState(lesson.id,`${lesson.id}/${stage}`);
   for(const [width,height] of sizes){
    await after.setViewportSize({width,height});await settle(after);const result=await layout(after);
    for(const key of ['ten','touch','clear','wood','world'])assert(result[key],`${lesson.id}/${stage}/${width}: ${key}`);
    assert(!result.pageOverflow,`${lesson.id}/${stage}/${width}: page overflow`);assert.deepEqual(result.clipped,[],`${lesson.id}/${stage}/${width}: clipped activity buttons`);
    assert.deepEqual(result.overflow,[],`${lesson.id}/${stage}/${width}: text/control overflow`);report.layouts++;
   }
   if(stage==='content')report.readerImages+=await imageCheck(after);
   if(lesson.id==='G1U1L1'||(stage==='content'&&sampleIds.includes(lesson.id))){
    for(const [width,height] of [[390,844],[1366,768]])for(const [prefix,p] of [['before',before],['after',after]]){await p.setViewportSize({width,height});await shot(p,`${prefix}-${lesson.id}-${stage}-${width}`)}
   }
  }
  report.lessons.push(lesson);console.log(`Verified ${lesson.id} ${stages.join(',')}`);
 }
 if(!flowOnly)report.checks.push(`${report.exactContent} exact lesson/activity DOM comparisons; ${report.layouts} layouts; ${report.readerImages} original science images decoded`);
 if(flowOnly){const {verifyFlows}=await import('./lesson-adventure-flows.mjs');await verifyFlows({before,after,open,settle,state,compareState,snapshot,layout,shot,lessons,normalize,report})}
 report.untestedLessons=lessons.filter(l=>!report.lessons.some(t=>t.id===l.id)).map(l=>l.id);
 assert.deepEqual(report.errors,[],'No JavaScript or local resource errors');report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.message;if(after)try{await after.screenshot({path:resolve(out,'failure.png'),fullPage:true});await writeFile(resolve(out,'failure-before.json'),JSON.stringify(await before.locator('main').evaluate(e=>e.outerHTML),null,2));await writeFile(resolve(out,'failure-after.json'),JSON.stringify(await after.locator('main').evaluate(e=>e.outerHTML),null,2))}catch{}process.exitCode=1}
finally{await writeFile(resolve(out,flowOnly?'flows.json':smoke?'smoke-'+smoke.replaceAll(',','-')+'.json':'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,mode:report.mode,lessons:report.lessons.length,layouts:report.layouts,exactContent:report.exactContent,exactStates:report.exactStates,errors:report.errors,failure:report.failure},null,2));await browser?.close();await new Promise(r=>server.close(r))}
