// Summarize Chrome timing reports without merging different backends or runs.
// Usage: node scripts/summarize-performance.mjs report.json [report2.json] --output tmp/performance-v2/summary
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const args=process.argv.slice(2),files=[];let output='tmp/performance-v2/summary';
for(let i=0;i<args.length;i++){
  if(args[i]==='--output'){if(!args[i+1])throw Error('--output requires a file prefix');output=args[++i];}
  else if(args[i].startsWith('--'))throw Error('Unknown option: '+args[i]);
  else files.push(resolve(args[i]));
}
if(!files.length)throw Error('Pass one or more navigation-performance JSON reports, then optionally --output <prefix>.');
if(new Set(files).size!==files.length)throw Error('The same report was supplied more than once.');
const prefix=resolve(output),pathKey=path=>process.platform==='win32'?path.toLowerCase():path;
if(files.some(file=>[prefix+'.json',prefix+'.md'].some(target=>pathKey(file)===pathKey(target))))throw Error('Summary output must not overwrite an input report.');

const round=n=>Math.round(n*10)/10;
function stats(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;
  return n?{n,median:round(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2),min:round(sorted[0]),max:round(sorted[n-1])}:null;
}
const groupBy=(values,key)=>{const groups=new Map();for(const item of values){const k=key(item);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}return groups;};
const metric=(rows,key)=>stats(rows.map(row=>row[key]));
const interval=(rows,start,end)=>stats(rows.map(row=>Number.isFinite(row[start])&&Number.isFinite(row[end])?row[end]-row[start]:NaN));
const clean=value=>String(value??'').replaceAll('|','\\|').replace(/[\r\n]/g,' ');
const fmt=value=>value?`${value.median.toFixed(1)} [${value.min.toFixed(1)}–${value.max.toFixed(1)}]`:'—';
const steps=['initial_login_page','login','choose_grade','home','choose_grade_repeat','choose_unit','choose_lesson','content','game','simulation','game_repeat','content_repeat','simulation_repeat','home_repeat','teacher_refresh','teacher_student_results'];
const compareStep=(a,b)=>(['before','after'].indexOf(a.variant)-['before','after'].indexOf(b.variant))||a.role.localeCompare(b.role)||(steps.indexOf(a.step)-steps.indexOf(b.step))||a.step.localeCompare(b.step);

function summarizeGroup(rows){
  const first=rows[0],calls=rows.flatMap(row=>(row.api||[]).map(call=>({...call,sample:row.sample})));
  const api=[...groupBy(calls,call=>call.action)].map(([action,items])=>({action,calls:items.length,samples:new Set(items.map(item=>item.sample)).size,completed:items.filter(item=>Number.isFinite(item.completeMs)).length,ok:items.filter(item=>item.ok===true).length,completeMs:metric(items,'completeMs'),headersMs:metric(items,'headersMs'),bodyAfterHeadersMs:interval(items,'headersMs','completeMs'),staffBootstrap:items.filter(item=>item.staffBootstrap===true).length}));
  const resources=rows.flatMap(row=>(row.resources||[]).map(resource=>({...resource,sample:row.sample})));
  const resourceGroups=[...groupBy(resources,item=>item.path)].map(([path,items])=>({path,requests:items.length,samples:new Set(items.map(item=>item.sample)).size,durationMs:metric(items,'ms'),finishAfterClickMs:metric(items,'finishMs'),decodedBytes:metric(items,'bytes')}));
  // Finish times identify observed dependencies, not a proof that each one blocked rendering.
  const topResources=resourceGroups.sort((a,b)=>(b.finishAfterClickMs?.median||0)-(a.finishAfterClickMs?.median||0)).slice(0,5);
  const spanNames=[...new Set(rows.flatMap(row=>(row.spans||[]).map(span=>span.name)))];
  const spans=spanNames.map(name=>({name,totalMs:stats(rows.map(row=>(row.spans||[]).filter(span=>span.name===name).reduce((sum,span)=>sum+span.ms,0))),calls:stats(rows.map(row=>(row.spans||[]).filter(span=>span.name===name).length))}));
  return {variant:first.variant,role:first.role,step:first.name,n:rows.length,samples:rows.map(row=>row.sample),samplesFromFailedRuns:rows.filter(row=>!row.runPassed).length,displayMs:metric(rows,'displayMs'),dataMs:metric(rows,'dataMs'),readyMs:metric(rows,'readyMs'),afterDisplayToDataMs:interval(rows,'displayMs','dataMs'),afterDataToReadyMs:interval(rows,'dataMs','readyMs'),longTaskMs:metric(rows,'longTaskMs'),longestTaskMs:metric(rows,'longestTaskMs'),storageReads:metric(rows,'storageReads'),storageMs:metric(rows,'storageMs'),lazyPending:metric(rows,'lazyPending'),api,topResources,spans};
}

