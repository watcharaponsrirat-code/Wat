// Actual Chrome timings, never a claim about simultaneous-user capacity.
// Live mode accepts credentials on stdin and never records request/response bodies.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,sep,dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {harness} from './helpers/google-sheets-harness.mjs';
import {validateRunOptions,parseJourneyOption,performanceActionAllowed,parsePerformanceCredentials,readBackendSnapshots,withTimeout,failureDiagnostic} from './helpers/performance-utils.mjs';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('../tmp/browser-check/playwright/driver/package');}
const arg=(name,fallback)=>{const at=process.argv.indexOf('--'+name);return at<0?fallback:process.argv[at+1];};
const live=process.argv.includes('--live'),samples=Number(arg('samples','3')),journey=parseJourneyOption(process.argv.slice(2));
const manifest=JSON.parse(await readFile(arg('manifest','tmp/performance-v2/manifest.json'),'utf8'));
const variants=arg('variants','before,after').split(','),roles=arg('roles','student,teacher').split(',');
const output=resolve(arg('output','tmp/performance-v2/controlled.json'));
validateRunOptions({samples,variants,roles,journey});
// Load and verify once, before any browser/network activity. The in-memory
// sources cannot change midway through a comparison when the workspace edits.
const backendSources=await readBackendSnapshots(manifest,variants);
await mkdir(dirname(output),{recursive:true});
let credentials;
if(live){let input='';for await(const part of process.stdin)input+=part;credentials=parsePerformanceCredentials(input);input='';}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const staticCache=new Map();
const server=createServer(async(req,res)=>{try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),match=path.match(/^\/(before|after)\/(.*)$/);
  if(req.method!=='GET'||!match||!variants.includes(match[1]))throw Error();
  const file=resolve(manifest[match[1]],match[2]||'index.html');if(!file.startsWith(resolve(manifest[match[1]])+sep))throw Error();
  if(!staticCache.has(file)){const body=await readFile(file),type=mime[extname(file)]||'application/octet-stream';staticCache.set(file,{body:/^(text\/|image\/svg)/.test(type)?gzipSync(body):body,type,gzip:/^(text\/|image\/svg)/.test(type)});}
  const data=staticCache.get(file);res.setHeader('Content-Type',data.type);res.setHeader('Cache-Control','public, max-age=3600');if(data.gzip)res.setHeader('Content-Encoding','gzip');res.end(data.body);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const report={createdAt:new Date().toISOString(),mode:live?'local website + live Apps Script':'local website + synthetic in-memory Apps Script; NOT live API timing',backendPhase:arg('phase',live?'before-user-update':'controlled'),baselineCommit:manifest.baselineCommit,beforeBackendSHA256:manifest.beforeBackendSHA256,afterBackendSHA256:manifest.afterBackendSHA256,liveBackendVerified:live?false:undefined,conditions:{viewport:'1366x900',chrome:'installed channel chrome, headless',motion:'normal',network:'loopback HTTP, gzip, no network/CPU throttling; live API uses current internet connection',cache:'new isolated browser context per sample; HTTP cache disabled by request safety interception; repeat steps reuse in-memory modules',progress:'fresh localStorage per sample; no imported learner progress',display:'actual click capture to second requestAnimationFrame after target DOM is visible; paint opportunity proxy, not a screenshot paint timestamp',data:'required data/controls available; Simulation renderer has painted first frame',ready:'data ready plus decoded current viewport/non-lazy images, fonts and painted CSS backgrounds; offscreen lazy image count reported separately',sampleOrder:'alternate selected variant order each round; roles in '+roles.join(', ')+' order',backend:live?'Remote Apps Script deployment version is not verified by local snapshot hashes':'SHA-256-verified frozen backend sources loaded before the run',longTasks:'Long tasks overlapping the measurement interval; durations clipped to that interval'},runs:[],blockedWrites:0,cleanupFailures:0,failures:[]};

report.journey=journey;
report.conditions.journey=journey;

function instrumentation(){
  const now=()=>performance.now(),round=n=>Math.round(n*10)/10;
  const state=window.__navPerf={api:[],longTasks:[],spans:[],storage:[],tokens:new Set(),steps:[]};
  new PerformanceObserver(list=>{for(const e of list.getEntries())state.longTasks.push({start:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});
  const fetchOriginal=window.fetch.bind(window);
  window.fetch=async(...args)=>{
    let action;try{action=JSON.parse(args[1]?.body||'{}').action;}catch{}
    if(!action)return fetchOriginal(...args);
    const entry={action,start:now()};state.api.push(entry);
    try{const response=await fetchOriginal(...args);entry.headersAt=now();const json=response.json.bind(response);response.json=async()=>{try{const value=await json();entry.completeAt=now();entry.ok=value?.ok===true;if(action==='login'){entry.staffBootstrap=!!value?.data?.staff;if(value?.data?.token)state.tokens.add(value.data.token);}return value;}catch(error){entry.completeAt=now();entry.ok=false;throw error;}};return response;}
    catch(error){entry.completeAt=now();entry.ok=false;throw error;}
  };
  const get=Storage.prototype.getItem;
  Storage.prototype.getItem=function(...args){const start=now();try{return get.apply(this,args);}finally{state.storage.push({start,ms:now()-start});}};
  const frame=()=>new Promise(r=>requestAnimationFrame(r));
  const visible=el=>!!el&&el.getBoundingClientRect().width>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
  const viewport=el=>{const r=el.getBoundingClientRect();return visible(el)&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;};
  const dataReady=kind=>kind==='teacher'?!!document.querySelector('[data-student-open]')||document.querySelector('[data-teacher-message]')?.textContent.includes('ยังไม่มีห้องที่ได้รับมอบหมาย'):kind==='simulation'?!!document.querySelector('[data-sim-viewport][data-camera-distance] canvas'):kind==='results'?!!document.querySelector('[data-exam-last]'):true;
  async function assets(){
    const app=document.getElementById('app'),images=[...app.querySelectorAll('img')].filter(el=>visible(el)&&(el.loading!=='lazy'||viewport(el)));
    const backgrounds=new Set();
    for(const el of [document.body,app,...app.querySelectorAll('*')])if(viewport(el))for(const pseudo of [null,'::before','::after']){
      const bg=getComputedStyle(el,pseudo).backgroundImage;
      for(const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g))backgrounds.add(m[1]);
    }
    await Promise.all([document.fonts.ready,...images.map(el=>el.decode()),...[...backgrounds].map(src=>{const image=new Image();image.src=src;return image.decode();})]);
    return {images:images.length,backgrounds:backgrounds.size,lazyPending:[...app.querySelectorAll('img[loading="lazy"]')].filter(el=>!el.complete||!el.naturalWidth).length};
  }
  async function measureBody(spec,start){
    const deadline=start+90000;
    while(!visible(document.querySelector(spec.selector))){if(spec.name==='login'&&document.querySelector('#loginMsg')?.textContent.trim())throw Error('login rejected or unreachable');if(now()>deadline)throw Error('target timeout');await frame();}
    const domAt=now();await frame();await frame();const displayedAt=now();
    while(!dataReady(spec.kind)){if(now()>deadline)throw Error('data timeout');await frame();}
    const dataAt=now(),assetCounts=await assets();await frame();await frame();const readyAt=now();
    const api=state.api.filter(e=>e.start>=start&&e.start<=readyAt).map(e=>({action:e.action,startMs:round(e.start-start),headersMs:round(e.headersAt-e.start),completeMs:round(e.completeAt-e.start),ok:e.ok,staffBootstrap:e.staffBootstrap}));
    const resources=performance.getEntriesByType('resource').filter(e=>e.startTime>=start&&e.startTime<=readyAt&&new URL(e.name).origin===location.origin).map(e=>({path:new URL(e.name).pathname.replace(/^\/(before|after)\//,''),kind:e.initiatorType,startMs:round(e.startTime-start),ms:round(e.duration),finishMs:round(e.responseEnd-start),bytes:e.decodedBodySize}));
    const tasks=state.longTasks.filter(e=>e.start<readyAt&&e.start+e.ms>start).map(e=>({...e,ms:Math.min(e.start+e.ms,readyAt)-Math.max(e.start,start)}));
    const reads=state.storage.filter(e=>e.start>=start&&e.start<=readyAt);
    return {name:spec.name,start:round(start),domMs:round(domAt-start),displayMs:round(displayedAt-start),dataMs:round(dataAt-start),readyMs:round(readyAt-start),...assetCounts,api,resources,longTaskMs:round(tasks.reduce((sum,e)=>sum+e.ms,0)),longestTaskMs:round(Math.max(0,...tasks.map(e=>e.ms))),storageReads:reads.length,storageMs:round(reads.reduce((sum,e)=>sum+e.ms,0)),spans:state.spans.filter(e=>e.start>=start&&e.start<=readyAt).map(e=>({name:e.name,ms:round(e.ms)}))};
  }
  async function measure(spec,start){
    let timer;
    try{return await Promise.race([measureBody(spec,start),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('measurement or asset decode timeout')),Math.max(0,90000-(now()-start)))})]);}
    finally{clearTimeout(timer);}
  }
  document.addEventListener('click',()=>{if(!state.armed)return;const spec=state.armed;state.armed=null;state.pending=measure(spec,now());state.pending.catch(()=>{});},true);
  state.initial=measure({name:'initial_login_page',selector:'#loginUser'},0);
  state.initial.catch(()=>{});
  state.arm=spec=>{state.pending=null;state.armed=spec;};
  state.wrap=()=>{for(const [name,methods] of [['SLH_DASHBOARD',['render','attach']],['SLH_GAMES',['render','bind']],['SLH_SIM_ENGINE',['render','bind']],['SLH_TEACHER',['mount']]])for(const method of methods){const object=window[name],original=object?.[method];if(typeof original!=='function')continue;object[method]=function(...args){const start=now();try{return original.apply(this,args);}finally{state.spans.push({name:name+'.'+method,start,ms:now()-start});}};}};
}

let browser;
async function run(variant,role,sample){
  const backend=live?null:harness({appScriptSource:backendSources.get(variant)});
  const credential=live?(role==='teacher'?credentials.teacher:credentials.students[0]):{username:role==='teacher'?'watcharapon':'fixture0001',password:role==='teacher'?backend.staffPassword:backend.password};
  const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'no-preference'}),page=await context.newPage();
  page.setDefaultTimeout(95000);const result={variant,role,sample,steps:[],pageErrors:0,blockedWrites:0,networkFailures:[]};let current='initial_login_page';
  page.on('pageerror',()=>{result.pageErrors++;});
  page.on('requestfailed',request=>{result.networkFailures.push({host:new URL(request.url()).hostname,error:request.failure()?.errorText});});
  if(!live)await context.route('**/assets/integrations/sheets-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.SLH_SHEETS_CONFIG={endpoint:"https://script.google.com/macros/s/SYNTHETIC_PERFORMANCE_ONLY/exec"};'}));
  await context.route('https://script.google.com/**',async route=>{
    let body;try{body=route.request().postDataJSON();}catch{}
    if(!performanceActionAllowed(body?.action,journey)){result.blockedWrites++;return route.abort();}
    if(live)return route.continue();
    const response=backend.call(body.action,body.payload,body.token);await route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
  });
  if(!live)await context.route('https://script.googleusercontent.com/**',r=>r.abort());
  await page.addInitScript(instrumentation);
  const step=async(name,click,selector,kind)=>{
    current=name;const locator=page.locator(click).first();await locator.scrollIntoViewIfNeeded();
    await page.evaluate(spec=>window.__navPerf.arm(spec),{name,selector,kind});await locator.click();
    const data=await withTimeout(page.evaluate(()=>window.__navPerf.pending),95000,name);assert(data,name+' did not capture a click');result.steps.push(data);
    console.log(JSON.stringify({variant,role,sample,step:name,displayMs:data.displayMs,readyMs:data.readyMs}));
  };
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/${variant}/`,{waitUntil:'domcontentloaded'});
    result.steps.push(await withTimeout(page.evaluate(()=>window.__navPerf.initial),95000,'initial page'));await page.evaluate(()=>window.__navPerf.wrap());
    await page.locator('#loginUser').fill(credential.username);await page.locator('#loginPass').fill(credential.password);
    await step('login','[data-action="login"]','.dashboardPage',role==='teacher'?'teacher':undefined);
    if(role==='student'&&journey==='full'){
      await step('choose_grade','[data-dashboard-grades]','.gradeSelectionPage');
      await step('home','[data-nav="home"]','.dashboardPage');
      await step('choose_grade_repeat','[data-dashboard-grades]','.gradeSelectionPage');
      await step('choose_unit','[data-grade="1"]','.unitSelectionPage');
      await step('choose_lesson','[data-unit="0"]','.lessonSelectionPage');
      await step('content','[data-lesson="G1U1L1"]','.readingPage');
      await step('game','[data-stage="g1"]','.stageDot.active[data-stage="g1"]');
      await step('simulation','[data-stage="lab"]','.simPanel','simulation');
      await step('game_repeat','[data-stage="g1"]','.stageDot.active[data-stage="g1"]');
      await step('content_repeat','[data-stage="content"]','.readingPage');
      await step('simulation_repeat','[data-stage="lab"]','.simPanel','simulation');
      await step('home_repeat','[data-action="home"]','.dashboardPage');
    }else if(role==='teacher'){
      await step('teacher_refresh','[data-teacher-refresh]','[data-teacher-panel]','teacher');
      if(journey==='full')await step('teacher_student_results','[data-student-open]','[data-student-results]','results');
    }
    assert.equal(result.pageErrors,0,'Page script errors occurred');assert.equal(result.blockedWrites,0,'Unexpected API write blocked');assert.equal(result.networkFailures.length,0,'Network requests failed');result.passed=true;
  }catch(error){const diagnostic=failureDiagnostic(error,[credential],live);result.passed=false;result.failure={step:current,type:error.name,diagnostic};report.failures.push({variant,role,sample,...result.failure});console.log(JSON.stringify({variant,role,sample,failedAt:current,...result.failure}));}
  finally{
    try{const failures=await withTimeout(page.evaluate(async()=>{let failures=0;for(const token of window.__navPerf?.tokens||[])try{const response=await fetch(window.SLH_SHEETS_CONFIG.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'logout',token,payload:{}}),signal:AbortSignal.timeout(30000)});if(!(await response.json()).ok)failures++;}catch{failures++;}return failures;}),35000,'session cleanup');report.cleanupFailures+=failures;}catch{report.cleanupFailures++;}
    report.blockedWrites+=result.blockedWrites;report.runs.push(result);await context.close();
    await writeFile(output,JSON.stringify(report,null,2)+'\n');
  }
}
try{browser=await pw.chromium.launch({channel:'chrome',headless:true});report.browserVersion=browser.version();runs:for(let sample=1;sample<=samples;sample++)for(const variant of sample%2?variants:[...variants].reverse())for(const role of roles){await run(variant,role,sample);if(report.failures.length)break runs;}}
catch(error){report.failures.push({step:'runner',type:error.name,diagnostic:failureDiagnostic(error,[],live)});process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(r=>server.close(r));report.passed=!report.failures.length&&!report.cleanupFailures&&!report.blockedWrites&&report.runs.length===samples*variants.length*roles.length&&report.runs.every(r=>r.passed);await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:output,passed:report.passed,runs:report.runs.length,failures:report.failures,cleanupFailures:report.cleanupFailures}));}
if(!report.passed)process.exitCode=1;
