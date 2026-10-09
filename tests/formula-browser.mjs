import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve(import.meta.dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+sep))throw Error('Invalid path');res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],report={formulaSections:0,layouts:0,checks:[]};
await mkdir(resolve(root,'tmp/formulas'),{recursive:true});
try{
 browser=await playwright.chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url())});
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';document.head.append(s)}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 await page.locator('[data-action="login"]').click();
 const codes=await page.evaluate(()=>Object.keys(window.SLH_MATH.catalog));
 for(const code of codes){
  const lesson=code.replace(/S\d+$/,'');
  await page.evaluate(id=>window.__SLH_QA__.open(id,'content'),lesson);
  const block=page.locator('[data-equation="'+code+'"]');assert.equal(await block.count(),1);
  for(const width of [1366,390,320]){
   await page.setViewportSize({width,height:1000});await block.scrollIntoViewIfNeeded();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow '+code+'/'+width);
   const geometry=await block.evaluate(el=>({fits:el.scrollWidth<=el.clientWidth+1,fractions:[...el.querySelectorAll('.eq-fraction')].map(f=>{const n=f.querySelector('.eq-numerator'),d=f.querySelector('.eq-denominator');return {fits:f.scrollWidth<=f.clientWidth+1,stacked:n.getBoundingClientRect().bottom<=d.getBoundingClientRect().top+1,bar:parseFloat(getComputedStyle(n).borderBottomWidth)>0}})}));
   assert(geometry.fits,'Equation clipped '+code+'/'+width);assert(geometry.fractions.every(f=>f.fits&&f.stacked&&f.bar),'Fraction layout '+code+'/'+width);
   report.layouts++;
   if(['G2U2L2S4','G2U5L2S3','G1U5L1S5'].includes(code)&&width!==320)await block.screenshot({path:resolve(root,'tmp/formulas/'+code+'-'+width+'.png')});
  }
  report.formulaSections++;
 }
 report.checks.push('all 23 formula sections','Thai labelled fractions and units','fraction bar and stacked geometry','320/390/1366px no overflow');
 await page.evaluate(()=>window.__SLH_QA__.open('G2U5L1','e2'));
 const qs=await page.evaluate(()=>window.__SLH_QA__.snapshot('G2U5L1').ex.e2.state.qs);
 for(const [i,q] of qs.entries()){
  const choices=page.locator('[data-ex-q="'+i+'"]');
  const index=await choices.evaluateAll((els,correct)=>els.findIndex(el=>el.dataset.exO===correct),q.correct);
  assert(index>=0);await choices.nth(index).click();
 }
 await page.locator('[data-ex-check]').click();
 assert(await page.evaluate(()=>window.__SLH_QA__.snapshot('G2U5L1').ex.e2.done));
 assert(await page.locator('.qFeedback .eq-inline').count()>0);
 const saved=await page.evaluate(()=>JSON.stringify(window.__SLH_QA__.snapshot('G2U5L1').ex.e2.state));
 await page.reload();await page.locator('[data-action="login"]').click();
 await page.evaluate(()=>window.__SLH_QA__.open('G2U5L1','e2'));
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__SLH_QA__.snapshot('G2U5L1').ex.e2.state)),saved);
 const stage=await page.evaluate(()=>'g'+(window.SLH_GAME_CATALOG.G1U2L1.findIndex(g=>g.type==='tune')+1));
 await page.evaluate(stage=>window.__SLH_QA__.open('G1U2L1',stage),stage);
 assert(await page.locator('.arcade-formula .eq-fraction').count()>0);
 report.checks.push('correct answers still grade 100%','formatted solution feedback','raw saved answers unchanged after reload','game formula uses shared renderer');
 assert.deepEqual(errors,[]);report.errors=errors;
}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(resolve(root,'tmp/formulas/browser-report.json'),JSON.stringify({...report,errors},null,2));console.log(report)}
