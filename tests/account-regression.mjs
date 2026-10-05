import assert from 'node:assert/strict';
import {harness} from './exercise-regression.mjs';

function login(h,user,password='1234'){
  const doc=h.context.document,query=doc.querySelector.bind(doc);
  doc.querySelector=selector=>selector==='#loginUser'?{value:user}:selector==='#loginPass'?{value:password}:query(selector);
  h.click('[data-action="login"]');
  doc.querySelector=query;
}
for(const user of ['unknown','toString','constructor','__proto__']){
  const h=harness();login(h,user);
  assert(h.find('[data-action="login"]'),'Unknown account must stay on login: '+user);
}
const id='G1U1L1',oldKey='slh_v162_'+id;
const legacy=JSON.stringify({xp:170,contentDone:true,ex:{e1:{done:true,state:null}},onetOriginals:{'2563-3':{answer:2,checked:true}}});
const storage=new Map([[oldKey,legacy]]);
let h=harness(storage);login(h,'teacher');h.qa.open(id,'content');
assert.equal(h.qa.snapshot(id).xp,0,'Teacher does not inherit shared legacy student progress');
h.click('[data-content-complete]');
assert(storage.has('slh_v163_teacher_'+id));
h.click('[data-action="logout"]');login(h,'M20105');h.qa.open(id,'content');
assert.equal(h.qa.snapshot(id).xp,170);
assert.equal(h.qa.snapshot(id).ex.e1.done,true);
assert.equal(h.qa.snapshot(id).onetOriginals['2563-3'].answer,2);
assert(storage.has('slh_v163_M20105_'+id),'Legacy progress copied to student namespace');
assert.equal(storage.get(oldKey),legacy,'Original legacy record remains intact');
h=harness(storage);login(h,'M20105');h.qa.open(id,'content');
assert.equal(h.qa.snapshot(id).xp,170,'Migrated progress survives reload');
h.qa.reset(id);h.qa.open(id,'content');
assert.equal(h.qa.snapshot(id).xp,0,'Reset cannot resurrect legacy progress');
assert(storage.has('slh_v163_teacher_'+id),'Student reset does not erase teacher work');
console.log({checks:['unknown/inherited accounts rejected','teacher/student isolation','legacy student XP, completion and O-NET answers preserved','reload','reset isolation']});