const summary={createdAt:new Date().toISOString(),units:'milliseconds unless named otherwise',statistics:'median [min–max]; no p95 estimate from small samples; completed steps in failed journeys retained and marked',interpretation:'Each input report remains separate. Comparisons are descriptive observations, not proof of general speed or capacity. One sample is a smoke check only.',reports:[]};
for(const source of files){
  const report=JSON.parse(await readFile(source,'utf8'));
  if(!Array.isArray(report.runs)||typeof report.mode!=='string'||!report.conditions)throw Error('Not a navigation-performance report: '+source);
  const rows=report.runs.flatMap(run=>(run.steps||[]).map(step=>({...step,variant:run.variant,role:run.role,sample:run.sample,runPassed:run.passed===true})));
  const groups=[...groupBy(rows,row=>JSON.stringify([row.variant,row.role,row.name])).values()].map(summarizeGroup).sort(compareStep);
  const comparisons=[];
  for(const after of groups.filter(group=>group.variant==='after')){
    const before=groups.find(group=>group.variant==='before'&&group.role===after.role&&group.step===after.step);if(!before)continue;
    const delta=key=>before[key]&&after[key]?round(after[key].median-before[key].median):null;
    comparisons.push({role:after.role,step:after.step,beforeN:before.n,afterN:after.n,evidence:Math.min(before.n,after.n)<3?'smoke only; insufficient repeated observations':report.passed!==true?'incomplete/failed journey; inspect failures':'descriptive small-sample comparison; inspect range',displayMedianDeltaMs:delta('displayMs'),dataMedianDeltaMs:delta('dataMs'),readyMedianDeltaMs:delta('readyMs')});
  }
  summary.reports.push({source,mode:report.mode,backendPhase:report.backendPhase,createdAt:report.createdAt,baselineCommit:report.baselineCommit,beforeBackendSHA256:report.beforeBackendSHA256,afterBackendSHA256:report.afterBackendSHA256,liveBackendVerified:report.liveBackendVerified,browserVersion:report.browserVersion,conditions:report.conditions,passed:report.passed===true,runs:report.runs.length,failedRuns:report.runs.filter(run=>run.passed!==true).length,blockedWrites:report.blockedWrites,cleanupFailures:report.cleanupFailures,failures:(report.failures||[]).map(f=>({variant:f.variant,role:f.role,sample:f.sample,step:f.step,type:f.type})),groups,comparisons});
}

