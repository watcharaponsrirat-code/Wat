import assert from 'node:assert/strict';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const script=join(root,'scripts/summarize-performance.mjs');
const execute=promisify(execFile);
const run=(variant,sample,steps,passed=true)=>({variant,role:'student',sample,steps,passed});
const step=(displayMs,dataMs=displayMs+5,readyMs=dataMs+5,extra={})=>({name:'login',displayMs,dataMs,readyMs,...extra});
const report=(runs,extra={})=>({mode:'synthetic fixture',backendPhase:'controlled',createdAt:'2026-10-25T00:00:00Z',conditions:{viewport:'1366x900',motion:'normal',network:'loopback only',cache:'isolated'},runs,passed:true,failures:[],blockedWrites:0,cleanupFailures:0,...extra});

async function fixture(reports){
  await mkdir(join(root,'tmp'),{recursive:true});
  const directory=await mkdtemp(join(root,'tmp/performance-summary-test-'));
  const inputs=await Promise.all(reports.map(async(data,i)=>{const file=join(directory,'report-'+i+'.json');await writeFile(file,JSON.stringify(data));return file;}));
  const output=join(directory,'summary');
  const summarize=async(args=[...inputs,'--output',output])=>{
    await execute(process.execPath,[script,...args],{cwd:root,windowsHide:true});
    const at=args.indexOf('--output'),prefix=at<0?output:resolve(root,args[at+1]);
    return {json:JSON.parse(await readFile(prefix+'.json','utf8')),markdown:await readFile(prefix+'.md','utf8')};
  };
  return {directory,inputs,output,summarize};
}

test('summarizes odd/even medians, API completion, resources and per-sample span totals',async()=>{
  const before=[30,10,20].map((ms,i)=>run('before',i+1,[step(ms,ms+5,ms+10,{
    api:[{action:'login',headersMs:[10,20,20][i],completeMs:[40,null,60][i],ok:i!==1,staffBootstrap:i===0}],
    resources:[{path:'assets/main.js',ms:[5,9,7][i],finishMs:[25,29,27][i],bytes:100}],
    spans:i===0?[{name:'render',ms:2},{name:'render',ms:3}]:i===1?[]:[{name:'render',ms:7}]
  })]));
  const after=[12,14,16,18].map((ms,i)=>run('after',i+1,[step(ms)]));
  const {summarize}=await fixture([report([...before,...after])]);
  const {json,markdown}=await summarize(),actual=json.reports[0];
  assert.equal(actual.groups.length,2);
  const first=actual.groups.find(group=>group.variant==='before'),second=actual.groups.find(group=>group.variant==='after');
  assert.deepEqual(first.displayMs,{n:3,median:20,min:10,max:30});
  assert.deepEqual(second.displayMs,{n:4,median:15,min:12,max:18});
  assert.deepEqual(first.api[0],{action:'login',calls:3,samples:3,completed:2,ok:2,completeMs:{n:2,median:50,min:40,max:60},headersMs:{n:3,median:20,min:10,max:20},bodyAfterHeadersMs:{n:2,median:35,min:30,max:40},staffBootstrap:1});
  assert.deepEqual(first.spans[0],{name:'render',totalMs:{n:3,median:5,min:0,max:7},calls:{n:3,median:1,min:0,max:2}});
  assert.equal(first.topResources[0].samples,3);
  assert.deepEqual(first.topResources[0].finishAfterClickMs,{n:3,median:27,min:25,max:29});
  assert.equal(actual.comparisons[0].displayMedianDeltaMs,-5);
  assert.equal(actual.comparisons[0].readyMedianDeltaMs,-5);
  assert.match(actual.comparisons[0].evidence,/descriptive small-sample/);
  assert.match(markdown,/20\.0 \[10\.0–30\.0\]/);
  assert.match(markdown,/Complete API response time/);
});

