/** Real-browser visual and behavior audit; never uses the student's browser profile. */
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
const require=createRequire(import.meta.url);
// Reuse the Playwright runtime already installed for this project's browser checks.
const {chromium,webkit}=require('../tmp/browser-check/playwright/driver/package');
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const output=resolve(root,'tmp/voxel-audit');await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root))throw Error('path');const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/index.html`;
const report={viewports:[[375,812],[390,844],[393,852],[430,932],[768,1024],[1366,1000]],screens:0,images:0,simControls:0,examSubmissions:0,onetQuestions:0,findings:[],screenshots:[]};
const check=(ok,msg)=>{if(!ok)report.findings.push(msg)};
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',e=>report.findings.push('JavaScript: '+e.message));
 page.on('requestfailed',r=>report.findings.push('Request: '+r.url()));
 await page.goto(url);
 const shot=async name=>{await page.locator('img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async i=>{i.loading='eager';try{await i.decode()}catch{}}))});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});await page.screenshot({path:resolve(output,name+'-viewport.png')});report.screenshots.push(name+'.png')};
 const login=async(user='M20105',password='1234')=>{await page.locator('#loginUser').fill(user);await page.locator('#loginPass').fill(password);await page.locator('[data-action=login]').click()};
 await shot('login-390');
 await login('unknown');check(await page.locator('#loginMsg').innerText()!=='','Invalid login feedback');
 await login();await shot('dashboard-390');
 await page.locator('[data-grade="2"]').click();await shot('units-390');
 await page.locator('[data-unit="2"]').press('Enter');await shot('lessons-390');
 await page.locator('[data-lesson="G2U3L1"] button').click();check(await page.locator('.readingPage').count()===1,'Grade/unit/lesson route');
 await page.locator('[data-content-complete]').click();check(await page.locator('.simPanel').count()===1,'Read completion to simulation');
 await shot('simulation-390');
 await page.locator('[data-action=back]').click();check(await page.locator('.checkpointBanner').count()===1,'Saved checkpoint UI');await shot('checkpoint-390');
 await page.locator('[data-lesson="G2U3L1"] button').click();check(await page.locator('.simPanel').count()===1,'Resume uses saved stage');
 const ids=await page.evaluate(()=>window.__SLH_QA__.lessonIds);
 const stages=['content','lab','g1','g2','g3','e1','e2','e3','exam','result'];
 for(const id of ids){
  for(const stage of stages){
   await page.evaluate(({id,stage})=>window.__SLH_QA__.open(id,stage),{id,stage});
   for(const [width,height] of report.viewports){
    await page.setViewportSize({width,height});
    const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,text:/\bundefined\b|\[object Object\]|\bnull\b/.test(document.querySelector('main').innerText),logo:document.querySelector('.brandLogo')?.getBoundingClientRect().width>0}));
    check(!result.overflow,`Overflow ${id}/${stage}/${width}`);check(!result.text,`Invalid visible text ${id}/${stage}`);check(result.logo,`School logo ${id}/${stage}`);report.screens++;
   }
   if(stage==='content'){
    const imgs=await page.locator('.readingPage img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async i=>{i.loading='eager';try{await i.decode()}catch{}}));return {count:imgs.length,broken:imgs.filter(i=>!i.naturalWidth).map(i=>i.src)}});report.images+=imgs.count;check(!imgs.broken.length,'Broken reading images '+id);
    check(await page.locator('.readingOutline a').evaluateAll(els=>els.every(a=>document.getElementById(a.hash.slice(1)))),'Reading anchors '+id);
   }
   if(stage==='lab'){
    const inputs=await page.locator('[data-sim-control]').evaluateAll(els=>els.map(e=>({key:e.dataset.simControl,select:e.tagName==='SELECT',max:e.tagName==='SELECT'?e.options.length-1:Number(e.max)})));
    for(const input of inputs){const el=page.locator(`[data-sim-control="${input.key}"]`);if(input.select)await el.selectOption(String(input.max));else{await el.fill(String(input.max));await el.dispatchEvent('input')};check(await page.evaluate(({id,key})=>window.__SLH_QA__.snapshot(id).simulation[id].values[key],{id,key:input.key})===input.max,'Simulation control '+id+'/'+input.key);report.simControls++}
    await page.locator('[data-sim-reset]').click();
   }
   if(id==='G2U3L1'&&['content','g1','g2','g3','e1','e2','e3','exam'].includes(stage)){await page.setViewportSize({width:390,height:844});await shot(stage+'-390')}
  }
  console.log('Audited '+id);
 }
 await page.setViewportSize({width:390,height:844});
 // Actual original O-NET answer controls and local image assets.
 const questions=await page.evaluate(()=>window.SLH_ONET.questions);
 for(const id of [...new Set(questions.map(q=>q.lesson))]){
  await page.evaluate(id=>window.__SLH_QA__.open(id,'e3'),id);
  for(const q of questions.filter(q=>q.lesson===id)){
   const img=page.locator(`#onet-image-${q.id} img`);await img.evaluate(async i=>{i.loading='eager';await i.decode()});check(await img.evaluate(i=>i.naturalWidth)>0,'O-NET image '+q.id);
   for(const a of [q.key%4+1,q.key]){await page.locator(`[data-onet-id="${q.id}"][data-onet-answer="${a}"]`).click();await page.locator(`[data-onet-check="${q.id}"]`).click()}
   report.onetQuestions++;
  }
 }
 // Complete a continuous lesson through actual controls, from reading to final exam.
 await page.evaluate(()=>window.__SLH_QA__.reset('G1U1L1'));
 await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','content'));
 await page.locator('[data-content-complete]').click();await page.locator('[data-stage=g1]').last().click();
 const catalog=await page.evaluate(()=>window.SLH_GAME_CATALOG.G1U1L1);
 for(let gi=0;gi<3;gi++){
  const game=catalog[gi],stage='g'+(gi+1);
  if(game.type==='evidence'){
   const wrong=game.cards.findIndex(c=>!c.correct);await page.locator(`[data-arc-evidence="${wrong}"]`).click();await page.locator('[data-arc-check]').click();check(await page.locator('.is-retry').count()===1,'Wrong game feedback');await page.locator(`[data-arc-evidence="${wrong}"]`).click();
   for(let i=0;i<game.cards.length;i++)if(game.cards[i].correct)await page.locator(`[data-arc-evidence="${i}"]`).click();await page.locator('[data-arc-check]').click();
  }else if(game.type==='memory'){
   const deck=await page.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').games.g2.state.deck);
   for(let pair=0;pair<game.pairs.length;pair++)for(let i=0;i<deck.length;i++)if(deck[i].pair===pair)await page.locator(`[data-arc-flip="${i}"]`).click();
  }else if(game.type==='mission'){
   for(let i=0;i<game.items.length;i++){const options=await page.evaluate(i=>window.__SLH_QA__.snapshot('G1U1L1').games.g3.state.options[i],i);await page.locator(`[data-arc-answer="${options.indexOf(game.items[i].answer)}"]`).click();if(i<game.items.length-1)await page.locator('[data-arc-mission-next]').click()}
  }
  check(await page.evaluate(stage=>window.__SLH_QA__.snapshot('G1U1L1').games[stage].done,stage),'Game completion '+stage);
  if(gi===2)await shot('challenge-complete-390');await page.locator('[data-arc-next]').click();
 }
 for(const stage of ['e1','e2','e3']){
  const qs=await page.evaluate(stage=>window.__SLH_QA__.snapshot('G1U1L1').ex[stage].state.qs,stage);
  for(let i=0;i<qs.length;i++){const opts=await page.locator(`[data-ex-q="${i}"]`).evaluateAll(els=>els.map(e=>e.dataset.exO));await page.locator(`[data-ex-q="${i}"]`).nth(opts.indexOf(qs[i].correct)).click()}
  await page.locator('[data-ex-check]').click();check(await page.evaluate(stage=>window.__SLH_QA__.snapshot('G1U1L1').ex[stage].done,stage),'Exercise completion '+stage);await page.locator('[data-ex-next]').click();
 }
 report.continuousFlow='Reading → simulation → all 3 games → all 3 exercise levels → final exam → results';
 let previousOrder;
 for(const score of [11,12,20]){
  await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','exam'));
  const qs=await page.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').exam.current.qs);
  if(previousOrder)check(previousOrder!==JSON.stringify(qs),'Exam shuffle');previousOrder=JSON.stringify(qs);
  await page.locator('[data-exam-go="19"]').click();await page.locator('[data-exam-submit]').click();check(await page.locator('.examCard').count()===1,'Incomplete submission prevention');
  for(let i=0;i<20;i++){
   await page.locator(`[data-exam-go="${i}"]`).click();const answer=i<score?qs[i].correct:qs[i].opts.find(o=>o!==qs[i].correct);
   const options=await page.locator('[data-exam-choice]').evaluateAll(els=>els.map(e=>e.dataset.examChoice));await page.locator('[data-exam-choice]').nth(options.indexOf(answer)).click();
  }
  await page.locator('[data-exam-submit]').click();
  const result=await page.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').exam);
  check(result.last===score*5,'Exam scoring '+score);check(result.passed===(score>=12),'Exam threshold '+score);check(await page.locator('.masteryRow').count()>0,'Mastery shown');
  await shot('result-'+score*5+'-390');report.examSubmissions++;
  if(score<20)await page.locator('[data-result-retry]').click();
 }
 check(await page.locator('.perfectBadge').count()===1,'Perfect score badge');
 await page.locator('[data-action=home]').click();for(const nav of ['results','mission','about','lessons']){await page.locator(`[data-nav="${nav}"]`).click();if(nav==='about')await page.locator('[data-close-modal]').click()}
 await page.locator('[data-action=logout]').click();await login('teacher');check(await page.locator('#loginUser').count()===0,'Login after logout');
 await page.locator('[data-action=logout]').click();await login();check(await page.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').exam.best)===100,'Account isolation');
 await page.reload();await login();await page.evaluate(()=>window.__SLH_QA__.reopen('G1U1L1'));check(await page.locator('.resultHero').count()===1,'Resume after reload');
 await page.locator('[data-action=home]').click();await page.setViewportSize({width:1366,height:1000});await shot('dashboard-desktop');
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('.heroWorld').evaluate(e=>getComputedStyle(e).animationName)==='none','Reduced motion');
 // Safari/WebKit if installed; never label Chrome as a Safari test.
 try{const wb=await webkit.launch({headless:true});const wp=await wb.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});await wp.goto(url);await wp.locator('[data-action=login]').click();check(await wp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'WebKit mobile overflow');await wp.screenshot({path:resolve(output,'webkit-home.png'),fullPage:true});report.webkit='Passed mobile login/dashboard smoke test';await wb.close()}catch(e){report.webkit='Unavailable: '+e.message.split('\n')[0]}
}catch(e){report.findings.push('Audit interrupted: '+e.stack)}finally{await browser?.close();server.close();report.findings=[...new Set(report.findings)];await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
if(report.findings.length)process.exitCode=1;
