import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRunOptions,parseJourneyOption,performanceActionAllowed,parsePerformanceCredentials,readBackendSnapshots,withTimeout,failureDiagnostic} from './helpers/performance-utils.mjs';

test('run selections reject empty, duplicate, unknown, and fractional runs',()=>{
  const valid={samples:3,variants:['before','after'],roles:['student','teacher']};
  assert.doesNotThrow(()=>validateRunOptions(valid));
  assert.doesNotThrow(()=>validateRunOptions({...valid,journey:'login-roster'}));
  for(const invalid of [{samples:1.5},{samples:0},{variants:[]},{variants:['before','before']},{roles:['admin']},{roles:['student','student']},{journey:'login'},{journey:''}])
    assert.throws(()=>validateRunOptions({...valid,...invalid}));
});

test('journey option preserves full runs by default and rejects ambiguous or missing selections',()=>{
  assert.equal(parseJourneyOption([]),'full');
  assert.equal(parseJourneyOption(['--samples','3','--journey','login-roster','--live']),'login-roster');
  assert.equal(parseJourneyOption(['--journey','full']),'full');
  assert.equal(parseJourneyOption(['--journey=login-roster']),'login-roster');
  for(const args of [['--journey'],['--journey','--live'],['--journey','login'],['--journey',''],['--journey='],['--journey','full','--journey','login-roster'],['--journey=full','--journey=login-roster']])
    assert.throws(()=>parseJourneyOption(args));
});

test('focused API boundary permits login, legacy roster fallback and cleanup but denies score/admin access',()=>{
  // These sequences cover the upgraded service, legacy fallback and logout on
  // failure. Both success paths must remain possible without opening scores.
  for(const sequence of [['login','teacherOptions','logout'],['login','teacherOptions','teacherRoster','logout'],['login','logout']])
    for(const action of sequence)assert.equal(performanceActionAllowed(action,'login-roster'),true,action);
  for(const action of ['sync','adminCreateTeacher','adminUpdateTeacher','studentResults','examHistory','adminTeachers','teacherSummary',undefined,null,{},'toString',''])
    assert.equal(performanceActionAllowed(action,'login-roster'),false,String(action));
  for(const action of ['studentResults','examHistory','adminTeachers'])assert.equal(performanceActionAllowed(action),true,'full run remains compatible: '+action);
  for(const journey of ['full','login-roster','unknown','toString'])
    for(const action of ['sync','adminCreateTeacher','adminUpdateTeacher'])assert.equal(performanceActionAllowed(action,journey),false);
  assert.equal(performanceActionAllowed('login','unknown'),false,'invalid journey fails closed');
});

test('measurement timeout rejects a promise that never settles',async()=>{
  await assert.rejects(withTimeout(new Promise(()=>{}),20,'asset decode'),/asset decode timeout/);
  assert.equal(await withTimeout(Promise.resolve('ready'),1000),'ready');
});

test('live diagnostics never retain arbitrary server/page text or credentials',()=>{
  const error=new Error('student private name, account-123, password-456, '+ 'a'.repeat(64));
  const accounts=[{username:'account-123',password:'password-456'}];
  assert.equal(failureDiagnostic(error,accounts,true),'Live operation failed; raw page and server messages omitted');
  const local=failureDiagnostic(error,accounts);
  assert(!local.includes('account-123')&&!local.includes('password-456')&&!local.includes('a'.repeat(64)));
  assert(local.includes('[account]')&&local.includes('[secret]')&&local.includes('[token]'));
  assert.throws(()=>parsePerformanceCredentials('{"password":"private-broken-input"'),error=>!error.message.includes('private-broken-input')&&error.message.includes('raw input omitted'));
  assert.throws(()=>parsePerformanceCredentials('{"teacher":null}'),/must supply a teacher and students/);
});

test('preparation freezes commit-tree files and backend inputs independently of later edits',async()=>{
  const tempRoot=resolve('tmp/performance-tool-tests');await mkdir(tempRoot,{recursive:true});
  const fixture=await mkdtemp(join(tempRoot,'snapshot-'));
  const git=(...args)=>execFileSync('git',args,{cwd:fixture,windowsHide:true,stdio:'pipe'});
  try{
    for(const folder of ['scripts','assets','integrations/google-sheets'])await mkdir(join(fixture,folder),{recursive:true});
    await copyFile(fileURLToPath(new URL('../scripts/prepare-performance.mjs',import.meta.url)),join(fixture,'scripts/prepare-performance.mjs'));
    await writeFile(join(fixture,'scripts/build-site.mjs'),`import {mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildSite(output){await mkdir(output,{recursive:false});await copyFile(join(root,'index.html'),join(output,'index.html'));return {};}`);
    await writeFile(join(fixture,'index.html'),'<html>fixture</html>');
    await writeFile(join(fixture,'assets/unchanged.js'),'committed unchanged');
    await writeFile(join(fixture,'assets/deleted.js'),'committed deletion');
    await writeFile(join(fixture,'assets/changed.js'),'committed old');
    await writeFile(join(fixture,'integrations/google-sheets/Code.gs'),'committed backend');
    git('init','--quiet');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture');
    git('rm','--quiet','assets/deleted.js');
    await writeFile(join(fixture,'assets/added.js'),'uncommitted addition');git('add','assets/added.js');
    await writeFile(join(fixture,'assets/changed.js'),'workspace new');
    await writeFile(join(fixture,'integrations/google-sheets/Code.gs'),'workspace backend');
    execFileSync(process.execPath,[join(fixture,'scripts/prepare-performance.mjs'),'results'],{cwd:fixture,windowsHide:true,stdio:'pipe'});
    const output=join(fixture,'results'),manifest=JSON.parse(await readFile(join(output,'manifest.json'),'utf8'));
    assert.equal(await readFile(join(output,'before-source/assets/deleted.js'),'utf8'),'committed deletion');
    assert.equal(await readFile(join(output,'before-source/assets/changed.js'),'utf8'),'committed old');
    await assert.rejects(readFile(join(output,'before-source/assets/added.js')),{code:'ENOENT'});
    await writeFile(join(fixture,'assets/unchanged.js'),'later edit');
    assert.equal(await readFile(join(output,'before-source/assets/unchanged.js'),'utf8'),'committed unchanged');
    await writeFile(join(fixture,'integrations/google-sheets/Code.gs'),'later backend edit');
    const sources=await readBackendSnapshots(manifest,['before','after']);
    assert.equal(sources.get('before'),'committed backend');assert.equal(sources.get('after'),'workspace backend');
    await writeFile(manifest.afterBackend,'altered snapshot');
    await assert.rejects(readBackendSnapshots(manifest,['after']),/snapshot changed/);
    await assert.rejects(readBackendSnapshots({...manifest,schemaVersion:1},['before']),/fresh performance manifest/);
  }finally{
    assert(fixture.startsWith(tempRoot+ (process.platform==='win32'?'\\':'/')));
    await rm(fixture,{recursive:true,force:true});
  }
});
