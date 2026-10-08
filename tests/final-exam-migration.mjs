import assert from 'node:assert/strict';
import {harness} from './exercise-regression.mjs';
const id='G1U1L1',key='slh_v163_M20105_'+id;
for(const previousVersion of [undefined,2]){
let h=harness();h.qa.login();h.qa.open(id,'exam');
const progress=h.qa.snapshot(id);
const legacyQuestions=previousVersion===2?progress.exam.current.qs.map(q=>({...q,version:2})):h.qa.pool(id).slice(0,20);
const legacy={qs:legacyQuestions,idx:3,answers:{0:legacyQuestions[0].correct},started:12345};
if(previousVersion!==undefined)legacy.version=previousVersion;
progress.exam.current=legacy;progress.exam.best=100;progress.exam.passed=true;progress.exam.attempts=1;
progress.exam.history=[{pct:100,score:20,at:10000,review:[]}];progress.xp=300;
h.storage.set(key,JSON.stringify(progress));
h=harness(h.storage);h.qa.open(id,'exam');
assert.equal(JSON.stringify(h.qa.snapshot(id).exam.current),JSON.stringify(legacy),'Opening an old attempt must not replace its questions, ordering or answers');
assert(h.markup.includes('กำลังทำชุดเดิมที่บันทึกไว้'));
h.qa.open(id,'lab');h.qa.open(id,'exam');
assert.equal(JSON.stringify(h.qa.snapshot(id).exam.current),JSON.stringify(legacy));
for(let i=0;i<20;i++){
  h.click('[data-exam-go="'+i+'"]');
  h.context.document.querySelectorAll('[data-exam-choice]').find(e=>e.dataset.examChoice===legacyQuestions[i].correct).onclick();
}
h.click('[data-exam-submit]');
let p=h.qa.snapshot(id);
assert.equal(p.exam.last,100);assert.equal(p.exam.best,100);assert.equal(p.xp,300);
assert.equal(p.exam.history[0].version,previousVersion||1);assert.equal(p.exam.history[0].responses.length,20);
assert.equal(p.exam.history[1].at,10000);assert.equal(p.exam.history[0].started,12345);
assert(h.markup.includes('เฉลยและเหตุผลทุกข้อ'));
h.click('[data-result-retry]');
p=h.qa.snapshot(id);
assert.equal(p.exam.current.version,3);assert(p.exam.current.qs.every(q=>q.id.startsWith(id+'-F')));
assert.equal(p.exam.best,100);assert.equal(p.exam.passed,true);assert.equal(p.xp,300);
assert(!h.markup.includes('กำลังทำชุดเดิมที่บันทึกไว้'));
const saved=JSON.stringify(p.exam.current);
h=harness(h.storage);h.qa.open(id,'exam');
assert.equal(JSON.stringify(h.qa.snapshot(id).exam.current),saved,'New attempt is stable across reload');
}
console.log({checks:['legacy pending attempt unchanged','legacy answer events and scoring','versioned history and full explanations','best score and XP retained','new bank on next attempt','new attempt reload']});
