import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
const context=vm.createContext({window:{}});
for(const block of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  const src=block[1].match(/src="([^"]+)"/);
  if(src&&/^assets\/(exercises\/(bank|grade[123])|exams\/)/.test(src[1]))vm.runInContext(await readFile(new URL(src[1],root),'utf8'),context,{filename:src[1]});
  else if(block[2].startsWith('window.SLH_DATA='))vm.runInContext(block[2],context);
}
const api=context.window.SLH_FINAL_EXAMS,data=context.window.SLH_DATA;
const excluded=new Set(['G3U3L1S6','G3U3L2S7']);
let seed=20261006;
function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const report=[];let forms=0;
assert.equal(Object.keys(api.bank).length,40);
const globalIds=new Set();
for(const [id,qs] of Object.entries(api.bank)){
  const codes=data.packs[id].filter(s=>!excluded.has(s.code)).map(s=>s.code);
  assert.equal(qs.length,20,id);
  assert.equal(new Set(qs.map(q=>q.q)).size,20,id+' duplicate stem');
  const practice=new Set([...context.window.SLH_EXERCISES.basic(id),...context.window.SLH_EXERCISES.apply(id)].map(q=>q.q));
  for(const q of qs){
    assert(!globalIds.has(q.id));globalIds.add(q.id);
    assert(!practice.has(q.q),q.id+' duplicates practice');
    assert(!excluded.has(q.code),q.id+' assesses optional enrichment');
    assert.equal(q.opts.length,4);assert.equal(new Set(q.opts).size,4);
    assert(q.opts.includes(q.correct));assert(q.why.trim().length>=5,q.id+' missing explanation');
    assert(!q.opts.some(o=>o.includes(' | ')),q.id+' matching shortcut');
    assert(!q.q.includes('ข้อมูล A:'),q.id+' old template');
  }
  const blueprint=api.blueprints[id];
  for(const code of codes)assert(blueprint.topics[code]>0,id+' uncovered core '+code);
  assert(blueprint.skills.analyze>=4,id+' needs evidence/reasoning');
  assert(blueprint.skills.apply>=4,id+' needs application');
  const keyPositions=new Set();
  const original=JSON.stringify(qs);
  for(let i=0;i<100;i++){
    const attempt=api.build(id,shuffle);forms++;
    assert.equal(attempt.version,3);assert.equal(attempt.qs.length,20);
    assert.equal(new Set(attempt.qs.map(q=>q.id)).size,20);
    for(let key=0;key<4;key++)assert.equal(attempt.qs.filter(q=>q.opts.indexOf(q.correct)===key).length,5,id+' unbalanced keys');
    assert.deepEqual([...new Set(attempt.qs.map(q=>q.code))].sort(),[...new Set(qs.map(q=>q.code))].sort());
    for(const q of attempt.qs){assert(q.opts.includes(q.correct));keyPositions.add(q.opts.indexOf(q.correct))}
    assert.equal(JSON.stringify(qs),original,'shuffle mutates bank');
  }
  assert.equal(keyPositions.size,4,id+' key position does not vary');
  report.push({id,questions:qs.length,topics:blueprint.topics,skills:blueprint.skills});
}
await mkdir(new URL('tmp/',root),{recursive:true});
await writeFile(new URL('tmp/final-exam-blueprints.json',root),JSON.stringify(report,null,2));
console.log({lessons:40,questions:globalIds.size,forms,checks:['separate practice stems','core topic coverage on every form','optional topics excluded','reasoning/application quotas','four unique choices','five keys at each answer position','stable IDs and versions','shuffle preserves bank']});