test('missing timings do not become zeroes or negative derived durations',async()=>{
  const {summarize}=await fixture([report([
    run('before',1,[step(null,10,20)]),
    run('before',2,[step(5,null,null)]),
    run('before',3,[step(2,6,9)]),
    run('before',4,[{name:'home',displayMs:0,dataMs:0,readyMs:0}])
  ])]);
  const {json}=await summarize(),login=json.reports[0].groups.find(group=>group.step==='login'),home=json.reports[0].groups.find(group=>group.step==='home');
  assert.deepEqual(login.afterDisplayToDataMs,{n:1,median:4,min:4,max:4});
  assert.deepEqual(login.afterDataToReadyMs,{n:2,median:6.5,min:3,max:10});
  assert.deepEqual(home.afterDisplayToDataMs,{n:1,median:0,min:0,max:0});
});

test('keeps input reports separate even when run keys and backend labels match',async()=>{
  const {summarize}=await fixture([
    report([run('before',1,[step(10)])]),
    report([run('after',1,[step(1000)])]),
    report([run('before',1,[step(5000)])],{mode:'live fixture',backendPhase:'after-update',liveBackendVerified:false,beforeBackendSHA256:'local-before',afterBackendSHA256:'local-after'})
  ]);
  const {json,markdown}=await summarize();
  assert.equal(json.reports.length,3);
  assert.deepEqual(json.reports.map(item=>item.groups[0].displayMs.median),[10,1000,5000]);
  assert(json.reports.every(item=>item.groups[0].n===1&&item.comparisons.length===0));
  assert.equal(new Set(json.reports.map(item=>item.source)).size,3);
  assert.match(markdown,/single sample is a smoke check/);
  assert.match(markdown,/live fixture — after-update/);
  assert.equal(json.reports[2].liveBackendVerified,false);
  assert.equal(json.reports[2].beforeBackendSHA256,'local-before');
  assert.match(markdown,/Remote Apps Script version is unverified/);
  assert.match(markdown,/Local Code.gs SHA-256/);
});

test('retains completed steps from failed journeys and marks comparisons and Markdown',async()=>{
  const runs=['before','after'].flatMap(variant=>[1,2,3].map(sample=>run(variant,sample,[step(sample*10)],!(variant==='after'&&sample===3))));
  const failure={variant:'after',role:'student',sample:3,step:'simulation',type:'TimeoutError',diagnostic:'sensitive fixture detail'};
  const {summarize}=await fixture([report(runs,{passed:false,cleanupFailures:1,failures:[failure]})]);
  const {json,markdown}=await summarize(),actual=json.reports[0];
  assert.equal(actual.passed,false);assert.equal(actual.failedRuns,1);assert.equal(actual.cleanupFailures,1);
  assert.equal(actual.groups.find(group=>group.variant==='after').n,3);
  assert.equal(actual.groups.find(group=>group.variant==='after').samplesFromFailedRuns,1);
  assert.match(actual.comparisons[0].evidence,/incomplete\/failed journey/);
  assert.deepEqual(actual.failures,[{variant:'after',role:'student',sample:3,step:'simulation',type:'TimeoutError'}]);
  assert.match(markdown,/\| after \| student \| login \| 3\*/);
  assert.match(markdown,/did not complete successfully/);
  assert.match(markdown,/after\/student\/simulation \(sample 3, TimeoutError\)/);
  assert(!JSON.stringify(json).includes(failure.diagnostic));
});

test('rejects missing, duplicated and non-report inputs',async()=>{
  const {inputs,output,summarize}=await fixture([report([]),{runs:[]}]);
  await assert.rejects(summarize(['--output',output]),/Pass one or more/);
  await assert.rejects(summarize([inputs[0],resolve(inputs[0]),'--output',output]),/same report/);
  await assert.rejects(summarize([inputs[1],'--output',output]),/Not a navigation-performance report/);
});

test('refuses to overwrite an input timing report with its summary',async()=>{
  const {inputs,summarize}=await fixture([report([run('before',1,[step(10)])])]);
  const original=await readFile(inputs[0],'utf8');
  await assert.rejects(summarize([inputs[0],'--output',inputs[0].slice(0,-'.json'.length)]),/overwrite an input report/);
  assert.equal(await readFile(inputs[0],'utf8'),original);
});
