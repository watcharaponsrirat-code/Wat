// Local diagnostic only: instruments served responses, never production files.
// Every non-loopback request is blocked and offline credentials are synthetic.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,open} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {useOfflineSheets} from './offline-sheets-fixture.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const arg=(name,fallback)=>{const at=process.argv.indexOf('--'+name);return at<0?fallback:process.argv[at+1];};
const output=resolve(root,arg('output','tmp/performance-v2/simulation-startup-profile.json'));
assert(output.startsWith(resolve(root,'tmp')+sep),'Diagnostic output must remain under tmp');
const samples=Number(arg('samples','3'));
assert(Number.isInteger(samples)&&samples>0&&samples<=10);
const manifestPath=arg('manifest',null);
const manifest=manifestPath?JSON.parse(await readFile(resolve(root,manifestPath),'utf8')):null;
const variants=manifest?['before','after']:['workspace'];
const sourceRoots=Object.fromEntries(variants.map(variant=>{
  assert(!manifest||typeof manifest[variant]==='string',`Missing ${variant} frontend snapshot`);
  const sourceRoot=resolve(manifest?manifest[variant]:root);
  assert(sourceRoot===root||sourceRoot.startsWith(root+sep),'Frontend snapshots must remain in the workspace');
  return [variant,sourceRoot];
}));
const prefix=`const __profile=(name,run)=>{const start=performance.now();try{return run()}finally{window.__simStartupProfile.spans.push({name,start,ms:performance.now()-start})}};\n`;
const transforms={
  'assets/simulations/scene3d.js':[
    ['const build=models3d[spec.id];','const __mountStart=performance.now();const build=models3d[spec.id];'],
    ["new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'default'})","__profile('renderer.create',()=>new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'default'}))"],
    ['new THREE.PMREMGenerator(renderer)',"__profile('pmrem.generator',()=>new THREE.PMREMGenerator(renderer))"],
    ['new RoomEnvironment()',"__profile('pmrem.room',()=>new RoomEnvironment())"],
    ['pmrem.fromScene(room,.04)',"__profile('pmrem.fromScene',()=>pmrem.fromScene(room,.04))"],
    ['new ModelKit(group)',"__profile('ModelKit.create',()=>new ModelKit(group))"],
    ['createPlantGrowthStudio({host,scene,kit,renderer,key,rim,platform,edge})',"__profile('plantStudio.create',()=>createPlantGrowthStudio({host,scene,kit,renderer,key,rim,platform,edge}))"],
    ['renderer.render(scene,camera);',"__profile('renderer.render',()=>renderer.render(scene,camera));"],
    ["update(initialValues);resize();resetCamera(true);paint()","__profile('initial.update',()=>update(initialValues));__profile('initial.resize',()=>resize());__profile('initial.resetCamera',()=>resetCamera(true));__profile('initial.paint',()=>paint())"],
    ['return{update,dispose};',"window.__simStartupProfile.spans.push({name:'mountScene.total',start:__mountStart,ms:performance.now()-__mountStart});return{update,dispose};"]
  ],
  'assets/simulations/plant-growth-studio.js':[
    ['createPlantGrowthModel(scene,{quality})',"__profile('plantModel.create',()=>createPlantGrowthModel(scene,{quality}))"]
  ],
  'assets/simulations/plant-growth-model.js':[
    ['createLeafSurfaceMaps()',"__profile('leafSurfaceMaps.create',()=>createLeafSurfaceMaps())"],
    ["texture('pot')","__profile('potTexture.create',()=>texture('pot'))"],
    ["texture('soil')","__profile('soilTexture.create',()=>texture('soil'))"],
    ['createBeanLeafMaster(keepGeometry)',"__profile('leafBotany.create',()=>createBeanLeafMaster(keepGeometry))"]
  ],
  'assets/simulations/plant-growth-botany.js':[
    ['withShapes(v=>blade(56,20,v))',"__profile('leafBotany.highBlade',()=>withShapes(v=>blade(56,20,v)))"],
    ['withShapes(v=>blade(32,12,v))',"__profile('leafBotany.lowBlade',()=>withShapes(v=>blade(32,12,v)))"],
    ['withShapes(v=>midrib(48,6,v))',"__profile('leafBotany.highRib',()=>withShapes(v=>midrib(48,6,v)))"],
    ['withShapes(v=>midrib(28,5,v))',"__profile('leafBotany.lowRib',()=>withShapes(v=>midrib(28,5,v)))"]
  ]
};
const sources=new Map();
const sourceHashes={};
const originalSources=new Map();
async function readSource(variant,path){
  const key=variant+'/'+path;
  if(originalSources.has(key))return originalSources.get(key);
  const file=resolve(sourceRoots[variant],path);
  assert(file.startsWith(sourceRoots[variant]+sep),'Resource must remain in its frontend snapshot');
  const bytes=await readFile(file),hash=createHash('sha256').update(bytes).digest('hex');
  if(manifest?.frontendHashes)assert.equal(hash,manifest.frontendHashes[variant]?.[path],`${key}: frontend snapshot changed`);
  sourceHashes[variant][path]=hash;originalSources.set(key,bytes);return bytes;
}
for(const variant of variants){
  sourceHashes[variant]={};
  for(const path of ['index.html',...Object.keys(transforms),'assets/simulations/plant-growth-leaf-surface.js']){
    const bytes=await readSource(variant,path);
    if(!transforms[path])continue;
    let source=bytes.toString('utf8');
    for(const [from,to] of transforms[path]){assert.equal(source.split(from).length-1,1,`${variant}/${path}: unambiguous ${from}`);source=source.replace(from,to);}
    sources.set(variant+'/'+path,prefix+source);
  }
}
if(process.argv.includes('--check')){
  console.log(JSON.stringify({checked:true,instrumentedFiles:[...sources.keys()],sourceHashes,productionFilesChanged:false}));
}else{
  const require=createRequire(import.meta.url);
  let pw;try{pw=require('playwright')}catch{pw=require('../tmp/browser-check/playwright/driver/package')}
  await mkdir(dirname(output),{recursive:true});
  // Reserve a new report; an accidental rerun must not erase prior evidence.
  const reportFile=await open(output,'wx');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
  const server=createServer(async(req,res)=>{try{
    if(req.url==='/favicon.ico'){res.writeHead(204);return res.end()}
    const match=decodeURIComponent(new URL(req.url,'http://localhost').pathname).match(/^\/([^/]+)\/(.*)$/);
    assert(match&&variants.includes(match[1]));
    const variant=match[1],path=match[2]||'index.html',sourceRoot=sourceRoots[variant];
    if(path==='favicon.ico'){res.writeHead(204);return res.end()}
    assert(req.method==='GET'&&(path==='index.html'||path.startsWith('assets/')||/^inline-[a-f0-9]+\.(css|js)$/.test(path)));
    const file=resolve(sourceRoot,path);assert(file.startsWith(sourceRoot+sep));
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(sources.get(variant+'/'+path)||await readSource(variant,path));
  }catch{res.writeHead(404);res.end()}});
  const report={createdAt:new Date().toISOString(),mode:'local instrumented responses, offline synthetic account, no live API',sourceRoots,sourceHashes,conditions:{viewport:'1366x900',browser:'installed Chrome, headless',motion:'normal',network:'loopback, no CPU/network throttling',cache:'same browser process, fresh context per sample/variant; request interception disables HTTP cache; repeat mounts reuse modules',sampleOrder:'alternate variant order each round',timing:'synchronous performance.now spans; nested spans overlap and must not be summed',limitation:'diagnostic attribution only; shader/compiler caches can survive isolated contexts'},runs:[],errors:[],blockedExternal:0};
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    browser=await pw.chromium.launch({channel:'chrome',headless:true});report.browserVersion=browser.version();
    for(let sample=1;sample<=samples;sample++){
     for(const variant of sample%2?variants:[...variants].reverse()){
      const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'no-preference'});
      try{
      await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'||url.protocol==='data:')return route.continue();report.blockedExternal++;return route.abort()});
      await useOfflineSheets(context);
      const page=await context.newPage();page.setDefaultTimeout(60000);
      page.on('pageerror',error=>report.errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error'||/WebGL.*(?:INVALID|shader|program)|THREE\.WebGLProgram/i.test(message.text()))report.errors.push(message.text())});
      page.on('requestfailed',request=>report.errors.push('Request failed: '+request.url()));
      page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push(`HTTP ${response.status()} ${response.url()}`)});
      await page.addInitScript(()=>{window.__simStartupProfile={spans:[],longTasks:[]};new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__simStartupProfile.longTasks.push({start:entry.startTime,ms:entry.duration})}).observe({type:'longtask',buffered:true})});
      await page.goto(`http://127.0.0.1:${server.address().port}/${variant}/`,{waitUntil:'load'});
      for(const visit of ['first','repeat']){
        if(visit==='repeat')await page.evaluate(()=>window.__SLH_QA__.open('G1U1L1','content'));
        await page.evaluate(()=>{window.__simStartupProfile.spans=[];window.__simStartupProfile.longTasks=[];window.__simStartupProfile.start=performance.now();window.__SLH_QA__.open('G1U1L1','lab')});
        await page.waitForFunction(()=>document.querySelector('[data-sim-viewport][data-camera-distance] canvas')&&window.__simStartupProfile.spans.some(s=>s.name==='mountScene.total'));
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const data=await page.evaluate(()=>{const state=window.__simStartupProfile,start=state.start,round=n=>Math.round(n*10)/10;return {readyMs:round(performance.now()-start),spans:state.spans.map(s=>({name:s.name,startMs:round(s.start-start),ms:round(s.ms)})),longTasks:state.longTasks.filter(s=>s.start>=start).map(s=>({startMs:round(s.start-start),ms:round(s.ms)})),renderer:document.querySelector('[data-sim-viewport]').dataset.renderer}});
        assert.equal(data.renderer,'native');report.runs.push({sample,variant,visit,...data});
        console.log(JSON.stringify({sample,variant,visit,readyMs:data.readyMs,spans:data.spans.filter(s=>['mountScene.total','leafSurfaceMaps.create'].includes(s.name))}));
      }
      }finally{await context.close()}
     }
    }
    assert.deepEqual(report.errors,[]);assert.equal(report.blockedExternal,0);report.status='passed';
  }catch(error){
    report.status='failed';report.failure=String(error.message).split('\n')[0];throw error;
  }finally{
    try{
      try{if(browser)await browser.close()}finally{if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
    }catch(error){report.status='failed';report.cleanupFailure=String(error.message);throw error}
    finally{try{await reportFile.writeFile(JSON.stringify(report,null,2)+'\n')}finally{await reportFile.close()}}
    console.log(JSON.stringify({report:output,runs:report.runs.length,errors:report.errors,blockedExternal:report.blockedExternal}));
  }
}
