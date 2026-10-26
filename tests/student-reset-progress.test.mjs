import assert from 'node:assert/strict';
import test from 'node:test';
import {harness as siteHarness} from './exercise-regression.mjs';
import {harness as serverHarness} from './helpers/google-sheets-harness.mjs';

test('real student client, local progress and backend stay aligned through lesson/all reset and stale activity callbacks',async()=>{
  const site=siteHarness(new Map(),{exposeProgress:true}),server=serverHarness(),A='G1U1L1',B='G1U1L2',progress=site.context.window.__SLH_PROGRESS_TEST__;
  server.setClock(Date.now());
  const api=site.context.window.SLH_SHEETS,endpoint='https://script.google.com/macros/s/SYNTHETIC_LOCAL_ONLY/exec';
  site.context.window.SLH_SHEETS_CONFIG={endpoint};
  Object.defineProperty(site.context.localStorage,'length',{get:()=>site.storage.size});
  site.context.localStorage.key=i=>[...site.storage.keys()][i]??null;
  const calls=[];
  site.context.fetch=async(url,options)=>{
    assert.equal(url,endpoint);const request=JSON.parse(options.body);calls.push(request.action);
    const body=server.call(request.action,request.payload,request.token);
    return {ok:true,json:async()=>body};
  };
  const user=await api.login('fixture0001',server.password),admin=server.login('watcharapon');
  site.context.window.__SLH_TEST_AUTH__.defaultUser=user;site.qa.login();
  site.qa.open(A,'content');
  const staleProgress=progress.getP(A);staleProgress.xp=300;staleProgress.exam.attempts=2;progress.saveP(A,staleProgress);
  const staleActivity=progress.gameAPI('g1'),untouched=progress.getP(B);untouched.xp=77;progress.saveP(B,untouched);
  const old=api.event(A,'game','g1',{attempt:1,passed:true,done:true,correct:true,gameType:'test'});api.queue(old);
  const reset=lessonId=>{
    const requestId='synthetic-reset-'+(server.sheets.get('SLH_Resets').rows.length);
    const reply=server.call('adminResetStudent',{requestId,studentId:user.id,lessonId,confirmStudentId:user.id},admin.token);
    assert.equal(reply.ok,true,JSON.stringify(reply));return reply.data;
  };
  const lessonReset=reset(A);await api.refreshResetState();
  assert.equal(site.qa.snapshot(A).xp,0);assert.equal(site.qa.snapshot(A).exam.attempts,0);
  assert.equal(site.qa.snapshot(B).xp,77);assert.equal(progress.session().screen,'dashboard');
  assert.equal(progress.saveP(A,staleProgress),false);
  assert.equal(staleActivity.submit({attempt:1,passed:true,done:true,correct:true,gameType:'test'}),null);
  assert.equal(api.queue(old),false);
  assert.equal([...site.storage.keys()].some(key=>key.startsWith('slh_sheets_outbox_v1_')),false);
  site.qa.open(A,'content');
  const freshProgress=progress.getP(A);freshProgress.xp=21;progress.saveP(A,freshProgress);progress.gameAPI('g1').submit({attempt:1,passed:true,done:true,correct:true,gameType:'test'});
  await api.flush();
  assert.equal(site.qa.snapshot(A).xp,21);assert.equal(server.sheets.get('SLH_Events').rows.length,2);
  assert.equal(JSON.parse(server.sheets.get('SLH_Events').rows[1][9]).resetVersion,lessonReset.resetId);
  assert.equal(server.call('studentResults',{studentId:user.id,lessonId:A},admin.token).data.result.games.g1.passed,true);
  // A reset to a different lesson must not interrupt the current activity.
  reset(B);await api.refreshResetState();assert.equal(progress.session().lesson.id,A);assert.equal(site.qa.snapshot(A).xp,21);assert.equal(site.qa.snapshot(B).xp,0);
  reset('');await api.refreshResetState();assert.equal(site.qa.snapshot(A).xp,0);assert.equal(site.qa.snapshot(B).xp,0);
  assert.equal(server.call('studentResults',{studentId:user.id,lessonId:A},admin.token).data.result.games.g1,undefined);
  assert.equal(site.storage.get('slh_v163_fixture0001_'+A).includes('300'),true,'prior namespace retained but excluded from current scores');
  // A reset namespace must never fall back to the historic demo-account key.
  site.storage.set('slh_v162_'+A,JSON.stringify({xp:999}));progress.session().user.id='M20105';
  assert.equal(site.qa.snapshot(A).xp,0);
  assert(calls.includes('studentResetState'));assert(calls.includes('sync'));
});
