// Final cross-engine layout check, including the calm final-exam presentation.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require('../tmp/browser-check/playwright/driver/package');
const output=new URL('../tmp/voxel-audit/',import.meta.url);await mkdir(output,{recursive:true});
const report={engines:[],layouts:0,findings:[]};
const sizes=[[375,812],[390,844],[393,852],[430,932],[768,1024],[1366,1000]];
for(const [name,type] of [['Chrome',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true,...(name==='Chrome'?{channel:'chrome'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>report.findings.push(name+': '+e.message));
  await page.goto(new URL('../index.html',import.meta.url).href);
  await page.locator('[data-action=login]').click();
  for(const [width,height] of sizes){
   await page.setViewportSize({width,height});
   const check=async label=>{
    const issues=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('button')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+3).map(e=>e.textContent.trim()),logo:document.querySelector('.brandLogo')?.getBoundingClientRect().width>0}));
    if(issues.overflow||issues.clipped.length||!issues.logo)report.findings.push({engine:name,width,label,...issues});report.layouts++;
   };
   await page.evaluate(()=>window.__SLH_QA__.login());await check('dashboard');
   if(width===393||width===1366)await page.screenshot({path:new URL(name+'-home-'+width+'.png',output).pathname.replace(/^\/(\w:)/,'$1')});
   for(const id of ['G1U1L1','G2U3L1','G3U6L1'])for(const stage of ['content','lab','g1','g2','g3','e1','e2','e3','exam','result']){
    await page.evaluate(({id,stage})=>window.__SLH_QA__.open(id,stage),{id,stage});await check(id+'/'+stage);
    if(id==='G2U3L1'&&stage==='exam'&&width===393){
     await page.screenshot({path:new URL(name+'-exam-393.png',output).pathname.replace(/^\/(\w:)/,'$1')});
     await page.locator('.examGuidance summary').click();
     if(!await page.locator('.examGuidance .callout').isVisible())report.findings.push(name+' hidden exam guidance');
     await page.locator('[data-exam-choice]').first().click();
     if(await page.locator('[data-exam-choice][aria-pressed=true]').count()!==1)report.findings.push(name+' answer not selected');
     await page.locator('[data-exam-next]').click();await page.locator('[data-exam-prev]').click();
    }
   }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>window.__SLH_QA__.login());
  if(await page.locator('.heroWorld').evaluate(e=>getComputedStyle(e).animationName)!=='none')report.findings.push(name+' reduced motion');
  report.engines.push({name,layouts:6*31,reducedMotion:'passed'});
 }finally{await browser.close()}
}
await writeFile(new URL('cross-browser.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(report.findings.length)process.exitCode=1;
