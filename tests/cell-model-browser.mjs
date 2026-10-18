import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const root=resolve('.'),out=resolve('tmp/cell-model-review'),baseline='6a120ba',lesson='G1U3L1',modelsOnly=process.argv.includes('--models');
const common=['membrane','cytoplasm','nucleus','nucleolus','mitochondria','golgi','rough-er','smooth-er','ribosomes'];
const expectedIds={animal:[...common,'lysosomes','vesicles','centrioles'],plant:[...common,'wall','vacuole','chloroplasts']};
const git=path=>execFileSync('git',['show',`${baseline}:${path}`],{cwd:root,maxBuffer:64*1024*1024});
const report={baseline,status:'RUNNING',preserved:[],scienceCases:0,models:[],responsive:[],checks:[],screenshots:[],errors:[],expectedFallbackErrors:[],limitations:['Browser emulation does not measure physical mobile/iPad performance.','The cell shapes and colors are educational representations, not microscopy measurements.']};
await mkdir(out,{recursive:true});
const cache=new Map(),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),old=url.pathname.startsWith('/before/');
 let asset=decodeURIComponent(url.pathname).replace(/^\/(before|after)\//,'').replace(/^\//,'');if(!asset||asset.endsWith('/'))asset+='index.html';
 if(asset==='favicon.ico'){res.writeHead(204);return res.end()}
 if(asset==='fixture.html'){res.writeHead(200,{'Content-Type':mime['.html']});return res.end('<!doctype html><html><body></body></html>')}
 const path=resolve(root,asset);if(!path.startsWith(root+sep))throw Error('Outside root');
 if(old&&!cache.has(asset))cache.set(asset,git(asset));
 res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(old?cache.get(asset):await readFile(path));
}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,webkit;
report.webkit=[];
const settle=async p=>{
 await p.locator('.simViewport canvas').scrollIntoViewIfNeeded();
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await p.waitForFunction(()=>document.querySelector('.simViewport')?.dataset.animating==='false',null,{timeout:20000});
};
const activate=async p=>{await p.evaluate(id=>window.__SLH_QA__.open(id,'lab'),lesson);await p.waitForSelector('[data-cell-studio]');await settle(p)};
const camera=p=>p.locator('.simViewport').evaluate(e=>({radius:+e.dataset.cameraDistance,theta:+e.dataset.azimuth,phi:+e.dataset.polar}));
const snapshot=p=>p.evaluate(id=>window.__SLH_QA__.snapshot(id),lesson);
const values=async p=>(await snapshot(p)).simulation[lesson].values;
const command=async(p,name)=>{await p.locator(`[data-sim-camera="${name}"]`).click();if(name!=='auto')await settle(p)};
const choose=async(p,cell,zoom=1)=>{
 await p.evaluate(({cell,zoom})=>{for(const [key,value,type] of [['cell',cell,'change'],['zoom',zoom,'input']]){const control=document.querySelector(`[data-sim-control="${key}"]`);control.value=value;control.dispatchEvent(new Event(type,{bubbles:true}))}},{cell,zoom});
 await settle(p);
};
const near=(a,b,message,tolerance=.001)=>assert(Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
const makePage=async(settings={},prefix='after',fallback=false,documentPath='',engine=browser)=>{
 const context=await engine.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...settings});
 const blocked=new Set();
 await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).hostname==='127.0.0.1'||url.startsWith('data:'))return route.continue();blocked.add(url);return route.abort()});
 const p=await context.newPage();p.on('pageerror',error=>report.errors.push(`${prefix}: ${error.message}`));
 p.on('console',message=>{const text=message.text();if(/Failed to load resource: net::ERR_FAILED/.test(text)&&blocked.has(message.location().url))return;
  if(fallback&&/Error creating WebGL context|3D scene unavailable/.test(text)){report.expectedFallbackErrors.push(text);return}
  if(message.type()==='error'||/WebGL.*(?:INVALID|shader|program)|THREE\.WebGLProgram|shader.*(?:compile|link).*fail/i.test(text))report.errors.push(`${prefix} ${message.type()}: ${text}`);
 });
 p.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('favicon.ico'))report.errors.push(`${prefix} HTTP ${response.status()} ${response.url()}`)});
 if(fallback)await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)}});
 await p.goto(`${origin}/${prefix}/${documentPath}`);return p;
};
const layout=p=>p.evaluate(()=>{
 const host=document.querySelector('.simViewport'),canvas=host.querySelector('canvas'),bounds=canvas.getBoundingClientRect();
 const rect=e=>{const b=e.getBoundingClientRect();return {id:e.dataset.cellHotspot,x:b.left-bounds.left,y:b.top-bounds.top,w:b.width,h:b.height}};
 const hotspots=[...host.querySelectorAll('[data-cell-hotspot]')].filter(e=>!e.hidden&&e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').map(rect);
 const controls=[...document.querySelectorAll('[data-cell-organelle],.simCameraTools button,.simViewSwitch button')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));
 return {width:innerWidth,height:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth,canvas:{width:bounds.width,height:bounds.height},hotspots,controls,dataset:{...host.dataset}};
});
const checkLayout=(sample,label)=>{
 assert(!sample.pageOverflow,`${label}: no horizontal page overflow`);
 assert(sample.canvas.width>0&&sample.canvas.height>0,`${label}: visible canvas`);
 assert(sample.controls.every(b=>b.w>=43.5&&b.h>=43.5),`${label}: usable touch controls`);
 for(const a of sample.hotspots){assert(a.w>=43.5&&a.h>=43.5,`${label}: hotspot ${a.id} touch target`);assert(a.x>=-1&&a.y>=-1&&a.x+a.w<=sample.canvas.width+1&&a.y+a.h<=sample.canvas.height+1,`${label}: hotspot ${a.id} inside scene`)}
 for(let i=0;i<sample.hotspots.length;i++)for(const b of sample.hotspots.slice(i+1)){const a=sample.hotspots[i];assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`${label}: hotspots ${a.id}/${b.id} overlap`)}
 assert.equal(+sample.dataset.cellOrganelleCount,12,`${label}: complete organelle list`);
};
const screenshot=async(p,name,selector='.simViewport')=>{await p.locator(selector).screenshot({path:resolve(out,name)});report.screenshots.push(name)};

