import assert from 'node:assert/strict';
import test from 'node:test';
import {harness} from './google-sheets-client.test.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const response = data => ({ok:true,json:async()=>({ok:true,data})});
const state = (sequence, all='', lessons={}) => ({sequence,all,lessons});
const A='G1U1L1', B='G1U1L2';
const loginReply = (resetState,user='studentA') => ({token:'synthetic-token',user:{id:user,roles:['Student']},resetState});
const event = (api,id=A) => api.event(id,'game','g1',{passed:true});
const queued = h => [...h.storage].filter(([key])=>key.startsWith('slh_sheets_outbox_v1_')).map(([,value])=>JSON.parse(value));

test('login clears only stale lesson outbox, stamps fresh events, preserves other lessons and accounts',async()=>{
  const h=harness(); await h.api.login('studentA','synthetic');
  const old=event(h.api), other=event(h.api,B);h.api.queue(old);h.api.queue(other);
  h.storage.set('slh_sheets_outbox_v1_studentB/other',JSON.stringify({...old,id:'other-account'}));
  h.api.logout();h.setSend(()=>response(loginReply(state(1,'',{[A]:'reset-lesson-1'}))));
  await h.api.login('studentA','synthetic');
  assert.deepEqual(queued(h).map(e=>e.id).sort(),[other.id,'other-account'].sort());
  assert.equal(h.api.progressVersion(A),'reset-lesson-1');assert.equal(h.api.progressVersion(B),'');
  assert.equal(h.api.queue(old),false,'saved old attempts cannot acquire the new revision');
  const fresh=event(h.api);assert.equal(fresh.resetVersion,'reset-lesson-1');h.api.queue(fresh);
  assert.equal(queued(h).find(e=>e.id===fresh.id).resetVersion,'reset-lesson-1');
});

test('sync reset state drops stale pending work, including work queued while request was in flight',async()=>{
  const h=harness();h.setSend(()=>response(loginReply(state(0))));await h.api.login('studentA','synthetic');
  const first=event(h.api),second=event(h.api),other=event(h.api,B);h.api.queue(first);
  h.setSend(()=>{h.api.queue(second);h.api.queue(other);return response({acknowledged:[first.id],discarded:[first.id],resetState:state(1,'',{[A]:'reset-lesson-1'})});});
  let notified=0;h.api.onReset(()=>notified++);await h.api.flush();
  assert.deepEqual(queued(h).map(e=>e.id),[other.id]);assert.equal(notified,1);
  assert(h.api.status().includes('รีเซ็ต'));
  assert.equal(event(h.api).resetVersion,'reset-lesson-1');
});

test('late server snapshots and other-account storage changes cannot roll back the latest revision',async()=>{
  const h=harness();h.setSend(()=>response(loginReply(state(0))));await h.api.login('studentA','synthetic');
  let release;h.setSend(()=>new Promise(resolve=>{release=resolve;}));const pending=h.api.refreshResetState();
  const latest=state(2,'reset-all-2');
  h.listeners.get('storage')({key:'slh_reset_state_v1_studentA',newValue:JSON.stringify(latest)});
  release(response({resetState:state(1,'',{[A]:'reset-lesson-1'})}));await pending;
  assert.equal(h.api.progressVersion(A),'reset-all-2');assert.equal(h.api.progressVersion(B),'reset-all-2');
  h.listeners.get('storage')({key:'slh_reset_state_v1_studentB',newValue:JSON.stringify(state(5,'other-reset'))});
  assert.equal(h.api.progressVersion(A),'reset-all-2');
  h.listeners.get('storage')({key:'slh_reset_state_v1_studentA',newValue:'{broken'});
  assert.equal(h.api.progressVersion(A),'reset-all-2');
});

test('refresh deduplicates requests, ignores logged-out identity, skips hidden pages and respects expiry',async()=>{
  const h=harness();h.setSend(()=>response(loginReply(state(0))));await h.api.login('studentA','synthetic');
  let release;h.setSend(call=>call.action==='studentResetState'?new Promise(resolve=>{release=resolve;}):response(call.action==='login'?loginReply(state(0),'studentB'):{}));
  const first=h.api.refreshResetState(),second=h.api.refreshResetState();
  assert.equal(h.calls.filter(c=>c.action==='studentResetState').length,1);
  h.api.logout();await h.api.login('studentB','synthetic');release(response({resetState:state(5,'reset-account-a')}));await Promise.all([first,second]);
  assert.equal(h.api.progressVersion(A),'');
  h.context.document.hidden=true;await h.api.refreshResetState();assert.equal(h.calls.filter(c=>c.action==='studentResetState').length,1);
  h.context.document.hidden=false;h.setSend(()=>({ok:true,json:async()=>({ok:false,error:{code:'UNAUTHENTICATED',message:'expired'}})}));
  await h.api.refreshResetState();const count=h.calls.length;await h.api.refreshResetState();assert.equal(h.calls.length,count);
  assert(h.api.status().includes('เข้าสู่ระบบใหม่'));
});

test('all reset then lesson override persists across reload and memory-only storage failures',async()=>{
  const h=harness();let current=state(1,'reset-all-1');h.setSend(()=>response(loginReply(current)));await h.api.login('studentA','synthetic');
  assert.equal(event(h.api,B).resetVersion,'reset-all-1');
  const stored=h.storage,again=harness(stored);again.setSend(()=>response(loginReply(state(0))));await again.api.login('studentA','synthetic');
  assert.equal(again.api.progressVersion(A),'reset-all-1','older login response cannot reenable old progress');
  again.rejectStorage();current=state(2,'reset-all-1',{[A]:'reset-lesson-2'});again.setSend(()=>response({resetState:current}));await again.api.refreshResetState();
  assert.equal(event(again.api).resetVersion,'reset-lesson-2');assert.equal(event(again.api,B).resetVersion,'reset-all-1');
  const fresh=event(again.api);assert(again.api.queue(fresh));assert(again.api.status().includes('หน่วยความจำ'));
  again.setSend(call=>response({acknowledged:call.payload.events.map(e=>e.id),resetState:current}));await again.api.flush();assert(again.api.status().includes('ครบแล้ว'));
});

test('student reset API remains admin-only and preserves the caller idempotency payload',async()=>{
  const h=harness();await h.api.login('studentA','synthetic');await assert.rejects(()=>h.api.adminResetStudent({}));assert.equal(h.calls.length,1);
  await h.api.login('teacher','synthetic');const payload={requestId:'synthetic-reset-1',studentId:'studentA',lessonId:A,confirmStudentId:'studentA'};
  await h.api.adminResetStudent(payload);assert.deepEqual(copy(h.calls.at(-1).payload),payload);assert.equal(h.calls.at(-1).action,'adminResetStudent');
});
