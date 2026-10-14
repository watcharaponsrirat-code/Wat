import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {models3d} from '../assets/simulations/models3d.js';

// Visual-prototype preservation contract, captured from commit 672397e before
// the plant presentation upgrade. These fixtures are independent of the new
// renderer and require neither Git history nor browser/GPU access at runtime.
// Only checkout line endings are normalized; science text and code are exact.
// A future intentional curriculum/model change must review these fixtures.
const BASELINE={
  commit:'672397e',
  sources:{
    'core':'bc5ec887de82e7d186e6c3e9667b177a1ff433d693c7765604135f896d8c4a83',
    'grade1':'3df39846bd4b0832408dc717623f16537217b4f11756c53e72cd12e2880b76e8',
    'grade2':'469b1d39a4c451cd2e002a0f4be0dd10ba9bb30e7245399b15db1781d8ec8eda',
    'grade3':'071bfbbe9194f0f394429932d050cd548e705d219fd27db3cda602e8b1acae93',
    'engine':'96bb933c7d82ba9f6862e61b0c4dfed9ac604e06bba4231cdf2cba10a2a7be9e',
    'models3d':'512bc3a16ffc558b9b7a375bf2318c12a21f287d7c2b10230dba840cbf1791bf',
    'models3d-kit':'9b729d5955ba6dcbd74c42866fe111a20e22311f063f3a9f08e25d5b0c38ea9b',
    'models3d-grade1':'649db1791b4400797ccc47395a4db41d8f2517a7bfa13f6eb95043bb63ccaf51',
    'models3d-grade2':'2c3e9e04436c7d20fe67fe5e69c4a5a711b833f7779c331e77f19526dd05ccd5',
    'models3d-grade3':'24f5028592217265e3e067ea7d1a45e800a9db05416fe1f872d248abedea1da2'
  },
  curriculumDataScript:'2972d37fd13c719bb830ec5ea58d16c865cda753d7482d30e712f07e442cee38',
  plant2d:'63c44031cfb944b0e7d3ae74c486a01036ce2d19d091383641cb627527860a46',
  plant3d:'d07cafcfbf2e01c46401e3bfc94a1b026b6458da51f66079f7579d4fb207b3a4',
  otherModels:'f45329234607f6f89c8e7dc694546ffdc2e9e186080a1daac7d069681a52eb91',
  otherModelCases:278
};
const hash=text=>createHash('sha256').update(text).digest('hex');
const source=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
const scripts={};
for(const [name,expected] of Object.entries(BASELINE.sources)){
  scripts[name]=await source('assets/simulations/'+name+'.js');
  assert.equal(hash(scripts[name]),expected,`${name}.js changed from the protected science/engine/model baseline ${BASELINE.commit}`);
}

const html=await source('index.html');
const dataScript=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>m[2].includes('window.SLH_DATA='))?.[2];
assert(dataScript,'Original curriculum data script is present');
assert.equal(hash(dataScript),BASELINE.curriculumDataScript,'Lesson IDs, curriculum and original educational data must remain unchanged');
const context=vm.createContext({window:{}});
vm.runInContext(dataScript,context);
for(const name of ['core','grade1','grade2','grade3'])vm.runInContext(scripts[name],context);
const specs=context.window.SLH_SIMULATIONS,plant=specs.G1U1L1;
assert.equal(Object.keys(specs).length,40);
assert.deepEqual(Object.keys(models3d).sort(),Object.keys(specs).sort());
assert.deepEqual(JSON.parse(JSON.stringify(plant.controls)),[
  {key:'light',label:'แสงกลุ่มทดลอง',min:0,max:12,value:6,unit:'ชั่วโมง/วัน',step:1},
  {key:'t',label:'วันทดลอง',min:0,max:14,value:0,unit:'วัน',step:1}
],'Light and timeline controls retain their exact original ranges, defaults, units and steps');

function build(id,values){
  const objects=[],kit={values:{}};
  for(const type of ['shape','mesh','sphere','litSphere','box','cylinder','ring','rod','arrow','tube','label'])kit[type]=(...args)=>objects.push({type,args});
  models3d[id](kit,values);
  return {objects,state:kit.values};
}
const plant2d=[],plant3d=[];
for(let light=0;light<=12;light++)for(let t=0;t<=14;t++){
  const values={light,t},output=plant.model(values),native=build('G1U1L1',values);
  assert(!/NaN|Infinity|undefined/.test(JSON.stringify([output,native])),`Finite output at light=${light}, day=${t}`);
  const control=t*3,experiment=t*3*Math.min(light/6,1.3);
  assert.deepEqual(native.state,{controlGrowth:control,experimentGrowth:experiment},`Original growth at light=${light}, day=${t}`);
  for(const [id,growth] of [['control',control],['experiment',experiment]]){
    const stem=native.objects.find(o=>o.type==='tube'&&o.args[0]===id+'-stem');
    assert(stem,`${id} original growth anchor is present`);
    assert(Math.abs(stem.args[1].at(-1)[1]-(-72+55+2*growth))<1e-10,'The original scientific model-to-height mapping is retained');
  }
  if(light===0)assert.equal(native.state.experimentGrowth,0,'No invented growth with zero light');
  if(light===6)assert.equal(native.state.controlGrowth,native.state.experimentGrowth,'Equal light gives equal original growth');
  if(t===0)assert.equal(native.state.controlGrowth+native.state.experimentGrowth,0,'Day zero retains equal initial growth');
  plant2d.push([values,output]);plant3d.push([values,native]);
}
assert.equal(plant2d.length,195);
assert.equal(hash(JSON.stringify(plant2d)),BASELINE.plant2d,'All 195 original 2D diagrams, summaries and numeric metrics are exact');
assert.equal(hash(JSON.stringify(plant3d)),BASELINE.plant3d,'All 195 original model endpoints, data values and labels are exact');

// Other lessons must not inherit the high-fidelity plant presentation or new
// scientific behavior through a changed shared model helper.
const otherModels=[],otherLessonIds=[];
for(const [id,spec] of Object.entries(specs)){
  if(id==='G1U1L1')continue;
  otherLessonIds.push(id);
  const initial=Object.fromEntries(spec.controls.map(c=>[c.key,c.value]));
  otherModels.push([id,initial,build(id,initial)]);
  for(const control of spec.controls){
    const candidates=control.options?control.options.map((_,i)=>i):[control.min,control.value,control.max];
    for(const value of candidates){
      const values={...initial,[control.key]:value};
      otherModels.push([id,values,build(id,values)]);
    }
  }
}
assert.equal(otherLessonIds.length,39);
assert.equal(otherModels.length,BASELINE.otherModelCases);
assert.equal(hash(JSON.stringify(otherModels)),BASELINE.otherModels,'Other 39 native models retain every baseline object, label and data value at all tested control boundaries');

console.log({
  baseline:BASELINE.commit,
  protectedSources:Object.keys(BASELINE.sources).length,
  curriculum:'unchanged',
  plantInputPairs:plant2d.length,
  otherLessons:otherLessonIds.length,
  otherModelCases:otherModels.length,
  checks:['exact original controls and science sources','all 195 original 2D outputs','all 195 original 3D endpoint snapshots','zero-light, equal-light and initial-day invariants','39 other model builders unchanged'],
  note:'Rendering, animation, touch interaction and adaptive quality require the separate browser test.'
});
