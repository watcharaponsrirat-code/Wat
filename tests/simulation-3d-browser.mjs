import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let playwright;
try { playwright=require('playwright'); } catch { playwright=require('../tmp/browser-check/playwright/driver/package'); }
const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'tmp/simulation-3d');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/favicon.ico'){res.statusCode=204;res.end();return}
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path));
  }catch{res.statusCode=404;res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/index.html`;
const report={lessons:0,controls:0,layouts:0,errors:[]};let browser;
try{
  browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:1000}});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());if(message.text().startsWith('3D '))console.log(message.text())});
  await page.goto(url);
  const ids=await page.evaluate(()=>window.__SLH_QA__.lessonIds);
  for(const id of ids){
    if(process.argv.includes('--smoke')&&!['G1U1L1','G1U2L2','G3U4L1','G3U6L1'].includes(id))continue;
    await page.evaluate(id=>window.__SLH_QA__.open(id,'lab'),id);
    await page.waitForSelector('.simPanel[data-sim-view="3d"]');
    assert(await page.locator('[data-sim-viewport]').evaluate(e=>+e.dataset.meshes>0),id+' 3D geometry');
    const inputs=await page.locator('[data-sim-control]').evaluateAll(els=>els.map(e=>({key:e.dataset.simControl,select:e.tagName==='SELECT',max:e.tagName==='SELECT'?e.options.length-1:Number(e.max)})));
    for(const input of inputs){
      const oldRevision=await page.locator('[data-sim-viewport]').getAttribute('data-revision');
      const control=page.locator(`[data-sim-control="${input.key}"]`);
      if(input.select)await control.selectOption(String(input.max));else{await control.fill(String(input.max));await control.dispatchEvent('input')}
      assert(Number(await page.locator('[data-sim-viewport]').getAttribute('data-revision'))>Number(oldRevision));
      assert.equal(await page.evaluate(({id,key})=>window.__SLH_QA__.snapshot(id).simulation[id].values[key],{id,key:input.key}),input.max);
      report.controls++;
    }
    await page.locator('[data-sim-reset]').click();
    for(const width of [1366,390,320]){
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' overflow '+width);
      report.layouts++;
    }
    await page.setViewportSize({width:1366,height:1000});
    await page.locator('[data-sim-viewport]').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
    assert.equal(await page.locator('[data-sim-viewport]').getAttribute('data-renderer'),'native');
    const readCamera=()=>page.locator('[data-sim-viewport]').evaluate(e=>({theta:+e.dataset.azimuth,radius:+e.dataset.cameraDistance}));
    const settle=()=>page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
    const original=await readCamera();
    await page.locator('[data-sim-camera="left"]').click();await settle();const left=await readCamera();
    assert(Math.abs(left.theta-original.theta+Math.PI/12)<.001,id+' left must rotate 15 degrees');
    await page.locator('[data-sim-camera="right"]').click();await settle();const restored=await readCamera();
    assert(Math.abs(restored.theta-original.theta)<.001,id+' opposite rotations must cancel');
    await page.locator('[data-sim-camera="in"]').click();await settle();
    await page.locator('[data-sim-camera="out"]').click();await settle();
    assert(Math.abs((await readCamera()).radius-original.radius)<1,id+' reciprocal zoom');
    await page.locator('[data-sim-viewport]').screenshot({path:resolve(output,id+'-native.png')});
    if(['G1U1L1','G1U2L2','G2U3L1','G3U6L1'].includes(id)){
      const firstImage=await page.locator('[data-sim-viewport] canvas').screenshot();
      await page.locator('[data-sim-camera="left"]').click();await page.locator('[data-sim-camera="in"]').click();
      assert(!firstImage.equals(await page.locator('[data-sim-viewport] canvas').screenshot()),'Camera changes rendered pixels');
      await page.locator('[data-sim-camera="reset"]').click();
      await page.locator('[data-sim-viewport]').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
      const distance=Number(await page.locator('[data-sim-viewport]').getAttribute('data-camera-distance'));
      await page.setViewportSize({width:150,height:1000});await page.waitForTimeout(80);
      await page.setViewportSize({width:1366,height:1000});
      await page.waitForFunction(distance=>Math.abs(Number(document.querySelector('[data-sim-viewport]').dataset.cameraDistance)-distance)<1,distance);
      await page.locator('.simPanel').screenshot({path:resolve(output,id+'-desktop.png')});
      await page.setViewportSize({width:390,height:844});
      await page.locator('.simStudio').screenshot({path:resolve(output,id+'-mobile.png')});
      await page.setViewportSize({width:1366,height:1000});
    }
    const before=await page.evaluate(id=>JSON.stringify(window.__SLH_QA__.snapshot(id)),id);
    await page.locator('[data-sim-view="2d"]').click();assert(await page.locator('.simDiagram').isVisible());
    await page.locator('[data-sim-view="3d"]').click();assert(await page.locator('[data-sim-viewport] canvas').isVisible());
    assert.equal(await page.evaluate(id=>JSON.stringify(window.__SLH_QA__.snapshot(id)),id),before,'Camera mode must not affect progress');
    report.lessons++;console.log('3D passed '+id);
  }
  // Time updates preserve a single canvas; navigation disposes it and stops the clock.
  await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','lab'));
  await page.waitForSelector('.simPanel[data-sim-view="3d"]');
  await page.locator('[data-sim-play]').click();
  await page.waitForFunction(()=>window.__SLH_QA__.snapshot('G1U1L1').simulation.G1U1L1.values.t>0);
  await page.locator('[data-sim-play]').click();assert.equal(await page.locator('canvas').count(),1);
  await page.locator('[data-sim-play]').click();
  await page.locator('[data-stage="g1"]').first().click();
  const saved=await page.evaluate(()=>JSON.stringify(window.__SLH_QA__.snapshot('G1U1L1').simulation));
  await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>JSON.stringify(window.__SLH_QA__.snapshot('G1U1L1').simulation)),saved);
  assert.equal(await page.locator('[data-sim-viewport] canvas').count(),0);
  await page.reload();await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','lab'));
  await page.waitForSelector('.simPanel[data-sim-view="3d"]');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__SLH_QA__.snapshot('G1U1L1').simulation)),saved);
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}});
  await fallback.goto(url);await fallback.evaluate(()=>window.__SLH_QA__.open('G1U1L1','lab'));
  await fallback.waitForSelector('.simPanel[data-sim-view="2d"]');assert(await fallback.locator('.simDiagram').isVisible());
  await fallback.locator('[data-sim-control="light"]').fill('12');await fallback.locator('[data-sim-control="light"]').dispatchEvent('input');
  assert.equal(await fallback.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').simulation.G1U1L1.values.light),12);
  report.fallback='passed';
  await page.locator('[data-sim-viewport]').scrollIntoViewIfNeeded();
  const dragBox=await page.locator('[data-sim-viewport] canvas').boundingBox();
  const thetaBefore=Number(await page.locator('[data-sim-viewport]').getAttribute('data-azimuth'));
  await page.mouse.move(dragBox.x+dragBox.width/2,dragBox.y+dragBox.height/2);await page.mouse.down();
  await page.mouse.move(dragBox.x+dragBox.width/2+90,dragBox.y+dragBox.height/2,{steps:10});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
  assert(Math.abs(Number(await page.locator('[data-sim-viewport]').getAttribute('data-azimuth'))-thetaBefore)>.05,'Pointer drag rotates the model');
  await page.locator('[data-sim-camera="auto"]').click();
  const autoStart=Number(await page.locator('[data-sim-viewport]').getAttribute('data-azimuth'));
  await page.waitForFunction(start=>Math.abs(Number(document.querySelector('[data-sim-viewport]').dataset.azimuth)-start)>.03,autoStart);
  await page.locator('[data-sim-camera="auto"]').click();
  await page.locator('[data-sim-camera="front"]').click();
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('[data-sim-viewport]').dataset.azimuth))<.001);
  await page.evaluate(()=>{for(let i=0;i<24;i++)document.querySelector('[data-sim-camera="right"]').click()});
  await page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
  assert(Math.abs(Number(await page.locator('[data-sim-viewport]').getAttribute('data-azimuth')))<.001,'Full 360-degree turn must return to front');
  await page.locator('[data-sim-camera="labels"]').click();assert.equal(await page.locator('[data-sim-camera="labels"]').getAttribute('aria-pressed'),'false');
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-sim-camera="reset"]').click();
  await page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
  report.camera=report.lessons+' lessons: equal 15-degree steps, reciprocal zoom; full turn, presets, auto rotation, labels and reduced motion';
  const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await touch.goto(url);await touch.evaluate(()=>window.__SLH_QA__.open('G1U2L2','lab'));await touch.waitForSelector('.simPanel[data-sim-view="3d"]');
  await touch.locator('[data-sim-camera="drag"]').click();await touch.locator('[data-sim-viewport]').scrollIntoViewIfNeeded();
  const touchBox=await touch.locator('[data-sim-viewport] canvas').boundingBox(),cx=touchBox.x+touchBox.width/2,cy=touchBox.y+touchBox.height/2;
  const beforePinch=Number(await touch.locator('[data-sim-viewport]').getAttribute('data-camera-distance'));
  const cdp=await touch.context().newCDPSession(touch);
  const points=gap=>[{id:1,x:cx-gap,y:cy},{id:2,x:cx+gap,y:cy}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(30)});
  for(let gap=32;gap<=58;gap+=2)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(gap)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.waitForFunction(before=>Number(document.querySelector('[data-sim-viewport]').dataset.cameraDistance)<before*.9,beforePinch);
  report.touch='two-finger pinch zoom passed';await touch.close();
  await page.locator('[data-sim-viewport] canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  assert(await page.locator('.simDiagram').isVisible());assert(await page.locator('[data-sim-view="3d"]').isDisabled());
  report.contextLoss='passed';
  const webkit=await playwright.webkit.launch({headless:true});
  try{
    const mobile=await webkit.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    mobile.on('pageerror',e=>report.errors.push('WebKit: '+e.message));
    await mobile.goto(url);await mobile.evaluate(()=>window.__SLH_QA__.open('G1U2L2','lab'));
    await mobile.waitForSelector('.simPanel[data-sim-view]');
    report.webkit=await mobile.locator('.simPanel').getAttribute('data-sim-view');
    if(report.webkit==='3d'){
      assert.equal(await mobile.locator('[data-sim-viewport] canvas').evaluate(e=>e.style.touchAction),'pan-y');
      await mobile.locator('[data-sim-camera="drag"]').click();
      assert.equal(await mobile.locator('[data-sim-viewport] canvas').evaluate(e=>e.style.touchAction),'none');
      await mobile.locator('[data-sim-camera="in"]').click();
    }
    assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await mobile.locator('.simStudio').screenshot({path:resolve(output,'webkit-mobile.png')});
  }finally{await webkit.close()}
  assert.deepEqual(report.errors,[]);
}finally{await browser?.close();server.close();await writeFile(resolve(output,process.argv.includes('--smoke')?'report-smoke.json':'report.json'),JSON.stringify(report,null,2));console.log(report)}
