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
const responsiveLayouts=[[320,568],[360,640],[375,667],[375,812],[390,844],[430,932],[540,720],[600,800],[568,320],[640,360],[667,375],[844,390],[768,1024],[820,1180],[1024,768],[1180,820],[1280,720],[1366,768],[1536,864],[1880,914],[1920,1080],[2560,1440]];
const controls=['#loginUser','#loginPass','[data-login-password]','[data-action="login"]','[data-login-support]'];
let browser;const errors=[],report={layouts:[],expandedLayouts:[],checks:[],errors};
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
  assert(await page.locator('.loginBrand>img').evaluate(img=>{
    const style=getComputedStyle(img);
    return style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.boxShadow==='none'&&style.filter==='none';
  }),'The transparent original crest must not receive a white rectangle or glow');
  assert.equal(await page.locator('.schoolName').evaluate(el=>getComputedStyle(el).textShadow),'none');
  assert.equal(await page.locator('.loginPage').evaluate(el=>getComputedStyle(el,'::after').display),'none');
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
      return r.width>=44&&r.height>=44&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&hit&&(hit===el||el.contains(hit));
    }),'Control must have a 44px touch target, fit the viewport and receive pointer input: '+selector);
  };
  const initialLayout=async(width,height)=>{
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal scroll at '+width+'x'+height);
    const documentHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
    assert(documentHeight<=height+1,'The entire default login page must fit without vertical scrolling at '+width+'x'+height+'; document height is '+documentHeight);
    const titleBounds=await page.locator('.loginGameTitle>span').evaluateAll(els=>els.flatMap(el=>{
      const range=document.createRange();range.selectNodeContents(el);
      return [...range.getClientRects()].filter(r=>r.width>0).map(r=>({text:el.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight}));
    }));
    assert(titleBounds.length>=2&&titleBounds.every(r=>r.left>=-1&&r.right<=r.viewportWidth+1&&r.top>=-1&&r.bottom<=r.viewportHeight+1),'Title text must not be clipped at '+width+'x'+height+': '+JSON.stringify(titleBounds));
    const completePanel=await page.locator(['.loginPanel','.loginDemo','.loginField label',...controls].join(',')).evaluateAll(els=>els.map(el=>{
      const r=el.getBoundingClientRect(),style=getComputedStyle(el);
      return {element:el.id||el.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,visible:style.display!=='none'&&style.visibility!=='hidden'&&parseFloat(style.opacity)>0};
    }));
    assert(completePanel.every(r=>r.visible&&r.width>0&&r.height>0&&r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=height+1),'The complete login panel, labels, controls, support button and demo notice must fit before scrolling at '+width+'x'+height+': '+JSON.stringify(completePanel));
    const brandingBounds=await page.locator('.schoolName span,.loginSlogan>span,.loginDemo span').evaluateAll(els=>els.flatMap(el=>{
      const style=getComputedStyle(el),box=el.getBoundingClientRect();
      if(!box.width||!box.height||style.visibility==='hidden'||parseFloat(style.opacity)===0)return [];
      const range=document.createRange();range.selectNodeContents(el);
      return [...range.getClientRects()].filter(r=>r.width>0).map(r=>({text:el.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
    }));
    assert(brandingBounds.every(r=>r.left>=-1&&r.right<=width+1&&r.top>=-1&&r.bottom<=height+1),'Visible school identity, slogan and demo text must not be clipped at '+width+'x'+height+': '+JSON.stringify(brandingBounds));
    const decorations=await page.locator('.loginBrand>img,.loginStudent,.loginKnowledgeSign').evaluateAll(els=>els.flatMap(el=>{
      const style=getComputedStyle(el),r=el.getBoundingClientRect();
      if(!r.width||!r.height||style.visibility==='hidden'||parseFloat(style.opacity)===0)return [];
      const box=(rect,name,tolerance=1)=>({name,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,tolerance});
      const bounds=[box(r,el.className||'school crest')];
      if(el.matches('.loginKnowledgeSign')){
        const pseudo=getComputedStyle(el,'::after');
        if(pseudo.content!=='none'&&pseudo.display!=='none'){
          // A hidden absolute probe measures the post under the sign's rotation.
          const probe=document.createElement('span');probe.setAttribute('aria-hidden','true');
          for(const property of ['position','left','right','top','bottom','width','height','box-sizing','margin','border','padding','transform','transform-origin'])probe.style.setProperty(property,pseudo.getPropertyValue(property));
          probe.style.visibility='hidden';probe.style.pointerEvents='none';el.append(probe);
          bounds.push(box(probe.getBoundingClientRect(),'loginKnowledgeSign::after',4));probe.remove();
        }
      }
      return bounds;
    }));
    assert(decorations.every(r=>r.left>=-r.tolerance&&r.right<=width+r.tolerance&&r.top>=-r.tolerance&&r.bottom<=height+r.tolerance),'Visible crest and foreground decorations must fit fully at '+width+'x'+height+': '+JSON.stringify(decorations));
    const panel=completePanel.find(r=>r.element.includes('loginPanel'));
    const decorationOverlaps=decorations.filter(r=>r.name.startsWith('loginStudent')||r.name.startsWith('loginKnowledgeSign')).filter(r=>Math.min(r.right,panel.right)-Math.max(r.left,panel.left)>1&&Math.min(r.bottom,panel.bottom)-Math.max(r.top,panel.top)>1);
    assert.deepEqual(decorationOverlaps,[],'Visible foreground decorations must not overlap the login panel at '+width+'x'+height);
    assert(await page.locator('#loginUser,#loginPass').evaluateAll(els=>els.every(el=>parseFloat(getComputedStyle(el).fontSize)>=16)),'Both input fonts remain at least 16px at '+width+'x'+height);
  };
  for(const [width,height] of responsiveLayouts){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>[...document.querySelectorAll('.loginPage img')].every(img=>img.complete&&img.naturalWidth>0));
    await initialLayout(width,height);
    for(const selector of controls)await hitControl(selector);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:resolve(output,'login-'+width+'x'+height+'.png'),fullPage:true});
    report.layouts.push({width,height,horizontalOverflow:false,verticalOverflow:false,completePageVisible:'verified',controls:'44px targets and accessible',title:'inside viewport',foreground:'visible artwork fits and does not overlap panel'});
  }
  report.checks.push('22 phone, landscape, tablet, laptop and desktop layouts','complete default page, panel and demo notice fit without scrolling at every size','title and branding text bounds, 44px touch targets and 16px input fonts','visible foreground artwork fits without overlapping the panel','real logo and image decode','bundled portable title font','original demo disclosure','no unsupported remember/signup');
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
  for(const [width,height] of [[320,568],[844,390],[768,1024],[1366,768]]){
    await page.setViewportSize({width,height});
    await login('M20105','responsive-wrong');
    assert.match(await page.locator('#loginMsg').innerText(),/ไม่ถูกต้อง/);
    await help.click();assert.equal(await help.getAttribute('aria-expanded'),'true');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Expanded help/error must not cause horizontal scroll at '+width+'x'+height);
    for(const selector of controls)await hitControl(selector);
    for(const selector of ['#loginMsg','#loginSupport']){
      const message=page.locator(selector);await message.scrollIntoViewIfNeeded();
      assert(await message.evaluate(el=>{
        const r=el.getBoundingClientRect(),panel=el.closest('.loginPanel').getBoundingClientRect();
        const range=document.createRange();range.selectNodeContents(el);
        const lines=[...range.getClientRects()].filter(line=>line.width>0);
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return r.width>0&&r.height>0&&r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1&&
          r.left>=panel.left&&r.right<=panel.right&&r.top>=panel.top&&r.bottom<=panel.bottom&&
          lines.every(line=>line.left>=r.left-1&&line.right<=r.right+1&&line.top>=r.top-1&&line.bottom<=r.bottom+1)&&
          hit&&(hit===el||el.contains(hit));
      }),'Expanded text must be reachable and unclipped: '+selector+' at '+width+'x'+height);
    }
    const overlapping=await page.evaluate(selectors=>{
      const boxes=selectors.map(selector=>({selector,rect:document.querySelector(selector).getBoundingClientRect()}));
      return boxes.flatMap((a,i)=>boxes.slice(i+1).filter(b=>Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.left,b.rect.left)>1&&Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.top,b.rect.top)>1).map(b=>[a.selector,b.selector]));
    },[...controls,'#loginMsg','#loginSupport']);
    assert.deepEqual(overlapping,[],'Expanded messages and form controls must not overlap at '+width+'x'+height);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:resolve(output,'login-expanded-'+width+'x'+height+'.png'),fullPage:true});
    report.expandedLayouts.push({width,height,help:'reachable and unclipped',error:'reachable and unclipped',overlap:false});
    await help.click();assert.equal(await help.getAttribute('aria-expanded'),'false');
  }
  await page.setViewportSize({width:390,height:844});
  report.checks.push('expanded help and real login errors remain reachable without overlap on small phone, landscape, tablet and laptop');
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

  // Exercise actual motion too: the main interaction checks above use reduced motion.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>document.activeElement?.blur());
  await page.locator('.loginPanel').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
  const moving='.loginCloud:visible,.loginLeaf:visible,.loginFlask:visible,.loginGlobe:visible,.loginStudent:visible';
  const transforms=()=>page.locator(moving).evaluateAll(els=>els.map(el=>getComputedStyle(el).transform));
  const fixedBoxes=()=>page.locator('.loginBrand>img,.schoolName,#loginForm,[data-action="login"]').evaluateAll(els=>els.map(el=>{
    const {x,y,width,height}=el.getBoundingClientRect();return {x,y,width,height};
  }));
  const initialMotion=await transforms(),initialBoxes=await fixedBoxes();
  await page.waitForTimeout(750);
  const laterMotion=await transforms();
  assert(initialMotion.every((matrix,i)=>matrix!==laterMotion[i]),'Every visible ambient decoration changes transform');
  assert.deepEqual(await fixedBoxes(),initialBoxes,'The school identity and form stay still during ambient motion');
  await page.locator('#loginPass').focus();
  assert(await page.locator(moving).evaluateAll(els=>els.every(el=>getComputedStyle(el).animationPlayState==='paused')));
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const pausedMotion=await transforms();await page.waitForTimeout(350);
  assert.deepEqual(await transforms(),pausedMotion,'Ambient motion pauses while entering the password');
  await page.locator('#loginPass').blur();
  await page.waitForTimeout(350);
  assert.notDeepEqual(await transforms(),pausedMotion,'Ambient motion resumes after leaving the form');
  for(const [width,height] of responsiveLayouts){
    await page.setViewportSize({width,height});
    await initialLayout(width,height);
    for(const selector of controls)await hitControl(selector);
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:resolve(output,'login-motion-390.png'),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.locator(moving).evaluateAll(els=>els.every(el=>getComputedStyle(el).animationName==='none')),'Reduced motion still disables all ambient animation');
  report.checks.push('transparent crest without identity glow','ambient movement with stationary school identity and form','motion pauses on form focus and resumes on blur','22 normal-motion complete-page fit and hit-target checks');
  assert.deepEqual(errors,[]);
}finally{
  await browser?.close();server.close();
  await writeFile(resolve(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(report);
}
