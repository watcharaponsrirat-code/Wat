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
const output=resolve(root,'tmp/simulation-clarity');await mkdir(output,{recursive:true});
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
const browser=await playwright.chromium.launch({channel:'chrome',headless:true}),report={cases:0,errors:[]};
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);
 const scenarios=[['G2U3L2',{inhale:0}],['G2U3L2',{inhale:100}],['G2U3L4',{t:4}],['G2U3L5',{day:14}],['G2U3L5',{day:28}],['G1U2L2',{kind:3,count:6}],['G1U3L1',{cell:1,zoom:1.4}],['G1U3L2',{mode:1,t:100}],['G1U4L1',{t:3}],['G3U3L2',{pair:2,angle:80}],['G3U6L1',{kind:1,on:1}],['G3U6L1',{kind:1,on:0}],['G3U7L2',{corridor:1,t:50}],['G2U8L1',{}]];
 let expired;
 for(const [id,values] of scenarios){
  await page.evaluate(id=>window.__SLH_QA__.open(id,'lab'),id);await page.waitForSelector('.simPanel[data-sim-view="3d"]');
  for(const [key,value]of Object.entries(values)){const c=page.locator('[data-sim-control="'+key+'"]');if(await c.evaluate(e=>e.tagName==='SELECT'))await c.selectOption(String(value));else{await c.fill(String(value));await c.dispatchEvent('input')}}
  const host=page.locator('[data-sim-viewport]');await host.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-sim-viewport]').dataset.animating==='false');
  assert.equal(await host.getAttribute('data-label-overflow'),'false',id+' callout clipped');assert.equal(await host.getAttribute('data-label-overlap'),'false',id+' callout overlap');
  const state=JSON.parse(await host.getAttribute('data-model-state'));
  if(id==='G2U3L2'){if(values.inhale===0)expired=state;else{assert(state.lungVolumeIndex>expired.lungVolumeIndex);assert(state.diaphragmY<expired.diaphragmY)}}
  if(id==='G3U6L1')assert.equal(state.current,values.on?1.2:0);
  if(id==='G3U3L2')assert.equal(state.totalInternalReflection,true);
  await host.screenshot({path:resolve(output,id+'-boundary-'+report.cases+'.png')});
  if(id==='G2U3L2'){await page.locator('[data-sim-view="2d"]').click();assert((await page.locator('.simDiagram').textContent()).includes(values.inhale?'สิ้นสุดหายใจเข้า':'สิ้นสุดหายใจออก'));await page.locator('.simDiagram').screenshot({path:resolve(output,id+'-2d-'+values.inhale+'.png')})}
  report.cases++;
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();server.close();await writeFile(resolve(output,'boundary-report.json'),JSON.stringify(report,null,2));console.log(report)}
