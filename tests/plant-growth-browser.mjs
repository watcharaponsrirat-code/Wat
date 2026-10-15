import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve('.'),out=resolve('tmp/plant-fidelity-review'),baseline='672397e';
const git=path=>execFileSync('git',['show',`${baseline}:${path}`],{cwd:root,maxBuffer:64*1024*1024});
await mkdir(out,{recursive:true});
// These files contain the authoritative science model, questions and scoring.
for(const path of ['assets/simulations/grade1.js','assets/simulations/models3d-grade1.js','assets/simulations/models3d-kit.js'])assert.equal((await readFile(path,'utf8')).replace(/\r\n/g,'\n'),git(path).toString('utf8').replace(/\r\n/g,'\n'),`${path} remains identical apart from checkout line endings`);
const originalEngine=git('assets/simulations/engine.js').toString('utf8');
assert.equal((await readFile('assets/simulations/engine.js','utf8')).replace(/\r\n/g,'\n'),originalEngine.replace(/\r\n/g,'\n'),'Engine/state/time/controls unchanged');
const cache=new Map(),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),old=url.pathname.startsWith('/before/');
 let asset=decodeURIComponent(url.pathname).replace(/^\/(before|after)\//,'').replace(/^\//,'');if(!asset||asset.endsWith('/'))asset+='index.html';
 if(asset==='favicon.ico'){res.writeHead(204);return res.end()}
 const path=resolve(root,asset);if(!path.startsWith(root+sep))throw Error('Outside root');
 if(old&&!cache.has(asset))cache.set(asset,git(asset));
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(old?cache.get(asset):await readFile(path));
}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const report={baseline,combinations:0,responsive:[],framing:[],screenshots:[],checks:[],performance:[],webkit:[],errors:[],limitations:['Browser emulation is not testing on physical iPad/mobile hardware.','Headless browser frame timing is diagnostic, not a device performance benchmark.','Renderer counters report the displayed render pass; they are complexity guards, not measured FPS.']};
let browser,webkit;
const settle=async p=>{await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await p.waitForFunction(()=>document.querySelector('.simViewport')?.dataset.animating==='false',null,{timeout:15000})};
const values=p=>p.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1').simulation.G1U1L1.values);
const state=p=>p.evaluate(()=>window.__SLH_QA__.snapshot('G1U1L1'));
const camera=p=>p.locator('.simViewport').evaluate(e=>({radius:+e.dataset.cameraDistance,theta:+e.dataset.azimuth,phi:+e.dataset.polar}));
const near=(a,b,message,tolerance=.00001)=>assert(Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
const choose=async(p,light,t)=>{await p.evaluate(({light,t})=>{for(const [key,value] of [['light',light],['t',t]]){const e=document.querySelector(`[data-sim-control="${key}"]`);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}))}},{light,t});await settle(p)};
const activate=async p=>{await p.evaluate(()=>window.__SLH_QA__.open('G1U1L1','lab'));await p.waitForSelector('.plantReadouts');await p.locator('.simViewport').scrollIntoViewIfNeeded();await settle(p)};
const makePage=async(engine,settings={},prefix='after')=>{
 const context=await engine.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce',...settings});
 const blockedExternal=new Set();
 await context.route('**/*',r=>{const url=r.request().url();if(new URL(url).hostname==='127.0.0.1'||url.startsWith('data:'))return r.continue();blockedExternal.add(url);return r.abort()});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(`${prefix}: ${e.message}`));
 // Three.js reports shader compile/link failures through console.error, not
 // necessarily pageerror. Include WebGL shader warnings as well.
 p.on('console',message=>{const text=message.text();if(/Failed to load resource: net::ERR_FAILED/.test(text)&&blockedExternal.has(message.location().url))return;if(message.type()==='error'||/WebGL.*(?:INVALID|shader|program)|THREE\.WebGLProgram|shader.*(?:compile|link).*fail/i.test(text))report.errors.push(`${prefix} console ${message.type()}: ${text}`)});
 p.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))report.errors.push(`${prefix} HTTP ${r.status()} ${r.url()}`)});
 await p.goto(`http://127.0.0.1:${server.address().port}/${prefix}/`);return p;
};
const layout=async p=>p.evaluate(()=>{
 const host=document.querySelector('.simViewport'),canvas=host.querySelector('canvas'),base=host.getBoundingClientRect(),cb=canvas.getBoundingClientRect();
 const elements=[...host.querySelectorAll('.plantCondition,.plantGroup')],rects=elements.map(e=>e.getBoundingClientRect());
 const details=[...host.querySelectorAll('.plantCondition,.plantGroup strong,.plantGroup span,.plantGroup b')].map(e=>({text:e.textContent,font:+parseFloat(getComputedStyle(e).fontSize),clip:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1}));
 const controls=[...document.querySelectorAll('.simCameraTools button,.simViewSwitch button,.simActions button')].map(e=>({text:e.textContent,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
 return {dataset:{...host.dataset},width:innerWidth,height:innerHeight,canvasSize:{width:cb.width,height:cb.height},pageOverflow:document.documentElement.scrollWidth>innerWidth,labelOverflow:rects.some(r=>r.left<base.left-1||r.top<base.top-1||r.right>base.right+1||r.bottom>base.bottom+1),labelOverlap:rects.some((a,i)=>rects.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)),canvasBound:cb.left>=base.left-1&&cb.right<=base.right+1&&cb.top>=base.top-1&&cb.bottom<=base.bottom+1,canvasLabelOverlap:rects.some(r=>r.left<cb.right&&r.right>cb.left&&r.top<cb.bottom-1&&r.bottom>cb.top+1),details,controls,originalMetrics:[...document.querySelectorAll('.simMetrics strong')].map(e=>e.textContent),readouts:[...host.querySelectorAll('.plantGroup')].map(e=>({group:e.dataset.group,title:e.querySelector('strong').textContent,light:e.querySelector('span').textContent,value:e.querySelector('b').textContent}))};
});
const checkLayout=(r,label)=>{
 for(const key of ['pageOverflow','labelOverflow','labelOverlap','canvasLabelOverlap'])assert.equal(r[key],false,`${label}: ${key}`);
 assert(r.canvasBound,`${label}: canvas inside viewport`);assert(r.details.every(d=>!d.clip),`${label}: clipped label text`);assert(r.details.every(d=>d.font>=12),`${label}: minimum label font`);
 assert(r.controls.every(b=>b.w>=44&&b.h>=44),`${label}: touch targets`);assert.deepEqual(r.readouts.map(x=>x.value),r.originalMetrics,`${label}: readout uses original metrics`);
 assert.equal(r.dataset.labelOverlap,'false');assert.equal(r.dataset.labelOverflow,'false');
 const calls=Number(r.dataset.drawCalls),triangles=Number(r.dataset.triangles),low=r.dataset.quality==='low';
 assert(Number.isFinite(calls)&&calls>0&&calls<=(low?80:100),`${label}: bounded draw calls (${calls})`);
 assert(Number.isFinite(triangles)&&triangles>0&&triangles<=(low?75000:150000),`${label}: bounded triangles (${triangles})`);
};
const checkFraming=(r,label)=>{
 const bounds=JSON.parse(r.dataset.frameBounds||'null');
 assert(bounds&&['left','right','top','bottom'].every(key=>Number.isFinite(bounds[key])),`${label}: finite projected scene bounds`);
 assert(bounds.left>=-1&&bounds.right<=1&&bounds.bottom>=-1&&bounds.top<=1,`${label}: full plants, lamps and pedestal fit (${JSON.stringify(bounds)})`);
};
try{
 browser=await playwright.chromium.launch({channel:'chrome',headless:true});
 const before=await makePage(browser,{},'before');
 const expected=await before.evaluate(()=>{
  const spec=window.SLH_SIMULATIONS.G1U1L1,rows=[];
  for(let light=0;light<=12;light++)for(let t=0;t<=14;t++){
   const p={simulation:{G1U1L1:{values:{light,t}}}},doc=new DOMParser().parseFromString(window.SLH_SIM_ENGINE.render('G1U1L1',p),'text/html');
   rows.push({light,t,html:doc.querySelector('[data-sim-output]').innerHTML,metrics:[...doc.querySelectorAll('.simMetrics strong')].map(e=>e.textContent)});
  }
  return {rows,controls:spec.controls,title:spec.title,hint:spec.hint,assumption:spec.assumption};
 });await before.context().close();
 const page=await makePage(browser);await activate(page);
 assert.deepEqual(await page.evaluate(()=>{const s=window.SLH_SIMULATIONS.G1U1L1;return {controls:s.controls,title:s.title,hint:s.hint,assumption:s.assumption}}),{controls:expected.controls,title:expected.title,hint:expected.hint,assumption:expected.assumption});
 for(const {light,t,html,metrics} of expected.rows){
  await choose(page,light,t);
  const current=await page.evaluate(()=>({html:document.querySelector('[data-sim-output]').innerHTML,state:JSON.parse(document.querySelector('.simViewport').dataset.modelState),visual:JSON.parse(document.querySelector('.simViewport').dataset.visualGrowth),readouts:[...document.querySelectorAll('.plantGroup b')].map(e=>e.textContent)}));
  assert.equal(current.html,html,`Original 2D SVG/summary/metrics ${light}/${t}`);assert.deepEqual(current.readouts,metrics);
  const a=t*3,b=a*Math.min(light/6,1.3);
  for(const [key,value] of [['controlGrowth',a],['experimentGrowth',b]]){near(current.state[key],value,`${light}/${t} model ${key}`);near(current.visual[key],value,`${light}/${t} visual endpoint ${key}`)}
  assert.deepEqual(await values(page),{light,t});report.combinations++;
  if(report.combinations%30===0)console.log(`Science values verified ${report.combinations}/195`);
 }
 report.checks.push('195 combinations: exact original 2D SVG, summary, metrics, controls, saved values and 3D growth endpoints');
 await page.context().close();
 for(const [device,width,height] of [['phone375',375,812],['phone',390,844],['phone430',430,932],['ipad-portrait',768,1024],['ipad-landscape',1024,768],['desktop',1366,900],['desktop1440',1440,900]]){
  const p=await makePage(browser,{viewport:{width,height},hasTouch:width<=1024});await activate(p);
  for(const [light,t] of [[6,0],[12,14],[0,14]]){
   await choose(p,light,t);await p.locator('[data-sim-camera="reset"]').click();await settle(p);
   const r=await layout(p);checkLayout(r,`${device} ${light}/${t}`);report.responsive.push({device,light,t,...r});
   for(const [name,selector] of [['studio','.simStudio'],['viewport','.simViewport']]){
    const file=`after-${device}-light${light}-day${t}-${name}.png`;await p.locator(selector).screenshot({path:resolve(out,file)});report.screenshots.push(file);
   }
  }
  // The tallest experimental endpoint and the shorter zero-light endpoint
  // must both remain usable from every supplied camera preset on each size.
  for(const light of [0,6,12]){
   await choose(p,light,14);
   for(const preset of ['reset','front','top']){
    await p.locator(`[data-sim-camera="${preset}"]`).click();await settle(p);
    const r=await layout(p);checkLayout(r,`${device} ${light}/14 ${preset}`);checkFraming(r,`${device} ${light}/14 ${preset}`);
    report.framing.push({device,light,preset,canvasSize:r.canvasSize,dataset:r.dataset});
   }
  }
  if(width<=430)assert.equal((await layout(p)).dataset.quality,'low','Automatic narrow-device detail budget');
  await p.context().close();console.log(`Responsive ${device} passed`);
 }
 // Functional behavior on a real WebGL canvas, using unchanged controls.
 const p=await makePage(browser);await activate(p);await choose(p,12,14);const saved=JSON.stringify(await state(p)),start=await camera(p);
 const command=async name=>{await p.locator(`[data-sim-camera="${name}"]`).click();await settle(p)};
 await command('left');near((await camera(p)).theta,start.theta-Math.PI/12,'15-degree left');await command('right');near((await camera(p)).theta,start.theta,'inverse rotation');
 for(let turn=0;turn<24;turn++)await command('right');
 const fullOrbit=await camera(p);near(Math.sin(fullOrbit.theta-start.theta),0,'Full 360-degree orbit returns to the same azimuth');near(Math.cos(fullOrbit.theta-start.theta),1,'Full orbit remains unrestricted');near(fullOrbit.radius,start.radius,'Full orbit keeps zoom');
 await command('in');assert((await camera(p)).radius<start.radius);await command('out');near((await camera(p)).radius,start.radius,'inverse zoom',1);
 for(const preset of ['front','top','reset']){await command(preset);checkLayout(await layout(p),preset)}
 const beforeAuto=await camera(p);await p.locator('[data-sim-camera="auto"]').click();
 await p.waitForFunction(theta=>Math.abs(+document.querySelector('.simViewport').dataset.azimuth-theta)>.01,beforeAuto.theta);
 assert.equal(await p.locator('[data-sim-camera="auto"]').getAttribute('aria-pressed'),'true');
 await command('auto');assert.equal(await p.locator('[data-sim-camera="auto"]').getAttribute('aria-pressed'),'false');
 await command('reset');
 await p.locator('.simViewport').scrollIntoViewIfNeeded();const box=await p.locator('.simViewport canvas').boundingBox(),beforeDrag=await camera(p);
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+80,box.y+box.height/2+20,{steps:8});await p.mouse.up();await settle(p);assert(Math.abs((await camera(p)).theta-beforeDrag.theta)>.05);
 await command('labels');assert(await p.locator('.plantReadouts').isHidden());await command('labels');assert(await p.locator('.plantReadouts').isVisible());
 await p.locator('.simViewport canvas').focus();const keyboard=await camera(p);await p.keyboard.press('ArrowRight');await settle(p);near((await camera(p)).theta,keyboard.theta+Math.PI/12,'keyboard rotation');
 await p.locator('[data-sim-view="2d"]').click();assert(await p.locator('.simDiagram').isVisible());assert(await p.locator('.simViewport').isHidden());
 await p.locator('[data-sim-view="3d"]').click();await settle(p);assert(await p.locator('.simViewport canvas').isVisible());assert.equal(JSON.stringify(await state(p)),saved,'Camera/mode changes preserve experiment and progress');
 await p.reload();await activate(p);assert.equal(JSON.stringify(await state(p)),saved,'Saved experiment survives reload');
 await p.locator('[data-sim-reset]').click();await settle(p);assert.deepEqual(await values(p),{light:6,t:0});
 const resetState=await state(p);await p.locator('[data-sim-play]').click();await p.waitForFunction(()=>window.__SLH_QA__.snapshot('G1U1L1').simulation.G1U1L1.values.t>=1);await p.locator('[data-sim-play]').click();assert.equal(await p.locator('[data-sim-play]').getAttribute('aria-pressed'),'false');
 await choose(p,6,13);await p.locator('[data-sim-play]').click();await p.waitForFunction(()=>document.querySelector('[data-sim-play]').getAttribute('aria-pressed')==='false');assert.equal((await values(p)).t,14);
 // XP/scoring fields must remain unchanged after free experimentation.
 for(const key of ['xp','score','mastery','exam','games','exercises'])if(key in resetState)assert.deepEqual((await state(p))[key],resetState[key],`No new ${key} from experimenting`);
 await p.locator('[data-sim-play]').click();await p.locator('[data-stage="g1"]').first().click();const stopped=JSON.stringify(await state(p));await p.waitForTimeout(1100);assert.equal(JSON.stringify(await state(p)),stopped,'Navigation stops experiment timer');assert.equal(await p.locator('.plantReadouts').count(),0,'Presentation disposed');
 report.checks.push('Rotate, zoom, front/top/reset cameras, auto rotation start/stop, pointer drag, keyboard, labels, 3D/2D, reload, reset, time play/pause/end, navigation disposal');
 await activate(p);await choose(p,12,0);await p.emulateMedia({reducedMotion:'no-preference'});
 const samples=await p.evaluate(async()=>{
  const host=document.querySelector('.simViewport'),control=document.querySelector('[data-sim-control="t"]');control.value=14;control.dispatchEvent(new Event('input',{bubbles:true}));
  const samples=[];for(let i=0;i<80;i++){await new Promise(requestAnimationFrame);samples.push(JSON.parse(host.dataset.visualGrowth));if(host.dataset.animating==='false')break}return samples;
 });await settle(p);
 assert(samples.some(s=>s.controlGrowth>0&&s.controlGrowth<42),'Smooth intermediate growth positions');
 for(let i=1;i<samples.length;i++)assert(samples[i].controlGrowth>=samples[i-1].controlGrowth-.00001,'Growth interpolates without reverse jumps');
 near(JSON.parse(await p.locator('.simViewport').getAttribute('data-visual-growth')).controlGrowth,42,'Animation exact endpoint');
 await p.emulateMedia({reducedMotion:'reduce'});await choose(p,0,0);near(JSON.parse(await p.locator('.simViewport').getAttribute('data-visual-growth')).controlGrowth,0,'Reduced-motion immediate endpoint');
 report.checks.push(`Smooth growth interpolation (${samples.length} sampled frames) and reduced-motion endpoint`);
 report.performance.push(await p.locator('.simViewport').evaluate(e=>({...e.dataset})));
 const budget=await p.evaluate(async frameCases=>{
  const THREE=await import('/after/assets/vendor/three/three.module.js');
  const {ModelKit}=await import('/after/assets/simulations/models3d-kit.js');
  const {models3d}=await import('/after/assets/simulations/models3d.js');
  const {createPlantGrowthStudio}=await import('/after/assets/simulations/plant-growth-studio.js');
  const panel=document.createElement('section');panel.className='simPanel';panel.dataset.simulation='G1U1L1';panel.style.cssText='position:fixed;left:-10000px;width:640px;';
  const host=document.createElement('div');host.className='simViewport';panel.append(host,document.querySelector('.simMetrics').cloneNode(true));document.body.append(panel);
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);const kit=new ModelKit(group);
  const key=new THREE.DirectionalLight(),rim=new THREE.DirectionalLight();
  // Match the physical platform geometry used by the mounted plant scene.
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(235,245,14,96),new THREE.MeshStandardMaterial());
  const edge=new THREE.Mesh(new THREE.TorusGeometry(232,1.6,8,96),new THREE.MeshBasicMaterial());edge.rotation.x=Math.PI/2;scene.add(platform,edge);
  const renderer={setPixelRatio(v){this.ratio=v},setSize(w,h){this.size=[w,h]}};
  const studio=createPlantGrowthStudio({host,scene,kit,renderer,key,rim,platform,edge});
  const fixtures=scene.getObjectByName('bean-laboratory-lights'),spots=fixtures.children.filter(o=>o.isSpotLight),targets=spots.map(o=>o.target);
  const lampState=id=>{
   const lamp=fixtures.getObjectByName(id+'-light-fixture'),beam=lamp.children.find(o=>o.material?.isShaderMaterial),halo=lamp.children.find(o=>o.isSprite),spot=spots.find(o=>o.position.x===lamp.position.x);
   return {beamVisible:beam.visible,strength:beam.material.uniforms.strength.value,halo:halo.material.opacity,intensity:spot.intensity};
  };
  const lighting=[],geometryFraming=[];
  function physicalPoints(){
   scene.updateMatrixWorld(true);const points=[],instance=new THREE.Matrix4(),world=new THREE.Matrix4();
   // This samples actual vertices independently of the adapter's conservative
   // framing envelope. Transparent beam/halo/contact effects are intentionally
   // free to fade beyond that envelope; solid science objects must fit.
   for(const root of [group,scene.getObjectByName('bean-growth-detail'),fixtures,platform,edge])root.traverseVisible(object=>{
    if(!object.isMesh||!object.geometry?.attributes.position)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(materials.every(material=>material.transparent||material.isShaderMaterial))return;
    const positions=object.geometry.attributes.position,count=object.isInstancedMesh?object.count:1;
    for(let n=0;n<count;n++){
     if(object.isInstancedMesh){object.getMatrixAt(n,instance);world.multiplyMatrices(object.matrixWorld,instance)}else world.copy(object.matrixWorld);
     for(let i=0;i<positions.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(world));
    }
   });return points;
  }
  for(const light of [0,6,12]){
   kit.begin();models3d.G1U1L1(kit,{light,t:14});kit.end();studio.update();studio.tick(.016,true);
   lighting.push({light,control:lampState('control'),experiment:lampState('experiment'),state:{...kit.values},visual:JSON.parse(host.dataset.visualGrowth)});
   const points=physicalPoints(),projected=new THREE.Vector3();
   for(const view of frameCases.filter(view=>view.light===light)){
    const camera=new THREE.PerspectiveCamera(40,view.canvasSize.width/view.canvasSize.height,1,5000),target=new THREE.Vector3(0,-30,0);
    camera.position.setFromSpherical(new THREE.Spherical(+view.dataset.cameraDistance,+view.dataset.polar,+view.dataset.azimuth)).add(target);camera.lookAt(target);camera.updateMatrixWorld();
    const bounds={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity,near:Infinity,far:-Infinity};
    for(const point of points){projected.copy(point).project(camera);bounds.left=Math.min(bounds.left,projected.x);bounds.right=Math.max(bounds.right,projected.x);bounds.bottom=Math.min(bounds.bottom,projected.y);bounds.top=Math.max(bounds.top,projected.y);bounds.near=Math.min(bounds.near,projected.z);bounds.far=Math.max(bounds.far,projected.z)}
    geometryFraming.push({device:view.device,preset:view.preset,light,vertices:points.length,bounds});
   }
  }
  const resources=new Map(),observe=r=>{if(r&&!resources.has(r)){resources.set(r,0);r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1))}};
  const watch=()=>{
   for(const group of [scene.getObjectByName('bean-growth-detail'),fixtures])group.traverse(o=>{
    // Sprite geometry is shared internally by Three.js; the adapter owns its material and texture.
    observe(o.isMesh?o.geometry:null);if(o.isInstancedMesh)observe(o);
    for(const material of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){
     observe(material);for(const value of Object.values(material))if(value?.isTexture)observe(value);
     for(const uniform of Object.values(material.uniforms||{}))if(uniform.value?.isTexture)observe(uniform.value);
    }
   });
   observe(platform.material.map);
  };
  const plantTriangles=()=>{let triangles=0;scene.getObjectByName('bean-growth-detail').traverseVisible(object=>{if(object.isMesh)triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1)});return triangles};
  watch();const initial={quality:host.dataset.quality,meshes:studio.meshCount,triangles:plantTriangles(),state:JSON.stringify(kit.values)};
  for(let i=0;i<45;i++)studio.frameTime(60);watch();studio.tick(.016,true);
  const reduced={quality:host.dataset.quality,reason:host.dataset.qualityReason,meshes:studio.meshCount,triangles:plantTriangles(),state:JSON.stringify(kit.values),visual:JSON.parse(host.dataset.visualGrowth),ratio:renderer.ratio};
  for(let i=0;i<90;i++)studio.frameTime(16);const stable=host.dataset.quality;studio.dispose();studio.dispose();
  const disposed=[...resources.values()].every(count=>count===1)&&!scene.getObjectByName('bean-growth-detail')&&!scene.getObjectByName('bean-laboratory-lights')&&targets.every(target=>!target.parent)&&!host.querySelector('.plantReadouts');
  kit.dispose();platform.geometry.dispose();platform.material.dispose();edge.geometry.dispose();edge.material.dispose();panel.remove();return {initial,reduced,stable,disposed,resources:resources.size,lighting,geometryFraming};
 },report.framing);
 for(const sample of budget.geometryFraming){
  assert(sample.vertices>0,'Physical geometry sampled');
  assert(Object.values(sample.bounds).every(Number.isFinite),'Finite actual geometry projection');
  assert(sample.bounds.left>=-1&&sample.bounds.right<=1&&sample.bounds.bottom>=-1&&sample.bounds.top<=1&&sample.bounds.near>=-1&&sample.bounds.far<=1,`${sample.device} ${sample.light}/14 ${sample.preset}: actual geometry fits ${JSON.stringify(sample.bounds)}`);
 }
 for(const [index,row] of budget.lighting.entries()){
  for(const lamp of [row.control,row.experiment])assert([lamp.strength,lamp.halo,lamp.intensity].every(value=>Number.isFinite(value)&&value>=0),`Finite nonnegative lamp brightness at ${row.light} hours`);
  assert.deepEqual(row.control,budget.lighting[0].control,'Experiment light leaves comparison lamp unchanged');
  near(row.state.controlGrowth,42,'Lighting keeps original comparison growth');near(row.state.experimentGrowth,42*Math.min(row.light/6,1.3),'Lighting keeps original experimental growth');
  near(row.visual.controlGrowth,row.state.controlGrowth,'Lighting keeps comparison visual endpoint');near(row.visual.experimentGrowth,row.state.experimentGrowth,'Lighting keeps experimental visual endpoint');
  if(!row.light){assert(!row.experiment.beamVisible||row.experiment.strength===0,'Zero hours disables experimental beam');assert.equal(row.experiment.halo,0,'Zero hours disables experimental halo');assert.equal(row.experiment.intensity,0,'Zero hours disables experimental spotlight')}
  else{assert(row.experiment.beamVisible,'Positive hours show experimental beam');for(const key of ['strength','halo','intensity'])assert(row.experiment[key]>budget.lighting[index-1].experiment[key],`Experimental ${key} increases with hours`)}
 }
 assert.equal(budget.initial.quality,'high');assert.equal(budget.reduced.quality,'low');assert.equal(budget.reduced.reason,'frame-budget');assert(budget.reduced.meshes<=budget.initial.meshes);assert(budget.reduced.triangles<budget.initial.triangles*.75,'Low detail meaningfully reduces plant triangles');assert.equal(budget.initial.state,budget.reduced.state);near(budget.reduced.visual.experimentGrowth,54.6,'Quality reduction preserves growth');assert.equal(budget.stable,'low');assert(budget.disposed,'All observed geometry/material/texture resources disposed exactly once');
 report.performance.push(budget);report.checks.push('Lamp brightness follows 0/6/12 hours without changing growth; zero hours disables experimental light; fixture textures and light targets disposed','Synthetic sustained slow frames trigger lower detail without science changes; no quality oscillation; GPU resources disposed');await p.context().close();
 // Browser-level touch input through Chrome DevTools, not synthetic mouse events.
 const touch=await makePage(browser,{viewport:{width:1024,height:768},isMobile:true,hasTouch:true});await activate(touch);
 if(await touch.locator('[data-sim-camera="drag"]').getAttribute('aria-pressed')!=='true')await touch.locator('[data-sim-camera="drag"]').click();
 await touch.locator('.simViewport').scrollIntoViewIfNeeded();const tb=await touch.locator('.simViewport canvas').boundingBox(),session=await touch.context().newCDPSession(touch),cx=tb.x+tb.width/2,cy=tb.y+tb.height/2,cam0=await camera(touch);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
 for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+i*10,y:cy,id:1}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(touch);assert(Math.abs((await camera(touch)).theta-cam0.theta)>.03,'Touch drag orbit');
 const pinch=await camera(touch);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:cy,id:1},{x:cx+35,y:cy,id:2}]});
 for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-35-i*7,y:cy,id:1},{x:cx+35+i*7,y:cy,id:2}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(touch);assert((await camera(touch)).radius<pinch.radius,'Two-finger pinch zoom');report.checks.push('Chrome iPad emulation: native touch drag and two-finger pinch');await touch.context().close();
 webkit=await playwright.webkit.launch({headless:true});
 for(const [width,height] of [[768,1024],[1024,768]]){
  const w=await makePage(webkit,{viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2});await activate(w);
  for(const [light,t] of [[6,0],[12,14],[0,14]]){await choose(w,light,t);const r=await layout(w);checkLayout(r,`WebKit ${width} ${light}/${t}`);report.webkit.push({light,t,...r})}
  await w.locator('[data-sim-camera="left"]').tap();await settle(w);await w.locator('[data-sim-camera="in"]').tap();await settle(w);await w.locator('[data-sim-camera="reset"]').tap();await settle(w);
  await w.locator('[data-sim-view="2d"]').tap();assert(await w.locator('.simDiagram').isVisible());await w.locator('[data-sim-view="3d"]').tap();await settle(w);
  const file=`after-webkit-ipad-${width}-viewport.png`;await w.locator('.simViewport').screenshot({path:resolve(out,file)});report.screenshots.push(file);await w.context().close();console.log(`WebKit iPad ${width} passed`);
 }
 report.checks.push('WebKit iPad emulation both orientations, DPR2, three experiment states, touch toolbar and 3D/2D');
 report.checks.push('Default/front/top presets at 0/6/12 hours across seven viewport sizes: conservative bounds and independently projected physical vertices fit; bounded render calls and triangles');
 assert.deepEqual(report.errors,[],'No JavaScript, shader, WebGL or local asset errors');report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;process.exitCode=1;console.error(e.stack)}finally{
 await browser?.close();await webkit?.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,'plant-browser-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,combinations:report.combinations,responsive:report.responsive.length,webkit:report.webkit.length,screenshots:report.screenshots.length,errors:report.errors}));
}
