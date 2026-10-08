import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve(fileURLToPath(new URL('..',import.meta.url)),process.argv[2]||'_site');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
// A project subpath catches broken relative paths in extracted styles/scripts.
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith('/school/')){res.writeHead(404);res.end();return}
    const file=resolve(root,path.slice('/school/'.length)||'index.html');
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],report={};
try{
  browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  console.log('Deployment browser launched');
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url())});
  await page.goto(`http://127.0.0.1:${server.address().port}/school/`);
  console.log('Deployment login page loaded');
  await page.locator('.loginBrand>img').evaluate(img=>img.decode());
  await page.locator('#loginUser').fill('M20105');await page.locator('#loginPass').fill('1234');await page.locator('[data-action="login"]').click();
  await page.locator('.heroWorld').waitFor();
  console.log('Deployment login passed');
  await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','content'));
  await page.locator('.lessonImage').first().scrollIntoViewIfNeeded();
  await page.locator('.lessonImage').first().evaluate(img=>img.decode());
  await page.locator('[data-content-complete]').click();
  await page.waitForSelector('.simPanel[data-sim-view="3d"]');
  console.log('Deployment native model loaded');
  await page.locator('[data-sim-control="light"]').fill('12');await page.locator('[data-sim-control="light"]').dispatchEvent('input');
  await page.reload();await page.locator('#loginUser').fill('M20105');await page.locator('#loginPass').fill('1234');await page.locator('[data-action="login"]').click();
  await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','lab'));
  await page.waitForSelector('.simPanel[data-sim-view="3d"]');
  assert.equal(await page.locator('[data-sim-control="light"]').inputValue(),'12');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.checks=['project subpath','school logo','login/dashboard','reading image','native 3D dynamic imports','saved progress after reload','390px layout'];
  await mkdir('tmp/deployment',{recursive:true});await page.screenshot({path:'tmp/deployment/mobile.png'});
  assert.deepEqual(errors,[]);report.errors=errors;
}finally{await browser?.close();server.close();console.log(report)}