const markdown=[
  '# Navigation timing measurements','',
  'Times are milliseconds: **median [min–max]**. Each report is kept separate by backend mode and phase. A single sample is a smoke check, not evidence of improvement; 3–5 samples show only the observed range. No p95 is estimated from these small samples.','',
  'Display = click to the second animation frame after the target DOM becomes visible (a paint opportunity proxy). Data = required controls/data are available; Simulation includes its first rendered frame. Ready = data plus decoded current viewport/non-lazy images, fonts and CSS backgrounds. Initial Login starts at navigation time 0. Offscreen lazy images are excluded and counted separately.','',
  'API time runs from fetch start through complete JSON parsing, including redirects. “After data → ready” also includes decode and frame scheduling; it is not purely download time. Listed resources are observed dependencies, not proof that each blocked the page. Repeat steps reuse in-memory modules; the report cache condition governs HTTP caching.',''
];
for(const report of summary.reports){
  markdown.push(`## ${clean(report.mode)} — ${clean(report.backendPhase)}`,'',`Source: \`${clean(report.source)}\`. Captured: ${clean(report.createdAt)}. Runs: ${report.runs}; failed/incomplete: ${report.failedRuns}; blocked writes: ${report.blockedWrites??'unknown'}; cleanup failures: ${report.cleanupFailures??'unknown'}.`,'',`Before commit: \`${clean(report.baselineCommit)}\`. Local Code.gs SHA-256: before \`${clean(report.beforeBackendSHA256??'not recorded')}\`; after \`${clean(report.afterBackendSHA256??'not recorded')}\`.`,'',`Chrome ${clean(report.browserVersion)}; ${clean(report.conditions.viewport)}; motion: ${clean(report.conditions.motion)}. ${clean(report.conditions.network)}. Cache: ${clean(report.conditions.cache)}.`,'');
  if(report.conditions.backend)markdown.push('Backend: '+clean(report.conditions.backend)+'.','');
  if(report.liveBackendVerified===false||(/\+ live Apps Script/.test(report.mode)&&report.liveBackendVerified!==true))markdown.push('**Remote Apps Script version is unverified; local snapshot hashes do not identify the deployed backend.**','');
  if(report.groups.some(group=>group.n<3))markdown.push('**Some rows have fewer than 3 samples: treat those as smoke results only.**','');
  if(!report.passed)markdown.push('**This report did not complete successfully. Completed steps are retained; inspect failed steps before using comparisons.**','');
  markdown.push('| Variant | Role | Step | n | Display | Data | Ready |','| --- | --- | --- | ---: | ---: | ---: | ---: |');
  for(const group of report.groups)markdown.push(`| ${clean(group.variant)} | ${clean(group.role)} | ${clean(group.step)} | ${group.n}${group.samplesFromFailedRuns?'*':''} | ${fmt(group.displayMs)} | ${fmt(group.dataMs)} | ${fmt(group.readyMs)} |`);
  markdown.push('','*Asterisk on n: at least one measured step belongs to a journey that later failed.*','',
    '| Variant | Role | Step | After display → data | After data → ready | Long-task total | Longest task | Offscreen lazy pending (count) |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |');
  for(const group of report.groups)markdown.push(`| ${clean(group.variant)} | ${clean(group.role)} | ${clean(group.step)} | ${fmt(group.afterDisplayToDataMs)} | ${fmt(group.afterDataToReadyMs)} | ${fmt(group.longTaskMs)} | ${fmt(group.longestTaskMs)} | ${fmt(group.lazyPending)} |`);
  const withApi=report.groups.filter(group=>group.api.length);
  if(withApi.length){
    markdown.push('','### Complete API response time','','| Variant | Role / step | Action | Calls / completed / OK | Headers | Complete JSON | Body after headers |','| --- | --- | --- | ---: | ---: | ---: | ---: |');
    for(const group of withApi)for(const api of group.api)markdown.push(`| ${clean(group.variant)} | ${clean(group.role)} / ${clean(group.step)} | ${clean(api.action)} | ${api.calls} / ${api.completed} / ${api.ok} | ${fmt(api.headersMs)} | ${fmt(api.completeMs)} | ${fmt(api.bodyAfterHeadersMs)} |`);
  }
  const withSpans=report.groups.filter(group=>group.spans.length);
  if(withSpans.length){
    markdown.push('','### Instrumented JavaScript spans','','Synchronous function time only; asynchronous loading, layout and GPU work can occur outside these spans. Calls are summed per sample before summarizing.','','| Variant | Role / step | Function | Total time per sample | Calls per sample |','| --- | --- | --- | ---: | ---: |');
    for(const group of withSpans)for(const span of group.spans)markdown.push(`| ${clean(group.variant)} | ${clean(group.role)} / ${clean(group.step)} | \`${clean(span.name)}\` | ${fmt(span.totalMs)} | ${fmt(span.calls)} |`);
  }
  const resources=report.groups.filter(group=>group.topResources.length);
  if(resources.length){
    markdown.push('','### Latest finishing local resources','','Up to five per measured step, ordered by median finish time relative to the click (or initial navigation). Requests can overlap. Resource data alone does not measure image decode or GPU work.','','| Variant | Role / step | Resource | Samples seen | Duration | Finish after click/navigation |','| --- | --- | --- | ---: | ---: | ---: |');
    for(const group of resources)for(const resource of group.topResources)markdown.push(`| ${clean(group.variant)} | ${clean(group.role)} / ${clean(group.step)} | \`${clean(resource.path)}\` | ${resource.samples} | ${fmt(resource.durationMs)} | ${fmt(resource.finishAfterClickMs)} |`);
  }
  if(report.comparisons.length){
    markdown.push('','### Within-report median differences','','After minus before; negative values are lower observed times. These differences do not establish causation, especially where sample ranges overlap.','','| Role | Step | Before n / after n | Display Δ | Data Δ | Ready Δ | Evidence |','| --- | --- | ---: | ---: | ---: | ---: | --- |');
    for(const item of report.comparisons)markdown.push(`| ${clean(item.role)} | ${clean(item.step)} | ${item.beforeN} / ${item.afterN} | ${item.displayMedianDeltaMs??'—'} | ${item.dataMedianDeltaMs??'—'} | ${item.readyMedianDeltaMs??'—'} | ${clean(item.evidence)} |`);
  }
  if(report.failures.length){markdown.push('','Failed steps: '+report.failures.map(f=>`${clean(f.variant)}/${clean(f.role)}/${clean(f.step)} (sample ${f.sample}, ${clean(f.type)})`).join('; ')+'.');}
  markdown.push('');
}
await mkdir(dirname(prefix),{recursive:true});
await writeFile(prefix+'.json',JSON.stringify(summary,null,2)+'\n');
await writeFile(prefix+'.md',markdown.join('\n')+'\n');
console.log(JSON.stringify({markdown:prefix+'.md',json:prefix+'.json',reports:summary.reports.map(report=>({mode:report.mode,backendPhase:report.backendPhase,groups:report.groups.length,runs:report.runs,passed:report.passed}))},null,2));
