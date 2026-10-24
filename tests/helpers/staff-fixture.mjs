// Synthetic local review data only; never reads school accounts or contacts Google.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {harness,exam,responses} from './google-sheets-harness.mjs';
export function staffFixture(){
 const h=harness(),owner=h.login('watcharapon'),pupil=h.login(),teacherId='fixture_teacher',teacherPassword=randomUUID(),lessonId='G1U1L1',occurredAt=h.now()-1000;
 assert.equal(h.call('adminCreateTeacher',{username:teacherId,name:'ครูทดลอง ห้อง A',password:teacherPassword},owner.token).ok,true);
 assert.equal(h.call('adminUpdateTeacher',{teacherId,term:'2',rooms:[{grade:1,room:'01'}]},owner.token).ok,true);
 const make=(id,kind,stage,result)=>({id,kind,stage,lessonId,occurredAt,result});
 const events=[
  make('fixture-game-failed','game','g1',{attempt:1,passed:false,done:false,correct:false,gameType:'memory'}),
  make('fixture-game-passed','game','g2',{attempt:1,passed:true,done:true,correct:true,gameType:'memory'}),
  make('fixture-exercise-zero','exercise','e1',{score:0,total:6,pct:0,passed:false,responses:responses(6,0)}),
  make('fixture-onet-zero','onet','onet',{questionId:'synthetic-question',answer:1,correct:2,score:0,total:1,pct:0,passed:false}),
  make('fixture-simulation','simulation','simulation',{explored:true,values:{light:6,t:0},metrics:[['การเติบโต',0],['ค่าที่ไม่ถูกบันทึก',null]],summary:'ผลจำลองสำหรับตรวจหน้าเว็บ: วันที่ 0'}),
  ...Array.from({length:13},(_,i)=>exam('fixture-exam-'+i,h.now()-30000+i*1000,i===0?20:i===12?4:12,lessonId))
 ];
 assert.equal(h.call('sync',{events},pupil.token).data.accepted,events.length);
 h.sheets.get('SLH_Events').rows.push(['legacy-fixture-key','legacy-partial-exercise',pupil.user.id,'2569',lessonId,'exercise','e2',occurredAt,h.now(),JSON.stringify({score:2}),'legacy-fixture-hash']);
 return {h,owner,pupil,teacherId,teacherPassword,lessonId};
}
