import assert from 'node:assert/strict';
import {harness} from './exercise-regression.mjs';

const id='G1U1L1';
let h=harness();h.qa.open(id,'exam');
for (const [i,q] of h.qa.snapshot(id).exam.current.qs.entries()){
  h.click('[data-exam-go="'+i+'"]');
  h.context.document.querySelectorAll('[data-exam-choice]').find(b=>b.dataset.examChoice!==q.correct).onclick();
}
h.click('[data-exam-submit]');
assert.equal(h.qa.snapshot(id).exam.last,0);
h.click('[data-action="home"]');h.click('[data-nav="results"]');
assert(h.find('[data-open-result="'+id+'"]'),'A completed 0% exam must appear in results');
h.qa.open(id,'content');h.click('[data-action="home"]');h.click('[data-nav="results"]');
h.click('[data-open-result="'+id+'"]');
assert(h.markup.includes('คะแนนล่าสุด 0%'),'View result opens the score even when another activity was resumed');
h.click('[data-action="back"]');
assert(h.find('[data-open-result="'+id+'"]'),'Back returns to the results list');

const earned=h.qa.snapshot(id);earned.ex.e1.done=true;earned.games.g1.done=true;earned.exam.passed=true;earned.exam.best=60;
h.storage.set('slh_v163_M20105_'+id,JSON.stringify(earned));
h.qa.login();
assert(!h.markup.includes('ภารกิจวันนี้'),'Cumulative progress must not claim to be daily');
for(const text of ['ผ่านข้อสอบท้ายบทอย่างน้อย 1 บท','ผ่านแบบฝึกอย่างน้อย 1 ชุด','ผ่านเกมวิทยาศาสตร์อย่างน้อย 1 เกม'])assert(h.markup.includes('class="tick done">✓</span>'+text),text);

h=harness();h.qa.login();
h.context.localStorage.setItem=()=>{throw new Error('QuotaExceededError')};
h.qa.open(id,'content');h.click('[data-content-complete]');
assert.equal(h.qa.snapshot(id).contentDone,true,'Unsaved changes must survive subsequent renders in this page');
h.qa.open(id,'exam');const first=h.qa.snapshot(id).exam.current.qs[0];
h.context.document.querySelectorAll('[data-exam-choice]').find(b=>b.dataset.examChoice===first.correct).onclick();
h.qa.open(id,'content');h.qa.open(id,'exam');
assert.equal(h.qa.snapshot(id).exam.current.answers[0],first.correct,'Quota errors must not discard answers during navigation');
h.context.localStorage.getItem=()=>{throw new Error('SecurityError')};
h.qa.open('G1U2L1','content');h.click('[data-content-complete]');
assert.equal(h.qa.snapshot('G1U2L1').contentDone,true,'Blocked storage supports temporary learning without crashing');

const withheldImages=["G2U2L1-02","G2U2L1-04","G2U2L1-08","G2U2L2-04","G2U2L2-05","G2U3L1-06","G2U3L1-07","G2U3L1-09","G2U3L1-10","G2U3L1-11","G2U3L1-13","G2U3L1-14","G2U3L2-02","G2U3L2-06","G2U3L2-07","G2U3L3-01","G2U3L4-01"];
h=harness();let readingImageCount=0;
for(const lesson of h.qa.lessonIds){
 h.qa.open(lesson,'content');
 readingImageCount+=(h.markup.match(/class="lessonImage"/g)||[]).length;
 for(const section of h.context.window.SLH_DATA.packs[lesson])assert(h.markup.includes('id="reading-'+section.code+'"'),'All teaching text remains available: '+section.code);
 for(const key of withheldImages.filter(key=>key.startsWith(lesson+'-')))assert(!h.markup.includes('assets/lessons/'+key),'Do not display a confirmed incorrect illustration: '+key);
}
assert.equal(readingImageCount,302,'Retain the 302 illustrations outside the confirmed error list');
console.log({readingImageCount,withheldImages:withheldImages.length,checks:['0% attempts visible','result button and return navigation','earned dashboard goals','quota exceeded fallback','blocked storage fallback']});
