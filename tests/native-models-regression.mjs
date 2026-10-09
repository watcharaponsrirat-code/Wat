import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {models3d} from '../assets/simulations/models3d.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const context=vm.createContext({window:{}});
const dataScript=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('window.SLH_DATA='));
vm.runInContext(dataScript[2],context);
for(const name of ['core','grade1','grade2','grade3'])vm.runInContext(await readFile(new URL('../assets/simulations/'+name+'.js',import.meta.url),'utf8'),context);
const specs=context.window.SLH_SIMULATIONS;assert.deepEqual(Object.keys(models3d).sort(),Object.keys(specs).sort());
function build(id,overrides={}){
 const spec=specs[id],values=Object.fromEntries(spec.controls.map(c=>[c.key,c.value]));Object.assign(values,overrides);
 const objects=[];const kit={values:{}};
 for(const type of ['shape','mesh','sphere','litSphere','box','cylinder','ring','rod','arrow','tube','label'])kit[type]=(...args)=>{objects.push({type,args})};
 models3d[id](kit,values);
 function finite(value){if(typeof value==='number')assert(Number.isFinite(value),id+' nonfinite');else if(value&&typeof value==='object')Object.values(value).forEach(finite)}
 finite(objects);finite(kit.values);assert(objects.length>2,id+' needs a distinct scene');
 return {objects,state:kit.values};
}
let variations=0;
for(const [id,spec] of Object.entries(specs)){
 build(id);
 for(const c of spec.controls){const candidates=c.options?c.options.map((_,i)=>i):[c.min,c.value,c.max];const outputs=candidates.map(value=>{variations++;return JSON.stringify(build(id,{[c.key]:value}))});assert(new Set(outputs).size>1,id+'/'+c.key+' must affect the model')}
}
const float=build('G1U2L1',{m:50,vol:100}).state;assert.equal(float.submergedFraction,.5);assert(Math.abs((float.cubeY-float.side/2)-(float.waterSurface-float.side*.5))<1e-9);
assert.equal(build('G1U2L1',{m:100,vol:100}).state.submergedFraction,1);
assert.equal(build('G1U2L2',{kind:2,count:6}).state.atoms,18);
assert.equal(build('G1U2L2',{kind:3,count:2}).state.atoms,6);
assert.equal(build('G1U3L2',{mode:0,difference:40,t:100}).state.left+build('G1U3L2',{mode:0,difference:40,t:100}).state.right,45);
assert.equal(build('G1U3L2',{mode:1,difference:40,t:100}).state.left,40);
assert.equal(build('G1U5L1',{q:334}).state.temperature,0);assert.equal(build('G1U5L1',{q:3012}).state.vapor,1);
assert.equal(build('G2U2L1',{temp:20,solute:50}).state.dissolved,30);
assert.equal(build('G2U2L1',{temp:20,solute:50}).state.solid,20);
assert(build('G2U3L2',{inhale:100}).state.lungVolumeIndex>build('G2U3L2',{inhale:0}).state.lungVolumeIndex);
assert(build('G2U3L2',{inhale:100}).state.diaphragmY<build('G2U3L2',{inhale:0}).state.diaphragmY);
assert.equal(build('G2U4L2',{right:10,left:5,mass:5,t:2}).state.displacement,2);
assert.equal(build('G2U5L2',{height:20,t:25}).state.potential+build('G2U5L2',{height:20,t:25}).state.kinetic,200);
assert.equal(build('G3U2L1',{p1:1,p2:1}).state.Aa,50);
assert.equal(build('G3U3L2',{pair:2,angle:80}).state.totalInternalReflection,true);
for(const [angle,fraction] of [[0,0],[90,.5],[180,1],[270,.5],[360,0]])assert(Math.abs(build('G3U4L1',{angle}).state.illuminatedFraction-fraction)<1e-10);
assert.equal(build('G3U5L1',{closed:0,t:100}).state.reading,100);
assert.equal(build('G3U5L1',{closed:1,t:100}).state.reading,90);
assert.equal(build('G3U6L1',{kind:0,voltage:6,r:10,on:1}).state.current,.3);
assert.equal(build('G3U6L1',{kind:1,voltage:6,r:10,on:1}).state.current,1.2);
assert.equal(build('G3U6L1',{on:0}).state.current,0);
assert.equal(build('G3U6L2',{power:1000,hours:2}).state.energy,2);

// Semantic landmarks prevent an organ from regressing to anonymous oval primitives.
for(const key of ['torso','bodyOutline','rightLung','leftLung','trachea','diaphragm'])assert(build('G2U3L2').objects.some(o=>o.args[0]===key),'Missing respiratory landmark '+key);
assert.equal(build('G2U3L2',{inhale:0}).objects.filter(o=>o.args[0]==='air').length,0);
assert.equal(build('G2U3L2',{inhale:100}).objects.filter(o=>o.args[0]==='air').length,0);
assert(build('G2U3L2',{inhale:50}).objects.some(o=>o.type==='arrow'&&o.args[0]==='air'));
for(const [id,landmark] of [['G2U3L1','heartWall'],['G2U3L3','kidney'],['G2U3L5','uterusWall'],['G3U2L1','punnettBoard']])assert(build(id).objects.some(o=>o.args[0]===landmark));
assert(!build('G2U3L5',{day:28}).objects.some(o=>o.args[0]==='ovum'),'Do not depict a surviving egg throughout the cycle');
for(const kind of [0,1]){
 const objects=build('G3U6L1',{kind}).objects,bulbs=kind?[[60,-100],[60,35]]:[[-60,-100],[120,-100]];
 for(const [x,z] of bulbs)for(const o of objects.filter(o=>o.type==='rod')){
  const [,a,b]=o.args;if(Math.abs(a[1]+92)<.01&&Math.abs(b[1]+92)<.01&&Math.abs(a[2]-z)<.01&&Math.abs(b[2]-z)<.01)assert(!(Math.min(a[0],b[0])<x-10&&Math.max(a[0],b[0])>x+10),'Wire must not bypass lamp terminals');
 }
}

console.log({nativeModels:Object.keys(models3d).length,variations,checks:'finite geometry, every control affects scene, density, conservation, anatomy relationships, optics, moon phases, genetics, circuits and energy'});
