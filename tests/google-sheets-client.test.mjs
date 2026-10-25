import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/integrations/sheets-client.js', import.meta.url), 'utf8');
const endpoint = 'https://script.google.com/macros/s/test-only-endpoint/exec';
const plain = value => JSON.parse(JSON.stringify(value));
const response = data => ({ok:true,json:async () => ({ok:true,data})});
const denied = code => ({ok:true,json:async () => ({ok:false,error:{code,message:'test denial'}})});
function harness(storage = new Map()) {
  const calls = [], timers = new Map(), listeners = new Map();
  let timerId = 0, eventId = 0, rejectStorage = false, send;
  const localStorage = {
    get length() { return storage.size; }, key: i => [...storage.keys()][i] ?? null,
    getItem: k => storage.get(k) ?? null,
    setItem(k,v) { if (rejectStorage) throw Error('storage full'); storage.set(k,v); },
    removeItem: k => storage.delete(k)
  };
  const context = vm.createContext({
    window:{SLH_SHEETS_CONFIG:{endpoint},crypto:{randomUUID:()=>'test-event-'+(++eventId)},addEventListener:(name,fn)=>listeners.set(name,fn)},
    document:{querySelectorAll:()=>[]}, localStorage, AbortController,
    setTimeout:(fn,delay)=>{ const id=++timerId; timers.set(id,{fn,delay}); return id; }, clearTimeout:id=>timers.delete(id),
    fetch:async (_url,options)=>{const call=JSON.parse(options.body);calls.push(call);return send(call,options);}
  });
  send = call => call.action === 'login' ? response({token:'token-'+call.payload.username,user:{id:call.payload.username,name:'Synthetic test user',grade:2,roles:call.payload.username==='teacher'?['Teacher','Admin']:['Student']},expiresAt:Date.now()+3600000}) : call.action === 'sync' ? response({acknowledged:call.payload.events.map(e=>e.id)}) : response({});
  vm.runInContext(source,context);
  return {api:context.window.SLH_SHEETS,context,storage,calls,timers,listeners,setSend:fn=>{send=fn;},rejectStorage:()=>{rejectStorage=true;},allowStorage:()=>{rejectStorage=false;}};
}
const make = api => api.event('G1U1L1','exercise','e1',{score:4,total:6,pct:67,passed:false});

// Offline retry and a full browser reload retain exactly the same event content.
const first = harness(); await first.api.login('studentA','fake-test-password');
const event = make(first.api); first.api.queue(event); event.result.score = 999;
first.api.queue({...event,result:{score:123}}); // A retry cannot overwrite the queued immutable event.
first.setSend(()=>{throw Error('offline');}); await first.api.flush();
assert.equal(first.storage.size,1); assert.equal(first.calls.at(-1).payload.events[0].result.score,4);
const offlinePayload=plain(first.calls.at(-1).payload.events);
const reloaded=harness(first.storage); await reloaded.api.login('studentA','fake-test-password'); await reloaded.api.flush();
assert.deepEqual(plain(reloaded.calls.at(-1).payload.events),offlinePayload);
assert.equal(reloaded.storage.size,0);

// Acknowledgment can remove only IDs that were actually sent.
const ack=harness();await ack.api.login('studentA','fake-test-password');const one=make(ack.api),two=make(ack.api);ack.api.queue(one);
ack.setSend(call=>{ack.api.queue(two);return response({acknowledged:[one.id,two.id,'unknown']});});await ack.api.flush();
assert.equal(ack.storage.size,1);assert.equal(JSON.parse([...ack.storage.values()][0]).id,two.id);

// Logging out while a request is in flight cannot clear another account's queue.
const isolated=harness();await isolated.api.login('studentA','fake-test-password');isolated.api.queue(make(isolated.api));
let resolveA;isolated.setSend(call=>call.action==='sync'?new Promise(resolve=>{resolveA=resolve;}):response(call.action==='login'?{token:'token-studentB',user:{id:'studentB',roles:['Student']}}:{}));
const pending=isolated.api.flush();isolated.api.logout();await isolated.api.login('studentB','fake-test-password');const b=make(isolated.api);isolated.api.queue(b);
resolveA(response({acknowledged:[isolated.calls.find(c=>c.action==='sync').payload.events[0].id]}));await pending;
assert.equal(isolated.storage.size,2);assert([...isolated.storage.keys()].some(k=>k.includes('studentA/')));assert([...isolated.storage.keys()].some(k=>k.includes('studentB/')));
isolated.setSend(call=>{assert.equal(call.token,'token-studentB');assert.deepEqual(call.payload.events.map(e=>e.id),[b.id]);return response({acknowledged:[b.id]});});await isolated.api.flush();assert.equal(isolated.storage.size,1);

// Two tabs write independent event keys and each reloads current shared storage.
const shared=new Map(),tabA=harness(shared),tabB=harness(shared);await tabA.api.login('studentA','fake-test-password');await tabB.api.login('studentA','fake-test-password');
const ae=make(tabA.api),be={...make(tabB.api),id:'other-tab-event'};tabA.api.queue(ae);tabB.api.queue(be);assert.equal(shared.size,2);
await tabA.api.flush();assert.equal(shared.size,0);await tabB.api.flush();assert.equal(tabB.calls.filter(c=>c.action==='sync').length,0);

