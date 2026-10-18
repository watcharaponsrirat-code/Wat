import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve('.'),out=resolve('tmp/cell-label-review');await mkdir(out,{recursive:true});
const report={status:'RUNNING',cases:[],errors:[],screenshots:[]};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{let asset=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);if(!asset||asset.endsWith('/'))asset+='index.html';const path=resolve(root,asset);assert(path.startsWith(root+sep));res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
const settle=async p=>{await p.locator('.simViewport canvas').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.simViewport')?.dataset.animating==='false');await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))};
const cameraCommand=async(p,name)=>{await p.locator(`[data-sim-camera="${name}"]`).click();await settle(p)};
try{
 for(const viewport of [{width:1440,height:1000},{width:375,height:812}].filter(v=>!process.argv.includes('--mobile')||v.width===375)){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',hasTouch:viewport.width<600,isMobile:viewport.width<600});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base);await page.evaluate(()=>window.__SLH_QA__.open('G1U3L1','lab'));await page.waitForSelector('[data-cell-studio]');await settle(page);
  // Independent geometry and camera: validate the actual SVG endpoint against
  // the nearest rendered surface, rather than trusting the studio's datasets.
  await page.evaluate(async()=>{
   const T=await import('/assets/vendor/three/three.module.js');
   const {createAnimalCellModel}=await import('/assets/simulations/cell-animal-model.js'),{createPlantCellModel}=await import('/assets/simulations/cell-plant-model.js');
   let model,type;const ray=new T.Raycaster(),camera=new T.PerspectiveCamera(40,1,1,5000);
   window.__cellLabelsCheck=()=>{
    const host=document.querySelector('.simViewport'),bounds=host.getBoundingClientRect();
    if(type!==host.dataset.cellType){model?.dispose();type=host.dataset.cellType;model=(type==='animal'?createAnimalCellModel:createPlantCellModel)({quality:host.dataset.cellQuality})}
    model.group.scale.setScalar(+document.querySelector('[data-sim-control="zoom"]').value);model.group.updateMatrixWorld(true);
    camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();camera.position.setFromSpherical(new T.Spherical(+host.dataset.cameraDistance,+host.dataset.polar,+host.dataset.azimuth));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    const boxes=[],targets=[];
    for(const button of host.querySelectorAll('[data-cell-hotspot]')){
     const id=button.dataset.cellHotspot,b=button.getBoundingClientRect(),line=host.querySelector(`[data-cell-leader="${id}"]`),dot=host.querySelector(`[data-cell-anchor="${id}"]`);
     boxes.push({id,number:button.querySelector('.cellHotspotNumber').textContent,x:b.left-bounds.left,y:b.top-bounds.top,w:b.width,h:b.height,hidden:button.hidden,state:button.dataset.cellVisibility});
     const lineVisible=getComputedStyle(line).display!=='none',dotVisible=getComputedStyle(dot).display!=='none';
     if(!lineVisible&&!dotVisible)continue;
     const x=+dot.getAttribute('cx'),y=+dot.getAttribute('cy'),entry=model.organelles.find(e=>e.id===id);
     ray.setFromCamera(new T.Vector2(x/host.clientWidth*2-1,1-y/host.clientHeight*2),camera);
     const first=ray.intersectObject(model.group,true).find(hit=>{const mats=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];return mats.some(m=>m.visible!==false&&(!m.transparent||m.opacity>=.78))});
     const anchor=entry.anchor.clone().applyMatrix4(model.group.matrixWorld),projected=anchor.clone().project(camera);
     const path=line.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
     targets.push({id,hit:first?.object.userData.cellOrganelle,gap:first?.point.distanceTo(anchor),pixelError:Math.hypot(x-(projected.x+1)*host.clientWidth/2,y-(1-projected.y)*host.clientHeight/2),lineError:Math.hypot(path[0]-x,path[1]-y),lineVisible,dotVisible});
    }
    return {boxes,targets,width:host.clientWidth,height:host.clientHeight,selected:host.dataset.cellSelected,overflow:document.documentElement.scrollWidth>innerWidth};
   };
  });
  const sample=()=>page.evaluate(()=>window.__cellLabelsCheck());
  const check=(data,fixed,label)=>{
   assert.equal(data.boxes.length,12,`${label}: all 12 numbers`);assert(!data.overflow,`${label}: no page overflow`);
   assert.deepEqual(data.boxes.map(b=>b.number),Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')),`${label}: no missing number`);
   for(let i=0;i<data.boxes.length;i++){const b=data.boxes[i];assert(!b.hidden&&b.w>=43.9&&b.h>=43.9,`${label}/${b.id}: visible touch target`);assert(b.x>=0&&b.y>=0&&b.x+b.w<=data.width+.1&&b.y+b.h<=data.height+.1,`${label}/${b.id}: bounded`);if(fixed){const old=fixed[i];assert(Math.hypot(b.x-old.x,b.y-old.y)<.1&&Math.abs(b.w-old.w)<.1&&Math.abs(b.h-old.h)<.1,`${label}/${b.id}: fixed during motion/selection`)}for(const a of data.boxes.slice(i+1))assert(!(b.x<a.x+a.w&&b.x+b.w>a.x&&b.y<a.y+a.h&&b.y+b.h>a.y),`${label}: rails do not overlap`)}
   assert(data.targets.length<=1,`${label}: one clear leader`);
   for(const t of data.targets){assert(t.lineVisible&&t.dotVisible,`${label}: tip and line agree`);assert.equal(t.hit,t.id,`${label}: tip hits the actual ${t.id}`);assert(t.gap<.17&&t.pixelError<.01&&t.lineError<.01,`${label}/${t.id}: exact pinned surface tip ${JSON.stringify(t)}`)}
  };
  for(const type of ['animal','plant']){
   await page.locator(`[data-cell-type-switch="${type}"]`).click();await cameraCommand(page,'reset');let data=await sample();const fixed=data.boxes;check(data,null,`${type}/${viewport.width}`);
   for(const view of ['reset','front']){
    await cameraCommand(page,view);
    for(const {id} of fixed){
     await page.locator(`[data-cell-hotspot="${id}"]`).click();await settle(page);data=await sample();check(data,fixed,`${type}/${viewport.width}/${view}/${id}`);
     assert.equal(data.selected,id);assert.equal(data.targets.length,1,`${type}/${view}/${id}: default/front exposed surface has a leader`);assert.equal(data.targets[0].id,id);
    }
   }
   await cameraCommand(page,'reset');await page.locator('[data-cell-hotspot="cytoplasm"]').click();await settle(page);data=await sample();check(data,fixed,'cytoplasm');assert.equal(data.targets[0].id,'cytoplasm');
   if(type==='animal')assert.equal(data.boxes.find(b=>b.id==='cytoplasm').number,'02');
   const image=`${type}-${viewport.width}-cytoplasm.png`;await page.locator('.simViewport').screenshot({path:resolve(out,image)});report.screenshots.push(image);
   let targets=0,hidden=0;
   // A real pointer drag, sampled during motion and inertia.
   const box=await page.locator('.simViewport canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
   for(let i=1;i<=16;i++){await page.mouse.move(box.x+box.width*.5+i*7,box.y+box.height*.5+i);data=await sample();check(data,fixed,'drag frame');targets+=data.targets.length;hidden+=Number(!data.targets.length)}await page.mouse.up();await settle(page);
   await page.locator('[data-sim-camera="auto"]').click();
   for(let i=0;i<12;i++){await page.waitForTimeout(40);data=await sample();check(data,fixed,'auto frame');targets+=data.targets.length;hidden+=Number(!data.targets.length)}
   await page.locator('[data-sim-camera="auto"]').click();await settle(page);
   // Around the entire model, hidden anchors may never point through its shell.
   for(const id of ['cytoplasm','nucleus','ribosomes','mitochondria']){
    await cameraCommand(page,'reset');await page.locator(`[data-cell-hotspot="${id}"]`).click();
    for(let i=0;i<24;i++){await cameraCommand(page,'right');data=await sample();check(data,fixed,`${id}/orbit${i}`);targets+=data.targets.length;hidden+=Number(!data.targets.length);if(!data.targets.length)assert(await page.locator('.cellSelectionVisibility').isVisible(),'Hidden target has an explanation')}
   }
   assert(hidden>0,'Occluded targets actually exercised');
   for(const zoom of ['1','2']){
    await page.locator('[data-sim-control="zoom"]').fill(zoom);await page.locator('[data-sim-control="zoom"]').dispatchEvent('input');
    for(const view of ['front','top']){
     await cameraCommand(page,view);await page.locator('[data-cell-hotspot="nucleus"]').click();await settle(page);check(await sample(),fixed,`${view}/zoom${zoom}`);
    }
   }
   await page.locator('[data-sim-control="zoom"]').fill('1');await page.locator('[data-sim-control="zoom"]').dispatchEvent('input');
   await cameraCommand(page,'reset');await page.locator('[data-cell-hotspot="cytoplasm"]').click();await cameraCommand(page,'labels');assert.equal(await page.locator('[data-cell-hotspot]:visible').count(),0);await cameraCommand(page,'labels');check(await sample(),fixed,'labels restored');
   report.cases.push({type,viewport,selectionChecks:24,motionFrames:124,visibleTargets:targets,occludedFrames:hidden});console.log(`Cell label ${type}/${viewport.width} passed`);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;console.error(error.stack)}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases,errors:report.errors}))}