try{
 for(const path of ['index.html','assets/simulations/core.js','assets/simulations/engine.js','assets/simulations/grade1.js','assets/simulations/grade2.js','assets/simulations/grade3.js','assets/simulations/models3d.js','assets/simulations/models3d-kit.js','assets/simulations/models3d-grade1.js','assets/simulations/models3d-grade2.js','assets/simulations/models3d-grade3.js','assets/simulations/plant-growth-model.js','assets/simulations/plant-growth-botany.js','assets/simulations/plant-growth-leaf-surface.js','assets/simulations/plant-growth-studio.js']){
  assert.equal((await readFile(path,'utf8')).replace(/\r\n/g,'\n'),git(path).toString('utf8').replace(/\r\n/g,'\n'),`${path}: source preserved apart from checkout line endings`);report.preserved.push(path);
 }
 browser=await playwright.chromium.launch({channel:'chrome',headless:true});
 const modelPage=await makePage({},'after',false,'fixture.html');
 report.models=await modelPage.evaluate(async expected=>{
  const T=await import('/after/assets/vendor/three/three.module.js');
  const {createAnimalCellModel}=await import('/after/assets/simulations/cell-animal-model.js');
  const {createPlantCellModel}=await import('/after/assets/simulations/cell-plant-model.js');
  const {CELL_ORGANELLES}=await import('/after/assets/simulations/cell-data.js');
  const ok=(value,message)=>{if(!value)throw Error(message)};
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(700,600);document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color(0x0c263b);scene.add(new T.HemisphereLight(0xe8f6ff,0x3e352a,2));
  const light=new T.DirectionalLight(0xffffff,3);light.position.set(-200,300,400);scene.add(light);
  const camera=new T.PerspectiveCamera(40,700/600,1,5000),results=[];
  for(const [type,factory] of [['plant',createPlantCellModel],['animal',createAnimalCellModel]])for(const quality of ['high','low']){
   const model=factory({quality}),ids=model.organelles.map(o=>o.id),geometries=new Set(),resources=new Map();let meshes=0,triangles=0;
   ok(model.group?.isGroup&&typeof model.dispose==='function',`${type}/${quality} factory API`);
   ok(JSON.stringify([...ids].sort())===JSON.stringify([...expected[type]].sort()),`${type}/${quality}: exact organelle set ${ids}`);
   const observe=resource=>{if(resource?.addEventListener&&!resources.has(resource)){resources.set(resource,0);resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1))}};
   scene.add(model.group);model.group.updateMatrixWorld(true);
   for(const organelle of model.organelles){
    ok(organelle.anchor?.isVector3&&organelle.anchor.toArray().every(Number.isFinite),`${type}/${organelle.id}: finite anchor`);
    ok(organelle.objects.length>0,`${type}/${organelle.id}: selectable geometry`);
    for(const object of organelle.objects)ok(object.isMesh&&object.userData.cellOrganelle===organelle.id,`${type}/${organelle.id}: tagged selectable mesh`);
    const entry=Array.isArray(CELL_ORGANELLES)?CELL_ORGANELLES.find(o=>o.id===organelle.id):CELL_ORGANELLES[organelle.id];ok(entry,`${type}/${organelle.id}: educational metadata`);
   }
   model.group.traverseVisible(object=>{
    if(!object.isMesh)return;meshes++;ok(ids.includes(object.userData.cellOrganelle),`${type}: every visible mesh belongs to an organelle (${object.name})`);
    ok(object.matrixWorld.toArray().every(Number.isFinite),`${object.name}: finite transform`);
    const geometry=object.geometry,position=geometry.attributes.position;ok(position&&position.count>=3,`${object.name}: vertex positions`);
    triangles+=(geometry.index?.count||position.count)/3*(object.isInstancedMesh?object.count:1);
    if(!geometries.has(geometry)){for(const [name,attribute] of Object.entries(geometry.attributes))ok(Array.from(attribute.array).every(Number.isFinite),`${object.name}: finite ${name}`);if(geometry.index)for(const index of geometry.index.array)ok(index>=0&&index<position.count,`${object.name}: valid index`);geometries.add(geometry)}
    observe(geometry);if(object.isInstancedMesh){observe(object);ok(Array.from(object.instanceMatrix.array).every(Number.isFinite),`${object.name}: finite instances`)}
    for(const material of (Array.isArray(object.material)?object.material:[object.material])){observe(material);for(const value of Object.values(material))if(value?.isTexture)observe(value);for(const uniform of Object.values(material.uniforms||{}))if(uniform.value?.isTexture)observe(uniform.value)}
   });
   const bounds=new T.Box3().setFromObject(model.group),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
   ok(size.toArray().every(v=>Number.isFinite(v)&&v>0),`${type}: actual three-dimensional bounds`);
   const distance=Math.max(size.x,size.y,size.z)*2.2;camera.position.copy(center).add(new T.Vector3(0,20,distance));camera.lookAt(center);camera.updateMatrixWorld();renderer.render(scene,camera);
   ok(renderer.info.render.calls>0&&renderer.info.render.triangles>0,`${type}: actual WebGL render`);
   const rendered={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
   ok(rendered.calls<=64&&triangles<=(quality==='high'?130000:60000),`${type}/${quality}: bounded rendering complexity`);
   // Render an ID buffer with the actual depth test: every required part must
   // contribute visible pixels, rather than merely exist behind another mesh.
   const target=new T.WebGLRenderTarget(700,600);target.texture.colorSpace=T.LinearSRGBColorSpace;
   const originalMaterials=new Map(),idMaterials=ids.map((id,i)=>new T.MeshBasicMaterial({color:new T.Color().setRGB((i+1)/16,0,0),side:T.DoubleSide,toneMapped:false}));
   model.group.traverseVisible(object=>{if(object.isMesh){originalMaterials.set(object,object.material);object.material=idMaterials[ids.indexOf(object.userData.cellOrganelle)]}});
   const background=scene.background;scene.background=new T.Color(0);renderer.setRenderTarget(target);renderer.render(scene,camera);
   const pixels=new Uint8Array(700*600*4);renderer.readRenderTargetPixels(target,0,0,700,600,pixels);
   const visiblePixels=Object.fromEntries(ids.map(id=>[id,0]));
   for(let i=0;i<pixels.length;i+=4){const index=Math.round(pixels[i]/255*16)-1;if(index>=0&&index<ids.length&&pixels[i+1]===0&&pixels[i+2]===0)visiblePixels[ids[index]]++}
   for(const id of ids)ok(visiblePixels[id]>=4,`${type}/${quality}: ${id} contributes visible cutaway pixels (${visiblePixels[id]})`);
   for(const [object,material] of originalMaterials)object.material=material;
   renderer.setRenderTarget(null);scene.background=background;target.dispose();idMaterials.forEach(material=>material.dispose());
   scene.remove(model.group);model.dispose();model.dispose();
   ok([...resources.values()].every(count=>count===1),`${type}/${quality}: owned resources disposed exactly once (${[...resources.values()].filter(n=>n!==1)})`);
   results.push({type,quality,ids,meshes,geometries:geometries.size,triangles,bounds:size.toArray(),rendered,visiblePixels,disposedResources:resources.size});
  }
  renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();return results;
 },expectedIds);
 for(const type of ['plant','animal']){const high=report.models.find(m=>m.type===type&&m.quality==='high'),low=report.models.find(m=>m.type===type&&m.quality==='low');assert(low.triangles<=high.triangles,`${type}: low detail does not increase geometry`)}
 await modelPage.context().close();console.log('Cell factories, WebGL and resource disposal passed');

 if(!modelsOnly){
 const before=await makePage({},'before');
 const expected=await before.evaluate(id=>{const spec=window.SLH_SIMULATIONS[id],rows=[];for(const cell of [0,1])for(let step=0;step<=10;step++){const zoom=1+step/10,p={simulation:{[id]:{values:{cell,zoom}}}},doc=new DOMParser().parseFromString(window.SLH_SIM_ENGINE.render(id,p),'text/html');rows.push({cell,zoom,html:doc.querySelector('[data-sim-output]').innerHTML})}return {rows,controls:spec.controls,title:spec.title,hint:spec.hint,assumption:spec.assumption}},lesson);
 await before.evaluate(id=>window.__SLH_QA__.open(id,'lab'),lesson);await before.waitForSelector('.simPanel[data-sim-view="3d"]');await settle(before);
 for(const [cell,type] of [[0,'plant'],[1,'animal']]){await choose(before,cell);await command(before,'reset');await screenshot(before,`before-${type}-default.png`);await command(before,'front');await screenshot(before,`before-${type}-front.png`)}
 await before.context().close();
 const p=await makePage();await activate(p);
 assert.deepEqual(await p.evaluate(id=>{const s=window.SLH_SIMULATIONS[id];return {controls:s.controls,title:s.title,hint:s.hint,assumption:s.assumption}},lesson),{controls:expected.controls,title:expected.title,hint:expected.hint,assumption:expected.assumption});
 for(const {cell,zoom,html} of expected.rows){await choose(p,cell,zoom);assert.equal(await p.locator('[data-sim-output]').innerHTML(),html,`${cell}/${zoom}: original SVG, summary and metrics`);assert.deepEqual(await values(p),{cell,zoom});assert.equal(await p.locator('.simViewport').getAttribute('data-cell-type'),cell?'animal':'plant');report.scienceCases++}
 report.checks.push('22 original cell/zoom combinations preserve controls, 2D SVG, metrics, summary and saved values');
 for(const [cell,type] of [[0,'plant'],[1,'animal']]){
  await choose(p,cell);await command(p,'reset');
  assert.deepEqual((await p.locator('[data-cell-organelle]').evaluateAll(es=>es.map(e=>e.dataset.cellOrganelle))).sort(),[...expectedIds[type]].sort(),`${type}: complete exclusive list`);
  for(const id of expectedIds[type]){await p.locator(`[data-cell-organelle="${id}"]`).click();assert.equal(await p.locator('.simViewport').getAttribute('data-cell-selected'),id);assert.equal(await p.locator(`[data-cell-organelle="${id}"]`).getAttribute('aria-pressed'),'true');assert((await p.locator('.cellSelectionInfo').innerText()).trim().length>10,`${id}: explanatory selection text`)}
  await p.locator('[data-cell-clear]').click();assert.equal(await p.locator('.simViewport').getAttribute('data-cell-selected'),'');
  await screenshot(p,`${type}-default.png`);await command(p,'front');await screenshot(p,`${type}-front.png`);
  const first=p.locator('[data-cell-hotspot]:visible').first();assert(await first.count(),`${type}: visible selectable hotspot`);const hotspotId=await first.getAttribute('data-cell-hotspot');await first.click();assert.equal(await p.locator('.simViewport').getAttribute('data-cell-selected'),hotspotId);
  await command(p,'labels');assert.equal(await p.locator('[data-cell-hotspot]:visible').count(),0,'Labels toggle hides hotspots');assert.equal(await p.locator('[data-cell-organelle]').count(),12,'Full list remains accessible');
  await p.locator('[data-cell-clear]').click();await p.locator('.simViewport canvas').scrollIntoViewIfNeeded();
  const box=await p.locator('.simViewport canvas').boundingBox();let picked='';
  for(const [x,y] of [[.5,.5],[.35,.5],[.65,.5],[.5,.35],[.5,.65],[.3,.3],[.7,.7]]){await p.mouse.click(box.x+box.width*x,box.y+box.height*y);picked=await p.locator('.simViewport').getAttribute('data-cell-selected');if(picked)break}
  assert(expectedIds[type].includes(picked),`${type}: canvas raycast selects organelle`);
  await command(p,'labels');await p.locator(`[data-cell-organelle="nucleus"]`).click();await choose(p,1-cell);assert.equal(await p.locator('.simViewport').getAttribute('data-cell-selected'),'','Cell switch clears former selection');
 }
 report.checks.push('Every organelle list item, visible hotspots and canvas raycast select; labels toggle, clear and type change behave correctly');
 await choose(p,1,1.7);const saved=JSON.stringify(await snapshot(p));await command(p,'reset');const initial=await camera(p);
 await command(p,'left');near((await camera(p)).theta,initial.theta-Math.PI/12,'Left rotation');await command(p,'right');near((await camera(p)).theta,initial.theta,'Inverse rotation');
 await command(p,'in');assert((await camera(p)).radius<initial.radius);await command(p,'out');near((await camera(p)).radius,initial.radius,'Inverse camera zoom',1);
 await command(p,'front');near((await camera(p)).theta,0,'Front azimuth');await command(p,'top');assert((await camera(p)).phi<.1,'Top view');await command(p,'reset');
 await p.locator('[data-sim-camera="auto"]').click();await p.waitForFunction(theta=>Math.abs(+document.querySelector('.simViewport').dataset.azimuth-theta)>.02,initial.theta);await p.locator('[data-sim-camera="auto"]').click();await settle(p);await command(p,'reset');
 await p.locator('[data-cell-organelle="nucleus"]').click();await command(p,'labels');await p.locator('.simViewport canvas').scrollIntoViewIfNeeded();const box=await p.locator('.simViewport canvas').boundingBox(),dragStart=await camera(p);
 await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.5+80,box.y+box.height*.5+20,{steps:8});await p.mouse.up();await settle(p);assert(Math.abs((await camera(p)).theta-dragStart.theta)>.04,'Mouse drag rotates');assert.equal(await p.locator('.simViewport').getAttribute('data-cell-selected'),'nucleus','Drag is not misread as picking');
 const wheelStart=await camera(p);await p.mouse.wheel(0,-120);await settle(p);assert((await camera(p)).radius<wheelStart.radius,'Mouse wheel zoom');
 await p.locator('.simViewport canvas').focus();const keyStart=await camera(p);await p.keyboard.press('ArrowRight');await settle(p);near((await camera(p)).theta,keyStart.theta+Math.PI/12,'Keyboard rotation');
 await p.locator('[data-sim-view="2d"]').click();assert(await p.locator('.simDiagram').isVisible());assert(await p.locator('.simViewport').isHidden());await p.locator('[data-sim-view="3d"]').click();await settle(p);
 assert.equal(JSON.stringify(await snapshot(p)),saved,'Presentation interactions preserve progress');await p.reload();await activate(p);assert.equal(JSON.stringify(await snapshot(p)),saved,'Saved controls survive reload');
 await p.locator('[data-sim-reset]').click();await settle(p);assert.deepEqual(await values(p),{cell:0,zoom:1},'Existing reset defaults');
 await p.locator('[data-stage="g1"]').first().click();assert.equal(await p.locator('[data-cell-studio],.simViewport canvas').count(),0,'Navigation removes studio and canvas');await activate(p);assert.equal(await p.locator('.simViewport canvas').count(),1,'Reopening mounts one canvas');
 await p.locator('.simViewport canvas').evaluate(canvas=>canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));assert(await p.locator('.simDiagram').isVisible());assert(await p.locator('[data-sim-view="3d"]').isDisabled());
 report.checks.push('Mouse drag/wheel, keyboard, camera presets/buttons, auto rotation, 2D/3D, persistence, reset, navigation disposal/reopen and WebGL context loss');await p.context().close();

 for(const [width,height] of [[375,812],[390,844],[768,1024],[1024,768],[1440,1000]]){
  const page=await makePage({viewport:{width,height},hasTouch:width<=1024});await activate(page);
  for(const [cell,type] of [[0,'plant'],[1,'animal']])for(const zoom of [1,2]){
   await choose(page,cell,zoom);await command(page,'reset');const sample=await layout(page);checkLayout(sample,`${width}/${type}/${zoom}`);report.responsive.push({type,zoom,...sample});
   if(zoom===1&&(width===375||width===390||width===1440))await screenshot(page,`${type}-${width}.png`);
   await command(page,'front');checkLayout(await layout(page),`${width}/${type}/${zoom}/front`);
   await command(page,'top');checkLayout(await layout(page),`${width}/${type}/${zoom}/top`);
  }
  await page.context().close();console.log(`Cell responsive ${width} passed`);
 }
 const touch=await makePage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await activate(touch);await choose(touch,1);await command(touch,'labels');
 if(await touch.locator('[data-sim-camera="drag"]').getAttribute('aria-pressed')!=='true')await command(touch,'drag');
 await touch.locator('.simViewport canvas').scrollIntoViewIfNeeded();const touchBox=await touch.locator('.simViewport canvas').boundingBox(),cx=touchBox.x+touchBox.width/2,cy=touchBox.y+touchBox.height/2,session=await touch.context().newCDPSession(touch),touchStart=await camera(touch);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+i*8,y:cy,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(touch);assert(Math.abs((await camera(touch)).theta-touchStart.theta)>.03,'Native touch drag');
 const pinch=await camera(touch);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});for(let i=1;i<=5;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-30-i*5,y:cy,id:1},{x:cx+30+i*5,y:cy,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(touch);assert((await camera(touch)).radius<pinch.radius,'Native two-finger pinch');await touch.context().close();report.checks.push('Native Chrome touch input: one-finger orbit and two-finger pinch');
 webkit=await playwright.webkit.launch({headless:true});
 for(const [width,height] of [[375,812],[1024,768]]){
  const page=await makePage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2},'after',false,'',webkit);await activate(page);
  for(const [cell,type] of [[0,'plant'],[1,'animal']]){
   await page.locator(`[data-cell-type-switch="${type}"]`).tap();await settle(page);assert.equal((await values(page)).cell,cell,'Header tabs use the existing saved cell control');
   const sample=await layout(page);checkLayout(sample,`WebKit ${width}/${type}`);report.webkit.push({type,...sample});
   await page.locator('[data-cell-organelle="rough-er"]').tap();await settle(page);assert.equal(await page.locator('.simViewport').getAttribute('data-cell-selected'),'rough-er');
   await screenshot(page,`${type}-webkit-${width}.png`);
   await command(page,'labels');assert.equal(await page.locator('.cellHotspot:visible').count(),0);await command(page,'labels');
   await command(page,'in');await command(page,'reset');
  }
  await page.context().close();
 }
 report.checks.push('WebKit mobile/tablet: both model tabs, organelle selection, labels, zoom/reset and responsive geometry');
 const fallback=await makePage({},'after',true);await fallback.evaluate(id=>window.__SLH_QA__.open(id,'lab'),lesson);await fallback.waitForSelector('.simPanel[data-sim-view="2d"]');assert(await fallback.locator('.simDiagram').isVisible());assert(await fallback.locator('[data-sim-view="3d"]').isDisabled());
 await fallback.locator('[data-sim-control="cell"]').selectOption('1');await fallback.locator('[data-sim-control="zoom"]').fill('2');await fallback.locator('[data-sim-control="zoom"]').dispatchEvent('input');assert.deepEqual(await values(fallback),{cell:1,zoom:2});assert.equal(await fallback.locator('[data-sim-output]').innerHTML(),expected.rows.find(row=>row.cell===1&&row.zoom===2).html);await fallback.context().close();report.checks.push('Unavailable WebGL keeps the original working 2D simulation and controls');
 }
 assert.deepEqual(report.errors,[],'No JavaScript, shader, WebGL or local asset errors');report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;console.error(error.stack)}finally{
 await browser?.close();await webkit?.close();await new Promise(r=>server.close(r));await writeFile(resolve(out,modelsOnly?'cell-factory-report.json':'cell-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,scienceCases:report.scienceCases,models:report.models.length,responsive:report.responsive.length,webkit:report.webkit.length,screenshots:report.screenshots.length,errors:report.errors}));
}