// Expired credentials preserve the queue and suspend attempts until login succeeds.
const expired=harness();await expired.api.login('studentA','fake-test-password');expired.api.queue(make(expired.api));expired.setSend(()=>denied('UNAUTHENTICATED'));await expired.api.flush();
assert.equal(expired.storage.size,1);assert(expired.api.status().includes('เข้าสู่ระบบใหม่'));const count=expired.calls.length;await expired.api.flush();assert.equal(expired.calls.length,count);

// The complete request times out instead of leaving the synchronization lock stuck.
const timeout=harness();await timeout.api.login('studentA','fake-test-password');timeout.api.queue(make(timeout.api));timeout.setSend(()=>new Promise(()=>{}));
const timed=timeout.api.flush();const deadline=[...timeout.timers.values()].find(t=>t.delay===30000);assert(deadline);deadline.fn();await timed;assert.equal(timeout.storage.size,1);assert(timeout.api.status().includes('หมดเวลา'));

// Storage denial keeps the event in memory with a visible warning until acknowledged.
const full=harness();await full.api.login('studentA','fake-test-password');full.rejectStorage();full.api.queue(make(full.api));assert(full.api.status().includes('หน่วยความจำ'));await full.api.flush();assert(full.api.status().includes('ครบแล้ว'));

// Failed server login never creates a demo session; students cannot call teacher APIs.
const deniedLogin=harness();deniedLogin.setSend(()=>denied('INVALID_CREDENTIALS'));await assert.rejects(()=>deniedLogin.api.login('teacher','fake-test-password'));assert.equal(deniedLogin.api.queue(make(deniedLogin.api)),false);
const student=harness();await student.api.login('studentA','fake-test-password');await assert.rejects(()=>student.api.teacherSummary({}));assert.equal(student.calls.length,1);
const disabled=harness();disabled.context.window.SLH_SHEETS_CONFIG.endpoint='';assert.equal(disabled.api.enabled(),false);assert.equal(disabled.api.queue(make(disabled.api)),false);

// A staff first page belongs only to the login that returned it. It is consumed
// once, stays out of durable storage, and never follows a change of account.
const staffPage={academicYear:'2569',term:'2',rooms:[{grade:1,room:'01'}],roster:{grade:1,room:'01',offset:0,limit:25,total:1,rows:[{id:'synthetic-pupil',name:'Synthetic pupil'}]}};
const staffLogin=(id='teacher',roles=['Teacher'])=>({token:'token-'+id,user:{id,roles},staff:plain(staffPage)});
const bootstrap=harness();let loginReply=staffLogin();bootstrap.setSend(call=>response(call.action==='login'?loginReply:{}));
await bootstrap.api.login('teacher','fake-test-password');
loginReply.staff.roster.rows[0].name='Changed after delivery';
assert.deepEqual(plain(bootstrap.api.takeTeacherBootstrap()),staffPage,'bootstrap must copy the response');
assert.equal(bootstrap.api.takeTeacherBootstrap(),null,'a later mount must reread authorized data');
assert.equal(bootstrap.storage.size,0,'rosters and tokens are never persisted');
loginReply=staffLogin();await bootstrap.api.login('teacher','fake-test-password');bootstrap.api.logout();
assert.equal(bootstrap.api.takeTeacherBootstrap(),null,'logout discards an unused first page');
await bootstrap.api.login('teacher','fake-test-password');
loginReply=staffLogin('studentA',['Student']);await bootstrap.api.login('studentA','fake-test-password');
assert.equal(bootstrap.api.takeTeacherBootstrap(),null,'students cannot inherit or consume staff data');
loginReply=staffLogin();await bootstrap.api.login('teacher','fake-test-password');
bootstrap.setSend(()=>denied('INVALID_CREDENTIALS'));await assert.rejects(()=>bootstrap.api.login('teacher','wrong-password'));
assert.equal(bootstrap.api.takeTeacherBootstrap(),null,'failed login clears the previous account first page');
assert.equal(student.api.takeTeacherBootstrap(),null,'legacy responses without a first page remain supported');

// A delayed earlier login cannot overwrite the new identity or its roster.
const switched=harness();let resolveLogin;
switched.setSend(call=>call.payload.username==='teacherA'?new Promise(resolve=>{resolveLogin=resolve;}):response(staffLogin('teacherB')));
const previousLogin=switched.api.login('teacherA','fake-test-password');
const cancelled=assert.rejects(previousLogin,/ยกเลิก/);
await switched.api.login('teacherB','fake-test-password');
const oldReply=staffLogin('teacherA');oldReply.staff.roster.rows[0].id='previous-account-pupil';resolveLogin(response(oldReply));await cancelled;
assert.deepEqual(plain(switched.api.takeTeacherBootstrap()),staffPage);
assert.equal(switched.api.takeTeacherBootstrap(),null);

console.log('Google Sheets client: immutable retry, reload, acknowledgment, account isolation, concurrent tabs, expiry, timeout, storage failure, roles and one-use staff bootstrap passed');
