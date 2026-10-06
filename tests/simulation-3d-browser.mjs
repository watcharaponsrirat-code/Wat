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
  await page.goto(url);
  const ids=await page.evaluate(()=>window.__SLH_QA__.lessonIds);
  for(const id of ids){
    if(process.argv.includes('--smoke')&&!['G1U1L1','G1U2L2'].includes(id))continue;
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
    if(['G1U1L1','G1U2L2','G2U3L1','G3U6L1'].includes(id)){
      const firstImage=await page.locator('[data-sim-viewport] canvas').screenshot();
      await page.locator('[data-sim-camera="left"]').click();await page.locator('[data-sim-camera="in"]').click();
      assert(!firstImage.equals(await page.locator('[data-sim-viewport] canvas').screenshot()),'Camera changes rendered pixels');
      await page.locator('[data-sim-camera="reset"]').click();
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
