// Controlled comparison: synthetic accounts, 800 ms API, 300 ms dashboard artwork.
// These timings isolate browser work; they are not live Apps Script measurements.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname,sep} from 'node:path';
import {harness} from './helpers/google-sheets-harness.mjs';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('../tmp/browser-check/playwright/driver/package');}
const arg=(name,value)=>{const i=process.argv.indexOf('--'+name);return i<0?value:process.argv[i+1];};
const root=resolve('.'),baseline=arg('baseline','8062673'),samples=Number(arg('samples','3'));
assert(Number.isInteger(samples)&&samples>0&&samples<=5);
const output=resolve(arg('output','tmp/login-speed-20261027/controlled.json'));
const changed=['index.html','assets/dashboard/dashboard.js','assets/login/login-ui.js'];
const before=new Map(changed.map(path=>[path,execFileSync('git',['show',baseline+':'+path],{windowsHide:true,maxBuffer:8*1024*1024})]));
const current=new Map(await Promise.all(changed.map(async path=>[path,await readFile(path)])));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=createServer(async(req,res)=>{
  try{
    const match=new URL(req.url,'http://localhost').pathname.match(/^\/(before|after)\/(.*)$/);assert(match);
    const path=decodeURIComponent(match[2]||'index.html'),file=resolve(root,path);assert(file.startsWith(root+sep));
    if(path==='assets/integrations/sheets-config.js'){res.setHeader('Content-Type',mime['.js']);return res.end('window.SLH_SHEETS_CONFIG={endpoint:"https://script.google.com/macros/s/SYNTHETIC_SPEED_TEST/exec"};');}
    if(!current.has(path))current.set(path,await readFile(file));
    if(/^assets\/dashboard\/.*\.webp$/.test(path))await delay(300);
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=3600');
    res.end(match[1]==='before'&&before.has(path)?before.get(path):current.get(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={baseline,conditions:{apiDelayMs:800,artDelayMs:300,network:'loopback, synthetic API only',samples,viewport:'1366x900',metric:'submit to current dashboard visible and viewport pictures decoded, plus two animation frames'},runs:[]};
let browser;
try{
  browser=await pw.chromium.launch({channel:'chrome',headless:true});
  for(let sample=1;sample<=samples;sample++)for(const variant of sample%2?['before','after']:['after','before'])for(const role of ['student','teacher']){
    const h=harness(),sourceSnapshot=JSON.stringify([h.students.rows,h.staff.rows,h.sheets.get('SLH_Events').rows,h.sheets.get('SLH_Resets').rows]),errors=[],actions=[],context=await browser.newContext({viewport:{width:1366,height:900}});
    await context.addInitScript(()=>{
      const get=Storage.prototype.getItem;window.__startup={reads:0,started:0};
      Storage.prototype.getItem=function(key){if(key.startsWith('slh_v163_'))window.__startup.reads++;return get.call(this,key);};
      document.addEventListener('click',e=>{if(e.target.closest('[data-action=login]'))window.__startup.started=performance.now();},true);
    });
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname==='127.0.0.1')return route.continue();
      if(url.href==='https://script.google.com/macros/s/SYNTHETIC_SPEED_TEST/exec'){
        const {action,payload,token}=request.postDataJSON();assert(['login','logout'].includes(action),'No scores or admin writes');actions.push(action);
        if(action==='login')await delay(800);
        return route.fulfill({json:h.call(action,payload,token),headers:{'Access-Control-Allow-Origin':'*'}});
      }
      errors.push('unexpected external request');return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',()=>errors.push('page error'));page.setDefaultTimeout(15000);
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/${variant}/`);
      await page.locator('#loginUser').fill(role==='teacher'?'watcharapon':'fixture0001');
      await page.locator('#loginPass').fill(role==='teacher'?h.staffPassword:h.password);
      await page.evaluate(()=>{window.__startup.reads=0;});
      await page.locator('[data-action=login]').click();
      await page.waitForTimeout(100);
      const busy=await page.locator('[data-action=login]').getAttribute('aria-busy')==='true';
      if(variant==='after')assert(busy,'busy state survives the submission microtask');
      await page.locator(role==='teacher'?'[data-student-open]':'[data-dashboard-name]').first().waitFor();
      const measurement=await page.evaluate(async()=>{
        const dataMs=performance.now()-window.__startup.started;
        const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
        const images=[...document.querySelectorAll('.dashboardPage img')].filter(visible);
        await Promise.all([document.fonts.ready,...images.map(img=>img.decode())]);
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return {dataMs:Math.round(dataMs),readyMs:Math.round(performance.now()-window.__startup.started),progressReads:window.__startup.reads};
      });
      if(variant==='after')assert.equal(measurement.progressReads,role==='teacher'?0:40);
      assert.deepEqual(errors,[]);assert.equal(JSON.stringify([h.students.rows,h.staff.rows,h.sheets.get('SLH_Events').rows,h.sheets.get('SLH_Resets').rows]),sourceSnapshot);
      report.runs.push({variant,role,sample,busy,...measurement});
      // Tokens are synthetic and never reported; exercise the normal logout path.
      await page.locator('[data-action=logout]').click();await page.waitForFunction(()=>!!document.querySelector('#loginUser'));
      await page.waitForTimeout(50);assert(actions.includes('logout'));
      if(variant==='after'&&role==='student'&&sample===1){
        await page.locator('#loginUser').fill('fixture0001');
        await page.locator('#loginPass').fill('wrong');await page.locator('[data-action=login]').click();
        await page.waitForFunction(()=>document.querySelector('#loginMsg')?.textContent.length>0);
        assert.equal(await page.locator('[data-action=login]').getAttribute('aria-busy'),null);
        assert.equal(await page.locator('[data-action=login]').isEnabled(),true);
        await page.locator('#loginPass').fill(h.password);await page.locator('[data-action=login]').click();
        await page.locator('[data-dashboard-name]').waitFor();
        await page.locator('[data-action=logout]').click();await page.locator('#loginUser').waitFor();
      }
    }finally{await context.close();}
  }
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
