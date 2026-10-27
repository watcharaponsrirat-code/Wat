import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/dashboard/dashboard.js',import.meta.url),'utf8');
function harness({saveData=false,fail=false}={}) {
  const images=[];
  class Image {
    constructor(){images.push(this);}
    decode(){return fail?Promise.reject(Error('artwork unavailable')):Promise.resolve();}
  }
  const context={Image,window:{navigator:{connection:{saveData}}}};
  vm.runInNewContext(source,context);
  return {api:context.window.SLH_DASHBOARD,images};
}

test('warmup starts only once on request and loads only six public dashboard pictures', async()=>{
  const {api,images}=harness();
  assert.equal(images.length,0);
  assert.equal(api.prepare(),undefined,'login never waits for image decoding');
  api.prepare();
  assert.equal(images.length,6);
  assert.equal(new Set(images.map(i=>i.src)).size,6);
  assert(images.every(i=>/^assets\/dashboard\/[a-z-]+-v1\.webp$/.test(i.src)&&i.fetchPriority==='low'&&i.decoding==='async'));
});

test('warmup respects data saver and image failures do not escape', async()=>{
  const saving=harness({saveData:true});saving.api.prepare();assert.equal(saving.images.length,0);
  const failing=harness({fail:true});assert.doesNotThrow(()=>failing.api.prepare());
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(failing.images.length,6);
});

test('staff renders the shared header without reading learner progress or constructing learner UI',()=>{
  const {api}=harness();
  const ctx={staffView:true,getProgress(){throw Error('must not read learner progress');},get stats(){throw Error('must not calculate learner stats');}};
  const html=api.render(ctx);
  assert(html.includes('class="dashHeader"'));assert(html.includes('data-action="logout"'));
  assert(!/dashHud|dashMain|dashNav|dashExerciseDialog|student-welcome/.test(html));
  api.attach({querySelector(){throw Error('must not attach learner listeners');}},ctx);
});
