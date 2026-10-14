import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve('.'),out=resolve('tmp/plant-fidelity-review'),baseline='672397e';
const git=path=>execFileSync('git',['show',`${baseline}:${path}`],{cwd:root,maxBuffer:64*1024*1024});
await mkdir(out,{recursive:true});
// These files contain the authoritative science model, questions and scoring.
for(const path of ['assets/simulations/grade1.js','assets/simulations/models3d-grade1.js','assets/simulations/models3d-kit.js'])assert.equal((await readFile(path,'utf8')).replace(/\r\n/g,'\n'),git(path).toString('utf8').replace(/\r\n/g,'\n'),`${path} remains identical apart from checkout line endings`);
const originalEngine=git('assets/simulations/engine.js').toString('utf8');
assert.equal((await readFile('assets/simulations/engine.js','utf8')).replace(/\r\n/g,'\n'),originalEngine.replace(/\r\n/g,'\n'),'Engine/state/time/controls unchanged');
const cache=new Map(),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),old=url.pathname.startsWith('/before/');
 let asset=decodeURIComponent(url.pathname).replace(/^\/(before|after)\//,'').replace(/^\//,'');if(!asset||asset.endsWith('/'))asset+='index.html';
 if(asset==='favicon.ico'){res.writeHead(204);return res.end()}
 const path=resolve(root,asset);if(!path.startsWith(root+sep))throw Error('Outside root');
 if(old&&!cache.has(asset))cache.set(asset,git(asset));
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(old?cache.get(asset):await readFile(path));
}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const report={baseline,combinations:0,responsive:[],screenshots:[],checks:[],performance:[],webkit:[],errors:[],limitations:['Browser emulation is not testing on physical iPad/mobile hardware.','Headless browser frame timing is diagnostic, not a device performance benchmark.']};
let browser,webkit;
const settle=async p=>{await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await p.waitForFunction(()=>document.querySelector('.simViewport')?.dataset.animating==='false',null,{timeout:15000})};
const values=p=>p.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').simulation.G1U1L1.values);
const state=p=>p.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1'));
const camera=p=>p.locator('.simViewport').evaluate(e=>({radius:+e.dataset.cameraDistance,theta:+e.dataset.azimuth,phi:+e.dataset.polar}));
const near=(a,b,message,tolerance=.00001)=>assert(Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
const choose=async(p,light,t)=>{await p.evaluate(({light,t})=>{for(const [key,value] of [['light',light],['t',t]]){const e=document.querySelector(`[data-sim-control="${key}"]`);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}))}},{light,t});await settle(p)};
const activate=async p=>{await p.evaluate(()=>window.__SLH_QA__.open('G1U1L1','lab'));await p.waitForSelector('.plantReadouts');await p.locator('.simViewport').scrollIntoViewIfNeeded();await settle(p)};
const makePage=async(engine,settings={},prefix='after')=>{
 const context=await engine.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce',...settings});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'||r.request().url().startsWith('data:')?r.continue():r.abort());
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(`${prefix}: ${e.message}`));
 p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))report.errors.push(`${prefix} HTTP ${r.status()} ${r.url()}`)});
 await p.goto(`http://127.0.0.1:${server.address().port}/${prefix}/`);return p;
};
const layout=async p=>p.evaluate(()=>{
 const host=document.querySelector('.simViewport'),canvas=host.querySelector('canvas'),base=host.getBoundingClientRect(),cb=canvas.getBoundingClientRect();
 const elements=[...host.querySelectorAll('.plantCondition,.plantGroup')],rects=elements.map(e=>e.getBoundingClientRect());
 const details=[...host.querySelectorAll('.plantCondition,.plantGroup strong,.plantGroup span,.plantGroup b')].map(e=>({text:e.textContent,font:+parseFloat(getComputedStyle(e).fontSize),clip:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1}));
 const controls=[...document.querySelectorAll('.simCameraTools button,.simViewSwitch button,.simActions button')].map(e=>({text:e.textContent,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
 return {dataset:{...host.dataset},width:innerWidth,height:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth,labelOverflow:rects.some(r=>r.left<base.left-1||r.top<base.top-1||r.right>base.right+1||r.bottom>base.bottom+1),labelOverlap:rects.some((a,i)=>rects.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),canvasBound:cb.left>=base.left-1&&cb.right<=base.right+1&&cb.top>=base.top-1&&cb.bottom<=base.bottom+1,canvasLabelOverlap:rects.some(r=>r.left<cb.right&&r.right>cb.left&&r.top<cb.bottom-1&&r.bottom>cb.top+1),details,controls,originalMetrics:[...document.querySelectorAll('.simMetrics strong')].map(e=>e.textContent),readouts:[...host.querySelectorAll('.plantGroup')].map(e=>({group:e.dataset.group,title:e.querySelector('strong').textContent,light:e.querySelector('span').textContent,value:e.querySelector('b').textContent}))};
});
const checkLayout=(r,label)=>{
 for(const key of ['pageOverflow','labelOverflow','labelOverlap','canvasLabelOverlap'])assert.equal(r[key],false,`${label}: ${key}`);
 assert(r.canvasBound,`${label}: canvas inside viewport`);assert(r.details.every(d=>!d.clip),`${label}: clipped label text`);assert(r.details.every(d=>d.font>=12),`${label}: minimum label font`);
 assert(r.controls.every(b=>b.w>=44&&b.h>=44),`${label}: touch targets`);assert.deepEqual(r.readouts.map(x=>x.value),r.originalMetrics,`${label}: readout uses original metrics`);
 assert.equal(r.dataset.labelOverlap,'false');assert.equal(r.dataset.labelOverflow,'false');
};
try{
 browser=await playwright.chromium.launch({channel:'chrome',headless:true});
 const before=await makePage(browser,{},'before');
 const expected=await before.evaluate(()=>{
  const spec=window.SLH_SIMULATIONS.G1U1L1,rows=[];
  for(let light=0;light<=12;light++)for(let t=0;t<=14;t++){
   const p={simulation:{G1U1L1:{values:{light,t}}}},doc=new DOMParser().parseFromString(window.SLH_SIM_ENGINE.render('G1U1L1',p),'text/html');
   rows.push({light,t,html:doc.querySelector('[data-sim-output]').innerHTML,metrics:[...doc.querySelectorAll('.simMetrics strong')].map(e=>e.textContent)});
  }
  return {rows,controls:spec.controls,title:spec.title,hint:spec.hint,assumption:spec.assumption};
 });await before.context().close();
 const page=await makePage(browser);await activate(page);
 assert.deepEqual(await page.evaluate(()=>{const s=window.SLH_SIMULATIONS.G1U1L1;return {controls:s.controls,title:s.title,hint:s.hint,assumption:s.assumption}}),{controls:expected.controls,title:expected.title,hint:expected.hint,assumption:expected.assumption});
 for(const {light,t,html,metrics} of expected.rows){
  await choose(page,light,t);
  const current=await page.evaluate(()=>({html:document.querySelector('[data-sim-output]').innerHTML,state:JSON.parse(document.querySelector('.simViewport').dataset.modelState),visual:JSON.parse(document.querySelector('.simViewport').dataset.visualGrowth),readouts:[...document.querySelectorAll('.plantGroup b')].map(e=>e.textContent)}));
  assert.equal(current.html,html,`Original 2D SVG/summary/metrics ${light}/${t}`);assert.deepEqual(current.readouts,metrics);
  const a=t*3,b=a*Math.min(light/6,1.3);
  for(const [key,value] of [['controlGrowth',a],['experimentGrowth',b]]){near(current.state[key],value,`${light}/${t} model ${key}`);near(current.visual[key],value,`${light}/${t} visual endpoint ${key}`)}
  assert.deepEqual(await values(page),{light,t});report.combinations++;
  if(report.combinations%30===0)console.log(`Science values verified ${report.combinations}/195`);
 }
 report.checks.push('195 combinations: exact original 2D SVG, summary, metrics, controls, saved values and 3D growth endpoints');
 await page.context().close();
 for(const [device,width,height] of [['phone375',375,812],['phone',390,844],['phone430',430,932],['ipad-portrait',768,1024],['ipad-landscape',1024,768],['desktop',1366,900],['desktop1440',1440,900]]){
  const p=await makePage(browser,{viewport:{width,height},hasTouch:width<=1024});await activate(p);
  for(const [light,t] of [[6,0],[12,14],[0,14]]){
   await choose(p,light,t);await p.locator('[data-sim-camera="reset"]').click();await settle(p);
   const r=await layout(p);checkLayout(r,`${device} ${light}/${t}`);report.responsive.push({device,light,t,...r});
   for(const [name,selector] of [['studio','.simStudio'],['viewport','.simViewport']]){
    const file=`after-${device}-light${light}-day${t}-${name}.png`;await p.locator(selector).screenshot({path:resolve(out,file)});report.screenshots.push(file);
   }
  }
  if(width<=430)assert.equal((await layout(p)).dataset.quality,'low','Automatic narrow-device detail budget');
  await p.context().close();console.log(`Responsive ${device} passed`);
 }
 // Functional behavior on a real WebGL canvas, using unchanged controls.
 const p=await makePage(browser);await activate(p);await choose(p,12,14);const saved=JSON.stringify(await state(p)),start=await camera(p);
 const command=async name=>{await p.locator(`[data-sim-camera="${name}"]`).click();await settle(p)};
 await command('left');near((await camera(p)).theta,start.theta-Math.PI/12,'15-degree left');await command('right');near((await camera(p)).theta,start.theta,'inverse rotation');
 await command('in');assert((await camera(p)).radius<start.radius);await command('out');near((await camera(p)).radius,start.radius,'inverse zoom',1);
 for(const preset of ['front','top','reset']){await command(preset);checkLayout(await layout(p),preset)}
 await p.locator('.simViewport').scrollIntoViewIfNeeded();const box=await p.locator('.simViewport canvas').boundingBox(),beforeDrag=await camera(p);
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+80,box.y+box.height/2+20,{steps:8});await p.mouse.up();await settle(p);assert(Math.abs((await camera(p)).theta-beforeDrag.theta)>.05);
 await command('labels');assert(await p.locator('.plantReadouts').isHidden());await command('labels');assert(await p.locator('.plantReadouts').isVisible());
 await p.locator('.simViewport canvas').focus();const keyboard=await camera(p);await p.keyboard.press('ArrowRight');await settle(p);near((await camera(p)).theta,keyboard.theta+Math.PI/12,'keyboard rotation');
 await p.locator('[data-sim-view="2d"]').click();assert(await p.locator('.simDiagram').isVisible());assert(await p.locator('.simViewport').isHidden());
 await p.locator('[data-sim-view="3d"]').click();await settle(p);assert(await p.locator('.simViewport canvas').isVisible());assert.equal(JSON.stringify(await state(p)),saved,'Camera/mode changes preserve experiment and progress');
 await p.reload();await activate(p);assert.equal(JSON.stringify(await state(p)),saved,'Saved experiment survives reload');
 await p.locator('[data-sim-reset]').click();await settle(p);assert.deepEqual(await values(p),{light:6,t:0});
 const resetState=await state(p);await p.locator('[data-sim-play]').click();await p.waitForFunction(()=>window.__SLH_QA__.snapshot('G1U1L1').simulation.G1U1L1.values.t>=1);await p.locator('[data-sim-play]').click();assert.equal(await p.locator('[data-sim-play]').getAttribute('aria-pressed'),'false');
 await choose(p,6,13);await p.locator('[data-sim-play]').click();await p.waitForFunction(()=>document.querySelector('[data-sim-play]').getAttribute('aria-pressed')==='false');assert.equal((await values(p)).t,14);
 // XP/scoring fields must remain unchanged after free experimentation.
 for(const key of ['xp','score','mastery','exam','games','exercises'])if(key in resetState)assert.deepEqual((await state(p))[key],resetState[key],`No new ${key} from experimenting`);
 await p.locator('[data-sim-play]').click();await p.locator('[data-stage="g1"]').first().click();const stopped=JSON.stringify(await state(p));await p.waitForTimeout(1100);assert.equal(JSON.stringify(await state(p)),stopped,'Navigation stops experiment timer');assert.equal(await p.locator('.plantReadouts').count(),0,'Presentation disposed');
 report.checks.push('Rotate, zoom, front/top/reset cameras, pointer drag, keyboard, labels, 3D/2D, reload, reset, time play/pause/end, navigation disposal');
 await activate(p);await choose(p,12,0);await p.emulateMedia({reducedMotion:'no-preference'});
 const samples=await p.evaluate(async()=>{
  const host=document.querySelector('.simViewport'),control=document.querySelector('[data-sim-control="t"]');control.value=14;control.dispatchEvent(new Event('input',{bubbles:true}));
  const samples=[];for(let i=0;i<80;i++){await new Promise(requestAnimationFrame);samples.push(JSON.parse(host.dataset.visualGrowth));if(host.dataset.animating==='false')break}return samples;
 });await settle(p);
 assert(samples.some(s=>s.controlGrowth>0&&s.controlGrowth<42),'Smooth intermediate growth positions');
 for(let i=1;i<samples.length;i++)assert(samples[i].controlGrowth>=samples[i-1].controlGrowth-.00001,'Growth interpolates without reverse jumps');
 near(JSON.parse(await p.locator('.simViewport').getAttribute('data-visual-growth')).controlGrowth,42,'Animation exact endpoint');
 await p.emulateMedia({reducedMotion:'reduce'});await choose(p,0,0);near(JSON.parse(await p.locator('.simViewport').getAttribute('data-visual-growth')).controlGrowth,0,'Reduced-motion immediate endpoint');
 report.checks.push(`Smooth growth interpolation (${samples.length} sampled frames) and reduced-motion endpoint`);
 report.performance.push(await p.locator('.simViewport').evaluate(e=>({...e.dataset})));
 const budget=await p.evaluate(async()=>{
  const THREE=await import('/after/assets/vendor/three/three.module.js');
  const {ModelKit}=await import('/after/assets/simulations/models3d-kit.js');
  const {models3d}=await import('/after/assets/simulations/models3d.js');
  const {createPlantGrowthStudio}=await import('/after/assets/simulations/plant-growth-studio.js');
  const panel=document.createElement('section');panel.className='simPanel';panel.dataset.simulation='G1U1L1';panel.style.cssText='position:fixed;left:-10000px;width:640px;';
  const host=document.createElement('div');host.className='simViewport';panel.append(host,document.querySelector('.simMetrics').cloneNode(true));document.body.append(panel);
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);const kit=new ModelKit(group);
  const key=new THREE.DirectionalLight(),rim=new THREE.DirectionalLight();
  const platform=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()),edge=platform.clone();edge.material=platform.material.clone();
  const renderer={setPixelRatio(v){this.ratio=v},setSize(w,h){this.size=[w,h]}};
  const studio=createPlantGrowthStudio({host,scene,kit,renderer,key,rim,platform,edge});kit.begin();models3d.G1U1L1(kit,{light:12,t:14});kit.end();studio.update();studio.tick(.016,true);
  const resources=new Map(),watch=()=>scene.getObjectByName('bean-growth-detail').traverse(o=>{
   for(const r of [o.geometry,o.material,o.material?.map,o.material?.bumpMap])if(r&&!resources.has(r)){resources.set(r,0);r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1))}
  });watch();const initial={quality:host.dataset.quality,meshes:studio.meshCount,state:JSON.stringify(kit.values)};
  for(let i=0;i<45;i++)studio.frameTime(60);watch();studio.tick(.016,true);
  const reduced={quality:host.dataset.quality,reason:host.dataset.qualityReason,meshes:studio.meshCount,state:JSON.stringify(kit.values),visual:JSON.parse(host.dataset.visualGrowth),ratio:renderer.ratio};
  for(let i=0;i<90;i++)studio.frameTime(16);const stable=host.dataset.quality;studio.dispose();
  const disposed=[...resources.values()].every(count=>count===1)&&!scene.getObjectByName('bean-growth-detail')&&!host.querySelector('.plantReadouts');
  kit.dispose();platform.geometry.dispose();platform.material.dispose();edge.material.dispose();panel.remove();return {initial,reduced,stable,disposed,resources:resources.size};
 });
 assert.equal(budget.initial.quality,'high');assert.equal(budget.reduced.quality,'low');assert.equal(budget.reduced.reason,'frame-budget');assert(budget.reduced.meshes<budget.initial.meshes);assert.equal(budget.initial.state,budget.reduced.state);near(budget.reduced.visual.experimentGrowth,54.6,'Quality reduction preserves growth');assert.equal(budget.stable,'low');assert(budget.disposed,'All observed geometry/material/texture resources disposed exactly once');
 report.performance.push(budget);report.checks.push('Synthetic sustained slow frames trigger lower detail without science changes; no quality oscillation; GPU resources disposed');await p.context().close();
 // Browser-level touch input through Chrome DevTools, not synthetic mouse events.
 const touch=await makePage(browser,{viewport:{width:1024,height:768},isMobile:true,hasTouch:true});await activate(touch);
 if(await touch.locator('[data-sim-camera="drag"]').getAttribute('aria-pressed')!=='true')await touch.locator('[data-sim-camera="drag"]').click();
 await touch.locator('.simViewport').scrollIntoViewIfNeeded();const tb=await touch.locator('.simViewport canvas').boundingBox(),session=await touch.context().newCDPSession(touch),cx=tb.x+tb.width/2,cy=tb.y+tb.height/2,cam0=await camera(touch);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
 for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+i*10,y:cy,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(touch);assert(Math.abs((await camera(touch)).theta-cam0.theta)>.03,'Touch drag orbit');
 const pinch=await camera(touch);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:cy,id:1},{x:cx+35,y:cy,id:2}]});
 for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-35-i*7,y:cy,id:1},{x:cx+35+i*7,y:cy,id:2}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(touch);assert((await camera(touch)).radius<pinch.radius,'Two-finger pinch zoom');report.checks.push('Chrome iPad emulation: native touch drag and two-finger pinch');await touch.context().close();
 webkit=await playwright.webkit.launch({headless:true});
 for(const [width,height] of [[768,1024],[1024,768]]){
  const w=await makePage(webkit,{viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});await activate(w);
  for(const [light,t] of [[6,0],[12,14],[0,14]]){await choose(w,light,t);const r=await layout(w);checkLayout(r,`WebKit ${width} ${light}/${t}`);report.webkit.push({light,t,...r})}
  await w.locator('[data-sim-camera="left"]').tap();await settle(w);await w.locator('[data-sim-camera="in"]').tap();await settle(w);await w.locator('[data-sim-camera="reset"]').tap();await settle(w);
  await w.locator('[data-sim-view="2d"]').tap();assert(await w.locator('.simDiagram').isVisible());await w.locator('[data-sim-view="3d"]').tap();await settle(w);
  const file=`after-webkit-ipad-${width}-viewport.png`;await w.locator('.simViewport').screenshot({path:resolve(out,file)});report.screenshots.push(file);await w.context().close();console.log(`WebKit iPad ${width} passed`);
 }
 report.checks.push('WebKit iPad emulation both orientations, DPR2, three experiment states, touch toolbar and 3D/2D');
 assert.deepEqual(report.errors,[],'No JavaScript or local asset errors');report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;process.exitCode=1;console.error(e.stack)}finally{
 await browser?.close();await webkit?.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,'plant-browser-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,combinations:report.combinations,responsive:report.responsive.length,webkit:report.webkit.length,screenshots:report.screenshots.length,errors:report.errors}));
}
