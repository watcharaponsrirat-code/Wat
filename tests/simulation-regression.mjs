import assert from 'node:assert/strict';
import {harness} from './exercise-regression.mjs';

let h=harness();
const specs=h.context.window.SLH_SIMULATIONS;
assert.equal(Object.keys(specs).length,40);
let variations=0;
for(const id of h.qa.lessonIds){
  const spec=specs[id],engine=h.context.window.SLH_SIM_ENGINE;
  assert(spec,id+' has a simulation');
  assert(spec.topics.length&&spec.hint&&spec.assumption);
  assert.equal(new Set(spec.controls.map(c=>c.key)).size,spec.controls.length);
  const initial=engine.values(spec);
  const baseline=spec.model(initial);
  assert(baseline.summary&&baseline.svg);
  for(const control of spec.controls){
    const candidates=control.options?control.options.map((_,i)=>i):[control.min,control.value,control.max];
    const outputs=candidates.map(value=>{
      const result=spec.model({...initial,[control.key]:value});
      assert(!/NaN|Infinity|undefined/.test(JSON.stringify(result)),id+'/'+control.key);
      assert(!/<script|onload=|onerror=/.test(result.svg));
      variations++;
      return JSON.stringify(result);
    });
    assert(new Set(outputs).size>1,id+'/'+control.key+' changes the model');
  }
  // Exercise controls through their actual input/change handlers.
  h.qa.reset(id);h.qa.open(id,'lab');
  assert(!h.markup.includes('<textarea'));
  assert(!h.markup.includes('data-lab-check'));
  assert(h.markup.includes('ไม่มีคะแนนหรือเกณฑ์ผ่าน'));
  for(const control of spec.controls){
    const element=h.find('[data-sim-control="'+control.key+'"]');
    const value=control.options?control.options.length-1:control.max;
    element.value=String(value);
    element.listeners[control.options?'change':'input']({target:element});
    assert.equal(h.qa.snapshot(id).simulation[id].values[control.key],value);
  }
  let p=h.qa.snapshot(id);
  assert.equal(p.lab.done,false);assert.equal(p.xp,0);
  assert.equal(p.simulation[id].explored,true);
  const saved=JSON.stringify(p.simulation[id].values);
  h.click('[data-stage="g1"]');h.click('[data-stage="lab"]');
  assert.equal(JSON.stringify(h.qa.snapshot(id).simulation[id].values),saved);
  h=harness(h.storage);h.qa.open(id,'lab');
  assert.equal(JSON.stringify(h.qa.snapshot(id).simulation[id].values),saved);
  h.click('[data-sim-reset]');
  assert.equal(JSON.stringify(h.qa.snapshot(id).simulation[id].values),JSON.stringify(initial));
  assert.equal(h.qa.snapshot(id).xp,0);
}

// Check quantitative relationships independently of drawing output.
const model=(id,v)=>specs[id].model({...h.context.window.SLH_SIM_ENGINE.values(specs[id]),...v});
assert.equal(model('G1U2L1',{m:100,vol:100}).metrics[0][1],'1 กรัม/ซม.³');
assert.equal(model('G2U2L2',{m:10,water:90}).metrics[1][1],'10%');
assert.equal(model('G2U4L2',{right:10,left:0,mass:2,t:2}).metrics[2][1],'10 m');
assert.equal(model('G2U5L2',{height:10,t:50}).metrics[0][1],'50 J');
assert.equal(model('G2U5L2',{height:10,t:50}).metrics[1][1],'50 J');
assert.equal(model('G3U2L1',{p1:1,p2:1}).metrics[1][1],'50%');
assert.equal(model('G3U3L2',{pair:2,angle:60}).metrics[1][1],'สะท้อนกลับหมด');
assert.equal(model('G3U4L1',{angle:0}).metrics[0][1],'0%');
assert.equal(model('G3U4L1',{angle:180}).metrics[0][1],'100%');
assert.equal(model('G3U6L1',{kind:0,voltage:6,r:10,on:1}).metrics[0][1],'0.3 A');
assert.equal(model('G3U6L1',{kind:1,voltage:6,r:10,on:1}).metrics[0][1],'1.2 A');
assert.equal(model('G3U6L1',{on:0}).metrics[0][1],'0 A');
assert.equal(model('G3U6L2',{power:1000,hours:2}).metrics[0][1],'2 kWh');

const id=h.qa.lessonIds[0];h.qa.open(id,'lab');
const entry=[...h.storage].find(([k])=>k.endsWith('_'+id));
assert(entry);
const legacy=JSON.parse(entry[1]);legacy.lab={done:true,text:'ข้อสรุปเดิม',evidence:'หลักฐานเดิม'};legacy.xp=250;
h.storage.set(entry[0],JSON.stringify(legacy));h=harness(h.storage);h.qa.open(id,'lab');
assert.equal(h.qa.snapshot(id).lab.text,'ข้อสรุปเดิม');assert.equal(h.qa.snapshot(id).lab.done,true);
assert.equal(h.qa.snapshot(id).xp,250);
console.log({lessons:40,variations,checks:['topic-specific models','every control changes output','valid boundary output','no answers, grading or XP','saved controls survive navigation and reload','reset','quantitative examples','legacy work preserved']});
