import assert from 'node:assert/strict';
import {harness} from './exercise-regression.mjs';

let h=harness();
const stages=['content','lab','g1','g2','g3','e1','e2','e3','exam','result'];
for(const id of h.qa.lessonIds){
  h.qa.reset(id);h.qa.open(id);
  for(const stage of [...stages].reverse()){
    h.click('[data-stage="'+stage+'"]');
    const p=h.qa.snapshot(id);
    assert.equal(p.resume,stage);
    assert.equal(p.contentDone,false);
    assert.equal(p.lab.done,false);
    assert(Object.values(p.games).every(g=>!g.done));
    assert(Object.values(p.ex).every(e=>!e.done));
    assert.equal(p.exam.passed,false);
    assert.equal(p.exam.attempts,0);
    assert.equal(p.xp,0,'opening activities never awards XP');
    assert(!h.markup.includes('🔒'));
    if(stage==='result')assert(h.markup.includes('ยังไม่มีผลสอบ'));
  }
  h.click('[data-stage="g3"]');h.click('[data-arc-next]');
  assert.equal(h.qa.snapshot(id).resume,'e1');
  assert.equal(h.qa.snapshot(id).games.g3.done,false);
  h.click('[data-ex-next]');assert.equal(h.qa.snapshot(id).resume,'e2');
  assert.equal(h.qa.snapshot(id).ex.e1.done,false);
  const answers=h.qa.snapshot(id).ex.e2.state.qs;
  answers.forEach((q,i)=>h.context.document.querySelectorAll('[data-ex-q="'+i+'"]').find(b=>b.dataset.exO!==q.correct).onclick());
  h.click('[data-ex-check]');
  const wrong=h.qa.snapshot(id).ex.e2.state.qs.find((q,i)=>h.qa.snapshot(id).ex.e2.state.answers[i]!==q.correct);
  assert(wrong,'incorrect answers provide a topic to review');
  {
    h.click('[data-review-topic="'+wrong.code+'"]');
    assert.equal(h.qa.snapshot(id).resume,'content');
    assert(h.markup.includes('id="reading-'+wrong.code+'"'));
    h.click('[data-stage="e2"]');
    assert.equal(Object.keys(h.qa.snapshot(id).ex.e2.state.answers).length,6);
  }
  h.click('[data-stage="exam"]');h.click('[data-exam-choice]');
  const exam=JSON.stringify(h.qa.snapshot(id).exam.current);
  h.click('[data-stage="lab"]');h.click('[data-stage="exam"]');
  assert.equal(JSON.stringify(h.qa.snapshot(id).exam.current),exam);
  h=harness(h.storage);h.qa.login();h.qa.reopen(id);
  assert.equal(h.qa.snapshot(id).resume,'exam','reopening resumes chosen activity');
  assert.equal(JSON.stringify(h.qa.snapshot(id).exam.current),exam);
}

// A student may take the final exam first, and 60% is still the pass threshold.
const id=h.qa.lessonIds[0];
for(const score of [11,12]){
  h.qa.reset(id);h.qa.open(id,'exam');
  const qs=h.qa.snapshot(id).exam.current.qs;
  qs.forEach((q,i)=>{
    h.click('[data-exam-go="'+i+'"]');
    const options=h.context.document.querySelectorAll('[data-exam-choice]');
    const button=options.find(b=>i<score?b.dataset.examChoice===q.correct:b.dataset.examChoice!==q.correct);
    button.onclick();
  });
  h.click('[data-exam-submit]');
  const p=h.qa.snapshot(id);
  assert.equal(p.exam.last,score*5);
  assert.equal(p.exam.passed,score===12);
  assert.equal(p.contentDone,false);assert.equal(p.lab.done,false);
  assert(Object.values(p.games).every(g=>!g.done));
  assert(Object.values(p.ex).every(e=>!e.done));
  h.click('[data-result-retry]');
  assert.equal(h.qa.snapshot(id).exam.current.qs.length,20);
}
console.log({lessons:40,stages:10,checks:['free navigation without earned progress','skip unfinished games and exercises','topic review preserves answers','exam answers survive activity switches and reload','55% fails and 60% passes without prerequisites']});
