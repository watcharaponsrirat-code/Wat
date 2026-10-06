import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);let chromium,webkit;
try{({chromium,webkit}=require('playwright'))}catch{({chromium,webkit}=require('../tmp/browser-check/playwright/driver/package'))}
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'tmp/icon-audit');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid path');
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/index.html`,report={views:0,icons:0,errors:[],engines:[]};
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
 page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);
 const check=async label=>{
  const state=await page.evaluate(()=>({emoji:[...document.body.innerText.matchAll(/\p{Extended_Pictographic}/gu)].map(m=>m[0]),icons:document.querySelectorAll('.uiIcon').length,overflow:document.documentElement.scrollWidth>innerWidth,empty:[...document.querySelectorAll('.uiIcon')].filter(e=>!e.children.length).length}));
  assert.deepEqual(state.emoji,[],label+' has unconverted emoji');assert(!state.overflow,label+' overflow');assert.equal(state.empty,0);report.views++;report.icons+=state.icons;
 };
 await check('login');await page.locator('[data-action="login"]').click();await check('dashboard');
 await page.screenshot({path:resolve(output,'dashboard-mobile.png')});
 const ids=await page.evaluate(()=>window.__SLH_QA__.lessonIds);
 for(const id of ids){for(const stage of ['content','lab','g1','g2','g3','e1','e2','e3','exam','result']){
  await page.evaluate(({id,stage})=>window.__SLH_QA__.open(id,stage),{id,stage});await check(id+'/'+stage);
 }console.log('Icons checked '+id)}
 // The pictograms in food-web buttons retain their labels and click behavior.
 const web=await page.evaluate(()=>{for(const [id,games] of Object.entries(window.SLH_GAME_CATALOG)){const i=games.findIndex(g=>g.type==='web');if(i>=0)return{id,stage:'g'+(i+1),edges:games[i].edges}}});
 await page.evaluate(({id,stage})=>window.__SLH_QA__.open(id,stage),web);
 for(const [from,to] of web.edges){await page.locator(`[data-arc-node="${from}"]`).click();await page.locator(`[data-arc-node="${to}"]`).click()}
 await page.locator('[data-arc-check]').click();assert.equal(await page.locator('.arcade-win .uiIcon--trophy').count(),1);await check('completed food web');
 await page.screenshot({path:resolve(output,'food-web-mobile.png')});
 // New text nodes, in-place text edits and toast containers outside #app are covered.
 const dynamic=await page.evaluate(async()=>{
  const toast=document.createElement('div');toast.className='toast';document.body.append(toast);toast.textContent='✅ สำเร็จ';await new Promise(r=>setTimeout(r,0));
  const first=toast.querySelector('.uiIcon')?.classList.contains('uiIcon--check');toast.textContent='❌ ลองใหม่';await new Promise(r=>setTimeout(r,0));
  const second=toast.querySelector('.uiIcon')?.classList.contains('uiIcon--close');toast.remove();
  const test=document.createElement('div');test.innerHTML='<textarea>🧪 บันทึกส่วนตัว</textarea><p contenteditable="true">🌿 ข้อความของผู้ใช้</p><p>อาหาร → ผู้กิน</p><button aria-label="เปิด">▶</button>';document.body.append(test);await new Promise(r=>setTimeout(r,0));
  const result={first,second,input:test.querySelector('textarea').value,editable:test.querySelector('[contenteditable]').textContent,science:test.querySelectorAll('p')[1].textContent,decorative:test.querySelector('button svg').getAttribute('aria-hidden')};test.remove();return result;
 });
 assert.deepEqual(dynamic,{first:true,second:true,input:'🧪 บันทึกส่วนตัว',editable:'🌿 ข้อความของผู้ใช้',science:'อาหาร → ผู้กิน',decorative:'true'});
 await page.evaluate(()=>window.__SLH_QA__.login());await page.setViewportSize({width:1366,height:1000});await check('desktop dashboard');await page.screenshot({path:resolve(output,'dashboard-desktop.png')});
 report.engines.push('Chrome');
 const wb=await webkit.launch({headless:true});try{const mobile=await wb.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});mobile.on('pageerror',e=>report.errors.push(e.message));await mobile.goto(url);await mobile.locator('[data-action="login"]').click();assert(await mobile.locator('.uiIcon--home').count()>0);assert(!await mobile.evaluate(()=>/\p{Extended_Pictographic}/u.test(document.body.innerText)));report.engines.push('WebKit')}finally{await wb.close()}
 assert.deepEqual(report.errors,[]);
}finally{await browser?.close();server.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(report)}
