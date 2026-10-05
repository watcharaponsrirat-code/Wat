import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {harness} from './exercise-regression.mjs';

let h = harness();
const questions = h.context.window.SLH_ONET.questions;
assert.equal(new Set(questions.map(q=>q.id)).size, questions.length);
for (const q of questions) {
  h.qa.open(q.lesson,'e3');
  const xp = h.qa.snapshot(q.lesson).xp;
  const challenge = JSON.stringify(h.qa.snapshot(q.lesson).ex.e3);
  assert(h.markup.includes(q.source.pdf+'#page='+q.page));
  assert(h.markup.includes(`src="${q.image.src}"`), 'Question is visible inline');
  assert(q.image.width > 500 && q.image.height > 50);
  const asset = await readFile(new URL('../'+q.image.src,import.meta.url));
  assert.equal(asset.toString('ascii',0,4),'RIFF');
  assert.equal(asset.toString('ascii',8,12),'WEBP');
  assert(h.markup.indexOf('onetPractice') < h.markup.indexOf('แบบฝึกแต่งใหม่'), 'Original papers appear first');
  assert(h.find(`[data-onet-zoom="${q.id}"]`), 'Inline zoom is available');
  assert(h.find(`[data-onet-check="${q.id}"]`).disabled);
  assert(!h.markup.includes(q.note), 'Explanation stays hidden before checking');
  h.click(`[data-onet-id="${q.id}"][data-onet-answer="${q.key%4+1}"]`);
  h.click(`[data-onet-check="${q.id}"]`);
  assert(h.markup.includes('❌ คำตอบที่ถูก: ตัวเลือก '+q.key));
  h.click(`[data-onet-id="${q.id}"][data-onet-answer="${q.key}"]`);
  assert.equal(h.qa.snapshot(q.lesson).onetOriginals[q.id].checked,false);
  h.click(`[data-onet-check="${q.id}"]`);
  h = harness(h.storage);
  h.qa.open(q.lesson,'e3');
  const saved=h.qa.snapshot(q.lesson);
  assert.equal(saved.onetOriginals[q.id].answer,q.key);
  assert.equal(saved.onetOriginals[q.id].checked,true);
  assert.equal(saved.xp,xp);
  assert.equal(JSON.stringify(saved.ex.e3),challenge);
  assert(h.markup.includes(q.note));
}
const covered=new Set(questions.map(q=>q.lesson));
for(const id of h.qa.lessonIds.filter(id=>!covered.has(id))){
  h.qa.open(id,'e3');
  assert(h.markup.includes('บทนี้ยังไม่มีข้อสอบจริงที่จับคู่หัวข้อไว้'));
  assert(h.find('[data-ex-check]'));
}
console.log({originalQuestions:questions.length,coveredLessons:covered.size,checks:'source links, hidden feedback, wrong/correct answers, reload persistence, unchanged XP and Challenge, empty lessons'});
