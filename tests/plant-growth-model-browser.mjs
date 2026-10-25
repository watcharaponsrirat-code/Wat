import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';

// A focused model regression suite. The original science builder supplies every
// input; the previous production model supplies the locked pot/soil baseline.
// Run with plant-growth-regression.mjs for its independent, pinned science,
// curriculum and engine invariants. Unrelated repository changes are reported
// below, but do not invalidate these behavioral and resource lifecycle checks.
const baseline='e003c5f', root=resolve('.'), out=resolve('tmp/plant-botanical-master');
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=require('../tmp/browser-check/playwright/driver/package')}
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024}).toString('utf8');
const changed=[...new Set([
  ...git('diff',baseline,'--name-only','-z').split('\0'),
  ...git('ls-files','--others','--exclude-standard','-z').split('\0')
].filter(Boolean))].sort();
await mkdir(out,{recursive:true});
const baselineSource=git('show',`${baseline}:assets/simulations/plant-growth-model.js`);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.writeHead(200,{'Content-Type':mime['.html']});return res.end('<!doctype html><html><body style="margin:0"></body></html>')}
  if(pathname==='/favicon.ico'){res.writeHead(204);return res.end()}
  if(pathname==='/assets/simulations/__baseline-plant-growth-model.js'){res.writeHead(200,{'Content-Type':mime['.js']});return res.end(baselineSource)}
  const path=resolve(root,decodeURIComponent(pathname).replace(/^\//,''));
  if(!path.startsWith(root+sep))throw Error('Outside root');
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const errors=[];
try{
  browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'||/WebGL.*(?:INVALID|shader|program)|THREE\.WebGLProgram/i.test(message.text()))errors.push(message.text())});
  page.on('response',response=>{if(response.status()>=400)errors.push(`HTTP ${response.status()} ${response.url()}`)});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const report=await page.evaluate(async()=>{
    const T=await import('/assets/vendor/three/three.module.js');
    const {createPlantGrowthModel}=await import('/assets/simulations/plant-growth-model.js');
    const {createPlantGrowthModel:createBaseline}=await import('/assets/simulations/__baseline-plant-growth-model.js');
    const {ModelKit}=await import('/assets/simulations/models3d-kit.js');
    const {models3d}=await import('/assets/simulations/models3d.js');
    const checks=[],metrics={combinations:{high:0,low:0},renderedStates:0,geometryChecks:0,morphAttributes:0,disposedResources:0};
    const ok=(condition,message)=>{if(!condition)throw Error(message)};
    const near=(a,b,message,tolerance=1e-5)=>ok(Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
    const hash=array=>{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=2166136261;for(const byte of bytes){h^=byte;h=Math.imul(h,16777619)}return (h>>>0).toString(16)};
    const textureSignature=texture=>{
      const source=texture.image;let pixels=null;
      if(source?.getContext)pixels=hash(source.getContext('2d').getImageData(0,0,source.width,source.height).data);
      else if(source?.data)pixels=hash(source.data);
      return {width:source?.width,height:source?.height,pixels,colorSpace:texture.colorSpace,wrapS:texture.wrapS,wrapT:texture.wrapT,magFilter:texture.magFilter,minFilter:texture.minFilter,anisotropy:texture.anisotropy,flipY:texture.flipY};
    };
    const materialSignature=material=>{
      const values={type:material.type};
      for(const [key,value] of Object.entries(material)){
        if(['id','uuid','version','name','userData'].includes(key))continue;
        if(value===null||['string','number','boolean'].includes(typeof value))values[key]=value;
        else if(value?.isColor)values[key]=value.toArray();
        else if(value?.isVector2||value?.isVector3)values[key]=value.toArray();
        else if(value?.isTexture)values[key]=textureSignature(value);
      }
      return values;
    };
    const attributeSignature=attribute=>({itemSize:attribute.itemSize,normalized:attribute.normalized,data:hash(attribute.array)});
    const geometrySignature=geometry=>({index:geometry.index&&hash(geometry.index.array),attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([key,attribute])=>[key,attributeSignature(attribute)])),morphTargetsRelative:geometry.morphTargetsRelative,morphAttributes:Object.fromEntries(Object.entries(geometry.morphAttributes).map(([key,attributes])=>[key,attributes.map(attributeSignature)]))});
    const lockedSignature=model=>{
      const result=[];model.group.traverse(object=>{
        if(!['terracotta-pot','textured-soil','soil-grains'].includes(object.name))return;
        result.push({plant:object.parent.name,part:object.name,geometry:geometrySignature(object.geometry),material:materialSignature(object.material),matrix:object.matrix.toArray(),count:object.count,instances:object.instanceMatrix&&hash(object.instanceMatrix.array),colors:object.instanceColor&&hash(object.instanceColor.array)});
      });return JSON.stringify(result);
    };
    const scene=new T.Scene(), renderer=new T.WebGLRenderer({antialias:true});
    renderer.setSize(1100,800);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
    scene.add(new T.HemisphereLight(0xe8f6ff,0x3e352a,1.2));
    const light=new T.DirectionalLight(0xffedc8,2.4);light.position.set(-150,250,180);scene.add(light);
    const camera=new T.PerspectiveCamera(40,1100/800,1,3000);camera.position.set(30,130,670);camera.lookAt(0,-20,0);
    const model=createPlantGrowthModel(scene),baseline=createBaseline(new T.Group());
    const originals=new T.Group(),kit=new ModelKit(originals);
    const ids=['control','experiment'],parts=id=>{
      const plant=model.group.getObjectByName(`${id}-detailed-plant`);
      return {plant,stem:plant.getObjectByName('tapered-stem'),leaves:plant.getObjectByName('curved-leaves'),stalks:plant.getObjectByName('leaf-petioles')};
    };
    const resources=new Map(),observe=resource=>{
      if(resource?.addEventListener&&!resources.has(resource)){resources.set(resource,0);resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1))}
    };
    const collect=()=>{
      const objects=[];model.group.traverse(object=>{
        objects.push(object.uuid);if(object.isMesh)observe(object.geometry);if(object.isInstancedMesh)observe(object);
        for(const material of (Array.isArray(object.material)?object.material:[object.material]).filter(Boolean)){
          observe(material);for(const value of Object.values(material))if(value?.isTexture)observe(value);
        }
        if(object.morphTexture)observe(object.morphTexture);
      });return objects.join(',');
    };
    const checkGeometry=()=>{
      model.group.traverse(object=>{
        if(!object.isMesh)return;const geometry=object.geometry;
        for(const [name,attribute] of Object.entries(geometry.attributes))ok(Array.from(attribute.array).every(Number.isFinite),`${object.name} finite ${name}`);
        for(const attributes of Object.values(geometry.morphAttributes))for(const attribute of attributes){ok(Array.from(attribute.array).every(Number.isFinite),`${object.name} finite morph attributes`);metrics.morphAttributes++}
        if(!['terracotta-pot','textured-soil','soil-grains'].includes(object.name)&&geometry.attributes.normal){
          const normal=geometry.attributes.normal;
          for(let i=0;i<normal.count;i++){const length=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));near(length,1,`${object.name} unit vertex normal`,.005)}
        }
        const positions=geometry.attributes.position;
        if(geometry.index)for(const value of geometry.index.array)ok(value>=0&&value<positions.count,`${object.name} valid geometry index`);
        metrics.geometryChecks++;
      });
    };
    const endpoint=(id,growth,original)=>{
      const {plant,stem,leaves,stalks}=parts(id),height=original?original.tip-original.base:55+2*growth;
      near(plant.userData.visualHeight,height,`${id} exact original visual height`);
      near(plant.userData.growth,growth,`${id} current target state`);
      near(model.group.userData.growth[id+'Growth'],growth,`${id} settled growth`);
      const count=original?.leaves??4;
      ok(leaves.isInstancedMesh&&leaves.count===count&&stalks.count===count,`${id} preserves original leaf nodes`);
      const positions=stem.geometry.attributes.position;
      let base=false,tip=false;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);ok(Number.isFinite(x+y+z),`${id} finite animated stem`);
        if(Math.hypot(x,z)<1e-5){base||=Math.abs(y+72)<1e-5;tip||=Math.abs(y-(-72+height))<1e-5}
      }
      ok(base&&tip,`${id} actual geometry contains original root and apex endpoint`);
    };
    const allBounds={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity,back:Infinity,front:-Infinity};
    const actualBounds=()=>{
      model.group.updateMatrixWorld(true);
      const instance=new T.Matrix4(),world=new T.Matrix4(),vertex=new T.Vector3(),normal=new T.Vector3();
      const bounds={left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity,back:Infinity,front:-Infinity};
      for(const id of ids){
        const {plant}=parts(id);
        plant.traverseVisible(object=>{
          if(!object.isMesh||['terracotta-pot','textured-soil','soil-grains'].includes(object.name))return;
          const geometry=object.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal;
          const morphPositions=geometry.morphAttributes.position||[],morphNormals=geometry.morphAttributes.normal||[];
          const target={morphTargetInfluences:new Array(morphPositions.length).fill(0)};
          for(let n=0;n<(object.isInstancedMesh?object.count:1);n++){
            if(object.isInstancedMesh){object.getMatrixAt(n,instance);world.multiplyMatrices(object.matrixWorld,instance)}else world.copy(object.matrixWorld);
            if(object.morphTexture)object.getMorphAt(n,target);
            const weights=target.morphTargetInfluences,base=geometry.morphTargetsRelative?1:1-weights.reduce((a,b)=>a+b,0);
            for(let i=0;i<positions.count;i++){
              vertex.fromBufferAttribute(positions,i).multiplyScalar(base);
              if(normals)normal.fromBufferAttribute(normals,i).multiplyScalar(base);
              for(let j=0;j<weights.length;j++)if(weights[j]){
                const attribute=morphPositions[j];vertex.x+=attribute.getX(i)*weights[j];vertex.y+=attribute.getY(i)*weights[j];vertex.z+=attribute.getZ(i)*weights[j];
                if(morphNormals[j]){const attribute=morphNormals[j];normal.x+=attribute.getX(i)*weights[j];normal.y+=attribute.getY(i)*weights[j];normal.z+=attribute.getZ(i)*weights[j]}
              }
              if(normals)ok(Number.isFinite(normal.lengthSq())&&normal.lengthSq()>.01,`${object.name} blended morph normal is usable`);
              vertex.applyMatrix4(world);vertex.x-=plant.position.x;
              bounds.left=Math.min(bounds.left,vertex.x);bounds.right=Math.max(bounds.right,vertex.x);bounds.bottom=Math.min(bounds.bottom,vertex.y);bounds.top=Math.max(bounds.top,vertex.y);bounds.back=Math.min(bounds.back,vertex.z);bounds.front=Math.max(bounds.front,vertex.z);
            }
          }
        });
      }
      ok(bounds.left>=-92&&bounds.right<=92&&bounds.bottom>=-130&&bounds.top<=106&&bounds.back>=-70&&bounds.front<=70,`Actual morphed botanical mesh fits unchanged camera envelope: ${JSON.stringify(bounds)}`);
      for(const key of ['left','bottom','back'])allBounds[key]=Math.min(allBounds[key],bounds[key]);
      for(const key of ['right','top','front'])allBounds[key]=Math.max(allBounds[key],bounds[key]);
    };
    const mapping=[];
    for(let light=0;light<=12;light++)for(let t=0;t<=14;t++){
      kit.begin();models3d.G1U1L1(kit,{light,t});kit.end();
      const expected=Object.fromEntries(ids.map(id=>{const [points]=JSON.parse(kit.items.get(id+'-stem').signature);return [id,{base:points[0][1],tip:points.at(-1)[1],leaves:[...kit.active].filter(key=>key.startsWith(id+'-leaf')).length}]}));
      mapping.push({light,t,values:{...kit.values},expected});
    }
    const budgets=[];
    for(const quality of ['high','low']){
      model.setQuality(quality);baseline.setQuality(quality);
      ok(lockedSignature(model)===lockedSignature(baseline),`${quality} pot, soil, grains, materials and transforms identical to previous release`);
      model.update(mapping[0].values);model.tick(.016,true);
      const stableObjects=collect(),stableResources=resources.size;
      const control=parts('control'),experiment=parts('experiment');
      ok(control.leaves.geometry===experiment.leaves.geometry,'Both groups share master leaf geometry');
      ok(control.leaves.material===experiment.leaves.material,'Both groups share immutable leaf material');
      ok(control.stem.geometry!==experiment.stem.geometry,'Each group owns its deformable stem');
      ok(control.leaves.instanceMatrix!==experiment.leaves.instanceMatrix,'Leaf pose state is independent');
      ok(control.leaves.morphTexture&&experiment.leaves.morphTexture&&control.leaves.morphTexture!==experiment.leaves.morphTexture,'Leaf morph state exists and is independent');
      for(const {plant,leaves} of [control,experiment]){
        const ribs=plant.getObjectByName('raised-leaf-veins'),poses=[];
        ok(leaves.geometry.morphAttributes.position?.length===2&&leaves.geometry.morphAttributes.normal?.length===2,'Individual leaves retain both sculpted shape variations');
        ok(ribs.geometry.morphAttributes.position?.length===2&&ribs.geometry.morphAttributes.normal?.length===2,'Midribs follow both blade shape variations');
        for(let i=0;i<leaves.count;i++){
          const leafShape={morphTargetInfluences:[0,0]},ribShape={morphTargetInfluences:[0,0]};
          leaves.getMorphAt(i,leafShape);ribs.getMorphAt(i,ribShape);
          const weights=leafShape.morphTargetInfluences;
          ok(weights.every(value=>Number.isFinite(value)&&value>=0)&&weights.reduce((a,b)=>a+b,0)<=1,'Leaf shapes remain within the sculpted master envelope');
          ok(JSON.stringify(weights)===JSON.stringify(ribShape.morphTargetInfluences),'Each midrib follows its own leaf shape');
          poses.push(JSON.stringify(weights));
        }
        ok(new Set(poses).size===leaves.count,'Each leaf has an individual shape');
      }
      const {map,normalMap,roughnessMap}=control.leaves.material;
      ok(map&&normalMap&&roughnessMap&&new Set([map,normalMap,roughnessMap]).size===3,'Pigment, surface relief and wax roughness use separate maps');
      ok(map.colorSpace===T.SRGBColorSpace&&normalMap.colorSpace===T.NoColorSpace&&roughnessMap.colorSpace===T.NoColorSpace,'Surface maps use the correct color spaces');
      for(const texture of [map,normalMap,roughnessMap])ok(texture.image?.data&&texture.generateMipmaps&&texture.minFilter===T.LinearMipmapLinearFilter,'Leaf surface detail stays filtered when viewed from a distance');
      checkGeometry();
      for(const row of mapping){
        model.update(row.values);model.tick(.016,true);
        endpoint('control',row.values.controlGrowth,row.expected.control);endpoint('experiment',row.values.experimentGrowth,row.expected.experiment);
        actualBounds();
        ok(collect()===stableObjects,'No objects allocated during a growth update');
        ok(resources.size===stableResources,'No geometry, material or texture allocated during a growth update');
        if([0,6,12].includes(row.light)&&[0,7,14].includes(row.t)){renderer.render(scene,camera);metrics.renderedStates++}
        metrics.combinations[quality]++;
      }
      checkGeometry();renderer.render(scene,camera);
      budgets.push({quality,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
      ok(renderer.info.render.calls<=24,`${quality} model draw calls remain bounded`);
      ok(renderer.info.render.triangles<=(quality==='low'?55000:110000),`${quality} model triangle budget`);
      const prior=control.stem.geometry.attributes.position.array.slice(),priorPose=hash(control.leaves.instanceMatrix.array),priorMorph=control.leaves.morphTexture&&hash(control.leaves.morphTexture.image.data);
      model.update({controlGrowth:42,experimentGrowth:0});model.tick(.016,true);
      ok(hash(prior)===hash(control.stem.geometry.attributes.position.array),'Changing experimental group leaves control geometry unchanged');
      ok(priorPose===hash(control.leaves.instanceMatrix.array),'Changing experimental group leaves control pose unchanged');
      if(priorMorph)ok(priorMorph===hash(control.leaves.morphTexture.image.data),'Changing experimental group leaves control morph state unchanged');
      endpoint('control',42);endpoint('experiment',0);
    }
    ok(budgets[1].triangles<budgets[0].triangles*.8,'Mobile quality substantially reduces geometry');
    model.update({controlGrowth:0,experimentGrowth:0});model.tick(.016,true);
    model.update({controlGrowth:42,experimentGrowth:54.6});
    const samples=[];let moving=true;
    for(let frame=0;moving&&frame<300;frame++){moving=model.tick(1/60);samples.push({...model.group.userData.growth})}
    ok(samples.length>1&&samples.length<300,'Animation converges');
    ok(samples.some(sample=>sample.controlGrowth>0&&sample.controlGrowth<42),'Intermediate growth is visible');
    for(let i=1;i<samples.length;i++)for(const key of ['controlGrowth','experimentGrowth'])ok(samples[i][key]>=samples[i-1][key],`Monotonic animation ${key}`);
    endpoint('control',42);endpoint('experiment',54.6);
    const matrixHash=hash(parts('control').leaves.instanceMatrix.array);
    model.update({controlGrowth:0,experimentGrowth:0});model.tick(.016,true);
    model.update({controlGrowth:42,experimentGrowth:54.6});model.tick(.016,true);
    ok(hash(parts('control').leaves.instanceMatrix.array)===matrixHash,'Deterministic pose after reset');
    renderer.render(scene,camera);
    const retainedGPU={...renderer.info.memory};
    const originalLeafMaps=['map','normalMap','roughnessMap'].map(key=>parts('control').leaves.material[key]);
    const originalLeafSignatures=originalLeafMaps.map(texture=>JSON.stringify(textureSignature(texture)));
    const repeat=createPlantGrowthModel(scene,{quality:'low'});
    repeat.update({controlGrowth:42,experimentGrowth:54.6});repeat.tick(.016,true);
    const repeated=repeat.group.getObjectByName('control-detailed-plant').getObjectByName('curved-leaves');
    ok(JSON.stringify(geometrySignature(repeated.geometry))===JSON.stringify(geometrySignature(parts('control').leaves.geometry)),'Deterministic master geometry between lifecycles');
    ok(JSON.stringify(materialSignature(repeated.material))===JSON.stringify(materialSignature(parts('control').leaves.material)),'Deterministic botanical textures and materials');
    for(const [index,key] of ['map','normalMap','roughnessMap'].entries()){
      const texture=repeated.material[key],original=originalLeafMaps[index];
      ok(texture!==original&&texture.source!==original.source,'Each lifecycle owns its leaf texture and source');
      ok(texture.image.data.buffer!==original.image.data.buffer,'Each lifecycle owns its leaf pixel buffer');
    }
    renderer.render(scene,camera);
    ok(renderer.info.memory.textures>retainedGPU.textures,'Both model lifecycles upload their own textures');
    repeat.dispose();repeat.dispose();
    for(const count of resources.values())ok(count===0,'Disposing another lifecycle does not dispose the active model resources');
    for(const [index,texture] of originalLeafMaps.entries())ok(JSON.stringify(textureSignature(texture))===originalLeafSignatures[index],'Disposing another lifecycle preserves active leaf pixels and settings');
    renderer.render(scene,camera);
    ok(renderer.info.memory.geometries===retainedGPU.geometries&&renderer.info.memory.textures===retainedGPU.textures,'Disposing one rendered model releases only its own GPU resources');
    model.setQuality('high');collect();model.setQuality('low');collect();checkGeometry();
    const tracked=resources.size;model.dispose();model.dispose();
    ok(!model.group.parent,'Disposed model is detached');
    for(const [resource,count] of resources)ok(count===1,`${resource.type||resource.constructor.name} disposed exactly once (${count})`);
    metrics.disposedResources=tracked;
    model.update({controlGrowth:0,experimentGrowth:0});ok(model.tick(.016)===false,'Disposed animation remains inactive');model.setQuality('high');
    renderer.render(scene,camera);ok(renderer.info.memory.geometries===0,'All uploaded model geometries released');ok(renderer.info.memory.textures===0,'All uploaded model textures released');
    const remount=createPlantGrowthModel(scene,{quality:'low'});
    remount.update({controlGrowth:42,experimentGrowth:54.6});remount.tick(.016,true);
    const remountedMaterial=remount.group.getObjectByName('control-detailed-plant').getObjectByName('curved-leaves').material;
    for(const [index,key] of ['map','normalMap','roughnessMap'].entries())ok(JSON.stringify(textureSignature(remountedMaterial[key]))===originalLeafSignatures[index],'Remount after full disposal preserves botanical textures');
    renderer.render(scene,camera);ok(renderer.info.memory.textures>0&&renderer.info.render.calls>0,'Remount after full disposal uploads textures and renders');
    remount.dispose();remount.dispose();renderer.render(scene,camera);
    ok(renderer.info.memory.geometries===0&&renderer.info.memory.textures===0,'Remounted model also releases all GPU geometry and textures');
    baseline.dispose();kit.dispose();renderer.dispose();
    checks.push('195 original science pairs in each quality level; exact height, four leaves and independent group data','Locked pots, soil and grains match previous release geometry/material/texture/instance data','Finite indexed geometry, unit base normals and finite morph targets','Shared master resources; independent dynamic pose/morph state; stable resources during updates','Monotonic growth animation, exact endpoints and deterministic reset/recreation','Low-detail geometry budget and actual WebGL rendering','Independent leaf texture and pixel ownership across simultaneously rendered lifecycles','Disposal isolation and successful remount after all model GPU resources are released','Idempotent disposal including morph textures and zero retained GPU geometry/textures');
    return {checks,metrics,budgets,botanicalBounds:allBounds,animationFrames:samples.length};
  });
  assert.deepEqual(errors,[],'No browser/WebGL/runtime errors');
  const result={baseline,changed,...report,errors,limitations:['Headless Chrome is not a physical-device performance or Safari test.','This focused test complements the full simulation interaction/browser suite.']};
  await writeFile(resolve(out,'model-browser-report.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
