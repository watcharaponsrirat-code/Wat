import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');
let seed=20261006;
const math=Object.create(Math);
math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const context=vm.createContext({window:{},Math:math});
const data=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].startsWith('window.SLH_DATA='))[1];
vm.runInContext(data,context);
for(const file of ['bank','grade1','grade2','grade3'])vm.runInContext(await readFile(new URL('assets/exercises/'+file+'.js',root),'utf8'),context);
for(const file of ['engine','grade1','grade2','grade3'])vm.runInContext(await readFile(new URL('assets/exams/'+file+'.js',root),'utf8'),context);
vm.runInContext('const PACKS=window.SLH_DATA.packs,ACT=window.SLH_DATA.activities; let SESSION={lesson:{id:null}};',context);
for(const name of ['shuffle','sample','unique','wrongBody','bodyOptions','practicePool','buildExamAttempt']){
  const line=html.split(/\r?\n/).find(s=>s.startsWith('function '+name+'('));
  if(!line)throw Error('Missing function '+name);
  vm.runInContext(line,context);
}
const lessons=Object.values(context.window.SLH_DATA.curriculum).flatMap(units=>units.flatMap(u=>u.lessons));
const rows=[];
for(const lesson of lessons){
  context.lessonId=lesson.id;
  const pool=vm.runInContext('SESSION.lesson.id=lessonId;window.SLH_FINAL_EXAMS.bank[lessonId]',context);
  let duplicateForms=0,missingTopicForms=0,minTopics=Infinity,maxTopics=0,example=null;
  const topics=context.window.SLH_DATA.packs[lesson.id].map(s=>s.code).filter(code=>!['G3U3L1S6','G3U3L2S7'].includes(code));
  const analysis=pool.filter(q=>q.type==='analyze'&&q.opts.every(o=>o.includes(' | ')));
  const patternSolvable=analysis.filter(q=>{
    const pairs=q.opts.map(o=>o.split(' | '));
    const mode=col=>pairs.map(p=>p[col]).sort((a,b)=>pairs.filter(p=>p[col]===b).length-pairs.filter(p=>p[col]===a).length)[0];
    return mode(0)+' | '+mode(1)===q.correct;
  }).length;
  for(let i=0;i<100;i++){
    const qs=vm.runInContext('buildExamAttempt().qs',context);
    if(new Set(qs.map(q=>q.q)).size<qs.length)duplicateForms++;
    const codes=new Set(qs.map(q=>q.code));
    const covered=topics.filter(c=>codes.has(c)).length;
    if(covered<topics.length)missingTopicForms++;
    minTopics=Math.min(minTopics,covered);maxTopics=Math.max(maxTopics,covered);
    if(i===0)example=qs;
  }
  rows.push({id:lesson.id,title:lesson.title,pool:pool.length,types:Object.fromEntries(['understand','apply','analyze'].map(t=>[t,pool.filter(q=>q.type===t).length])),patternSolvable,topics:topics.length,minTopics,maxTopics,duplicateForms,missingTopicForms,labQuestions:pool.filter(q=>/LAB[123]$/.test(q.code)),example});
}
const report={version:context.window.SLH_FINAL_EXAMS.version,seed:20261006,formsPerLesson:100,lessons:rows.length,duplicateForms:rows.reduce((n,r)=>n+r.duplicateForms,0),missingTopicForms:rows.reduce((n,r)=>n+r.missingTopicForms,0),rows};
await mkdir(new URL('tmp/',root),{recursive:true});
await writeFile(new URL('tmp/final-exam-audit.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:rows.map(({example,labQuestions,...r})=>r)},null,2));
