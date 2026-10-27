import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
// Pin the completed presentation before the authorized Google Sheets adapter.
// Authentication and activity handlers now have dedicated integration tests.
const baseline='186dfb1';
const before=execFileSync('git',['show',`${baseline}:index.html`],{encoding:'utf8',maxBuffer:4*1024*1024});
const after=await readFile('index.html','utf8');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))).replace(/\r\n/g,'\n');
const preservedDashboard=section(after,'function renderDashboard(){','function unitImage(')
  .replace(' window.SLH_TEACHER.mount(app,context);\n','')
  .replace(/ const staffView=[^\n]+\n \/\/ One snapshot per render;[^\n]+\n const progress=[^\n]+\n/,'')
  .replace('staffView,stats:staffView?null:userStats(readProgress)','stats:userStats()')
  .replace('getProgress:readProgress','getProgress:getP');
assert.equal(preservedDashboard,section(before,'function renderDashboard(){','function unitImage('),'Original dashboard and grade presentation preserved except for the scoped render snapshot and staff shortcut');
assert.deepEqual([...after.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1].replace(/\r\n/g,'\n')),[...before.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1].replace(/\r\n/g,'\n')),'Existing inline theme remains unchanged');
const data=source=>[...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('window.SLH_DATA='))?.[1].replace(/\r\n/g,'\n');
assert.equal(data(after),data(before),'Curriculum data and IDs remain unchanged');
const protectedFiles=execFileSync('git',['ls-tree','-r','--name-only',baseline,'assets/login','assets/content','assets/exams','assets/exercises','assets/games','assets/labs','assets/lessons','assets/simulations','assets/theme','assets/units','tests'],{encoding:'utf8'}).trim().split('\n');
const changed=execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'}).trim().split('\n');
const authorized=new Set(['assets/login/login-ui.js','assets/games/engine.js','assets/exercises/onet-practice.js','assets/simulations/engine.js','tests/plant-growth-regression.mjs','tests/dashboard-premium-regression.mjs','tests/login-redesign-regression.mjs','tests/exercise-regression.mjs','tests/game-regression.mjs','tests/deployment-browser.mjs']);
// Already reviewed and published in 8062673 (leaf cache and deployment verification).
for(const file of ['assets/simulations/plant-growth-leaf-surface.js','tests/deployment-regression.mjs','tests/plant-growth-model-browser.mjs'])authorized.add(file);
assert.deepEqual(changed.filter(path=>protectedFiles.includes(path)&&!authorized.has(path)),[],'Only reviewed integration hooks and their preservation assertions may change');
const js=await readFile('assets/dashboard/dashboard.js','utf8');new vm.Script(js);
assert(!/localStorage|sessionStorage|saveP\(/.test(js),'Dashboard must not write storage');
const writes=[];const context={window:{}};vm.runInNewContext(js,context);
const base=()=>({contentIndex:0,contentDone:false,resume:'content',visited:{},xp:0,exam:{passed:false,attempts:0},ex:{e1:{done:false},e2:{done:false},e3:{done:false}},games:{g1:{done:false},g2:{done:false},g3:{done:false}}});
const lesson=(id)=>({id,title:'Lesson '+id});const lessons={A:lesson('A'),B:lesson('B'),C:lesson('C')};
let saved={A:base(),B:base(),C:base()};
const ctx={user:{id:'S',name:'<student>',grade:2},grade:1,stats:{done:0,total:3},lessons,meta:{A:{grade:1},B:{grade:2},C:{grade:2}},curriculum:{1:[{lessons:[lessons.A]}],2:[{lessons:[lessons.B,lessons.C]}]},getProgress:id=>saved[id],escape:s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'),stageNames:{content:'content',e2:'e2'}};
let markup=context.window.SLH_DASHBOARD.render(ctx);assert(markup.includes('data-dashboard-resume data-lesson="B"'));assert(markup.includes('&lt;student&gt;'));
saved.A.visited.content=true;markup=context.window.SLH_DASHBOARD.render(ctx);assert(markup.includes('data-dashboard-resume data-lesson="A"'),'Started other grade beats untouched current grade');
saved.C.resume='e2';markup=context.window.SLH_DASHBOARD.render(ctx);assert(markup.includes('data-dashboard-resume data-lesson="C"'),'Started current grade preferred');
const snapshot=JSON.stringify(saved);context.window.SLH_DASHBOARD.render(ctx);assert.equal(JSON.stringify(saved),snapshot,'Read-only model');
for(const p of Object.values(saved))p.exam.passed=true;ctx.stats.done=3;markup=context.window.SLH_DASHBOARD.render(ctx);assert(markup.includes('data-dashboard-progress>100%'));assert(markup.includes('ทบทวนบทเรียน'));
const sizes={};for(const file of await readdir('assets/dashboard'))sizes[file]=(await stat('assets/dashboard/'+file)).size;
assert(Object.entries(sizes).filter(([name])=>name.endsWith('.webp')).reduce((sum,[,size])=>sum+size,0)<350000,'New raster artwork budget');
console.log({baseline,indexScope:'PASS',protectedFiles:protectedFiles.length,readOnlyAndResumeSelection:'PASS',assets:sizes});
