/** Login-only browser checks. Uses a fresh profile and the documented demo users. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'tmp/login-redesign');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Invalid path');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],report={layouts:[],checks:[],errors};
try{
  browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    const key='slh_v163_M20105_G1U1L1';
    const seed=JSON.stringify({xp:37,contentDone:true,contentIndex:1,resume:'content'});
    if(localStorage.getItem(key)===null)localStorage.setItem(key,seed);
    window.__LOGIN_TEST__={key,seed,writes:[]};
    for(const method of ['setItem','removeItem','clear']){
      const original=Storage.prototype[method];
      Storage.prototype[method]=function(...args){window.__LOGIN_TEST__.writes.push({method,key:args[0]});return original.apply(this,args)};
    }
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url())});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('.loginBrand>img').evaluate(img=>img.decode());
  await page.locator('.loginPage img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  assert(await page.evaluate(async()=>{
    await document.fonts.ready;
    return document.fonts.check('400 64px "SLH Login Anton"') &&
      [...document.fonts].some(font=>font.family==='SLH Login Anton'&&font.status==='loaded');
  }),'The bundled title font must load without relying on installed desktop fonts');
  assert(await page.locator('.loginPanel').innerText().then(t=>t.includes('โหมดสาธิต')));
  assert(await page.locator('.loginGameTitle>span').evaluateAll(els=>els.every(el=>{
    const style=getComputedStyle(el);
    // The old title's brown shadow otherwise paints over transparent gradient glyphs.
    return style.webkitTextFillColor!=='rgba(0, 0, 0, 0)'||style.textShadow==='none';
  })),'Title gradients must not be obscured by the inherited brown text shadow');
  assert.equal(await page.locator('.loginPage input[type="checkbox"]').count(),0);
  assert.equal(await page.locator('.loginPage input[autocomplete="new-password"]').count(),0);
  const hitControl=async selector=>{
    const control=page.locator(selector);await control.scrollIntoViewIfNeeded();
    assert(await control.evaluate(el=>{
      const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      const hit=document.elementFromPoint(x,y);
      return r.width>0&&r.height>=40&&r.left>=-1&&r.right<=innerWidth+1&&hit&&(hit===el||el.contains(hit));
    }),'Control must be visible and receive pointer input: '+selector);
  };
  for(const [width,height] of [[320,740],[375,812],[390,844],[430,932],[768,1024],[1366,1000]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>[...document.querySelectorAll('.loginPage img')].every(img=>img.complete&&img.naturalWidth>0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal scroll at '+width);
    for(const selector of ['#loginUser','#loginPass','[data-login-password]','[data-action="login"]','[data-login-support]'])await hitControl(selector);
    assert(await page.locator('#loginPass').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'Password text remains readable');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:resolve(output,'login-'+width+'.png'),fullPage:true});
    report.layouts.push({width,height,overflow:false,controls:'accessible'});
  }
  report.checks.push('six responsive widths and unblocked controls','real logo and image decode','bundled portable title font','original demo disclosure','no unsupported remember/signup');
  await page.setViewportSize({width:390,height:360});
  await page.locator('#loginPass').focus();
  await hitControl('#loginPass');await hitControl('[data-action="login"]');
  assert(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight),'Short viewport must scroll naturally');
  await page.screenshot({path:resolve(output,'keyboard-height-360.png')});
  report.checks.push('short viewport scrolls to password and submit');

  await page.setViewportSize({width:390,height:844});
  const password=page.locator('#loginPass'),toggle=page.locator('[data-login-password]');
  await password.fill('1234');await password.evaluate(el=>{el.focus();el.setSelectionRange(1,3)});
  await toggle.click();
  assert.equal(await password.getAttribute('type'),'text');
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  assert.equal(await password.inputValue(),'1234');
  assert.deepEqual(await password.evaluate(el=>[el.selectionStart,el.selectionEnd]),[1,3]);
  await toggle.click();
  assert.equal(await password.getAttribute('type'),'password');
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  assert.equal(await password.inputValue(),'1234');
  assert.deepEqual(await password.evaluate(el=>[el.selectionStart,el.selectionEnd]),[1,3]);
  report.checks.push('password show/hide retains value and selection without submitting');

  const help=page.locator('[data-login-support]');
  const helpId=await help.getAttribute('aria-controls');assert(helpId,'Contact disclosure must identify its panel');
  await help.click();assert.equal(await help.getAttribute('aria-expanded'),'true');
  assert(await page.locator('[id="'+helpId+'"]').isVisible());
  assert(await page.locator('[id="'+helpId+'"]').innerText().then(t=>t.includes('ครู')));
  await help.click();assert.equal(await help.getAttribute('aria-expanded'),'false');
  assert(await page.locator('.loginPage').isVisible());
  report.checks.push('contact help opens locally without changing authentication');

  const submit=page.locator('[data-action="login"]');
  await submit.evaluate(el=>{el.disabled=true});
  assert(await submit.isDisabled());
  assert(await submit.evaluate(el=>parseFloat(getComputedStyle(el).opacity)<1||getComputedStyle(el).cursor==='not-allowed'),'Disabled button has an explicit visual state');
  await submit.evaluate(el=>{el.disabled=false});
  await submit.evaluate(el=>el.setAttribute('aria-busy','true'));
  assert(await page.locator('.loginSubmitBusy').isVisible(),'Loading state is visibly distinct');
  assert(!await page.locator('.loginSubmitReady').isVisible());
  await submit.evaluate(el=>el.removeAttribute('aria-busy'));
  const animated=await page.locator('.loginPage,.loginPage *').evaluateAll(els=>els.flatMap(el=>['','::before','::after'].map(pseudo=>{const s=getComputedStyle(el,pseudo||null);return s.animationName!=='none'&&s.animationDuration.split(',').some(x=>parseFloat(x)>0.01)})).filter(Boolean).length);
  assert.equal(animated,0,'Reduced motion disables decorative animation');
  report.checks.push('disabled and loading button states','prefers-reduced-motion');

  const login=async(user,pass,enter=false)=>{
    await page.getByLabel('รหัสผู้ใช้',{exact:true}).fill(user);
    await page.getByLabel('รหัสผ่าน',{exact:true}).fill(pass);
    if(enter)await password.press('Enter');else await submit.click();
  };
  for(const [user,pass] of [['unknown','1234'],['toString','1234'],['constructor','1234'],['__proto__','1234'],['M20105','wrong'],['M20105',' 1234']]){
    await login(user,pass);assert(await page.locator('.loginPage').isVisible());
    assert.match(await page.locator('#loginMsg').innerText(),/ไม่ถูกต้อง/);
  }
  await login(' M20105 ','1234',true);await page.locator('.heroWorld').waitFor();
  assert.equal(await page.locator('.loginPage').count(),0);
  assert(await page.locator('.profilePill').allTextContents().then(items=>items.some(t=>t.includes('M20105'))));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:resolve(output,'dashboard-after-login.png'),fullPage:true});
  await page.locator('[data-action="logout"]').click();
  assert.equal(await password.getAttribute('type'),'password');
  await login('teacher','1234');await page.locator('.heroWorld').waitFor();
  assert(await page.locator('.profilePill').allTextContents().then(items=>items.some(t=>t.includes('ครูผู้สอน'))));
  await page.locator('[data-action="logout"]').click();
  await login('M20105','1234');await page.locator('.heroWorld').waitFor();
  assert(await page.evaluate(()=>localStorage.getItem(window.__LOGIN_TEST__.key)===window.__LOGIN_TEST__.seed),'All login interactions preserve the existing progress record');
  assert.deepEqual(await page.evaluate(()=>window.__LOGIN_TEST__.writes),[],'The complete interaction sequence must not write storage');
  await page.reload();await page.locator('.loginPage').waitFor();
  report.checks.push('invalid, inherited and wrong-password accounts rejected','student login by Enter and username trimming','teacher login by button','logout resets presentation','original nonpersistent session after reload');
  assert(await page.evaluate(()=>localStorage.getItem(window.__LOGIN_TEST__.key)===window.__LOGIN_TEST__.seed),'Existing student progress remains byte-identical');
  assert.deepEqual(await page.evaluate(()=>window.__LOGIN_TEST__.writes),[],'Login must not write session/password/progress storage');
  report.checks.push('seeded progress preserved','no new storage writes');
  assert.deepEqual(errors,[]);
}finally{
  await browser?.close();server.close();
  await writeFile(resolve(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(report);
}
