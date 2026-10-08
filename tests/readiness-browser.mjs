import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve(import.meta.dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/';
let browser;const errors=[],report={screens:0,readingImages:0,checks:[]};
try{
 browser=await playwright.chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:1000}});
 page.setDefaultTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>errors.push(r.url()));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url())});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
   const style=document.createElement('style');style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';document.head.append(style);
 }));
 await page.goto(url);
 assert(await page.locator('.loginPanel').innerText().then(t=>t.includes('โหมดสาธิต')));
 for(const width of [1366,390,320]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Login overflow '+width);
 }
 await page.getByLabel('รหัสผู้ใช้',{exact:true}).fill('M20105');
 await page.getByLabel('รหัสผ่าน',{exact:true}).fill('1234');
 await page.getByLabel('รหัสผ่าน',{exact:true}).press('Enter');
 await page.locator('.heroWorld').waitFor();
 assert(!await page.locator('#app').innerText().then(t=>t.includes('ภารกิจวันนี้')));
 report.checks.push('labelled login and Enter submission','demo disclosure','cumulative goal labels');
 await mkdir(resolve(root,'tmp/readiness'),{recursive:true});
 await page.screenshot({path:resolve(root,'tmp/readiness/dashboard-mobile.png'),fullPage:true});
 const ids=await page.evaluate(()=>window.__SLH_QA__.lessonIds);
 if(!process.argv.includes('--smoke'))for(const id of ids){
  for(const stage of ['content','lab','g1','g2','g3','e1','e2','e3','exam','result']){
   await page.evaluate(({id,stage})=>window.__SLH_QA__.open(id,stage),{id,stage});
   for(const width of [1366,390,320]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+'/'+stage+'/'+width+' overflow');
    report.screens++;
   }
   if(stage==='content'){
    const images=await page.locator('.readingPage img').evaluateAll(async imgs=>{
     await Promise.all(imgs.map(async img=>{img.loading='eager';try{await img.decode()}catch{}}));
     return {count:imgs.length,broken:imgs.filter(img=>!img.naturalWidth).map(img=>img.src)};
    });
    assert.deepEqual(images.broken,[]);report.readingImages+=images.count;
    assert(await page.locator('.readingOutline a').evaluateAll(els=>els.every(a=>document.getElementById(a.hash.slice(1)))),'Reading anchor '+id);
   }
  }
  console.log('Screen audit '+id);
 }
 const id=ids[0];
 await page.evaluate(id=>{const p=window.__SLH_QA__.snapshot(id);p.exam={passed:false,best:0,last:0,attempts:1,current:null,history:[]};p.resume='content';localStorage.setItem('slh_v163_M20105_'+id,JSON.stringify(p));window.__SLH_QA__.open(id,'content')},id);
 await page.locator('[data-action="home"]').click();
 await page.locator('[data-nav="results"]').click();
 await page.locator('[data-open-result="'+id+'"]').click();
 assert(await page.locator('#app').innerText().then(t=>t.includes('คะแนนล่าสุด 0%')));
 await page.locator('[data-action="back"]').click();
 assert.equal(await page.locator('[data-open-result="'+id+'"]').count(),1);
 report.checks.push('0% result shown','view result ignores resumed content','back to result list');
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')};window.__SLH_QA__.open('G1U1L1','content')});
 await page.locator('[data-content-complete]').click();
 assert.equal(await page.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').contentDone),true);
 await page.locator('#storageNotice').waitFor({state:'visible'});
 assert(await page.locator('#storageNotice').innerText().then(t=>t.includes('อาจหายเมื่อปิดหรือโหลดหน้าใหม่')));
 assert(await page.locator('#storageNotice').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'Storage warning must be in the viewport');
 await page.screenshot({path:resolve(root,'tmp/readiness/storage-warning.png')});
 report.checks.push('quota failure preserves in-page progress and shows persistent warning');
 assert.deepEqual(errors,[]);
 report.errors=errors;
}finally{
 await browser?.close();await new Promise(r=>server.close(r));
 await mkdir(resolve(root,'tmp/readiness'),{recursive:true});
 await writeFile(resolve(root,process.argv.includes('--smoke')?'tmp/readiness/browser-smoke-report.json':'tmp/readiness/browser-report.json'),JSON.stringify({...report,errors},null,2));
 console.log(report);
}
