import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const baseline='ed40b472b37fdcbb294be3acca0750be572e2867';
const original=execFileSync('git',['show',baseline+':index.html'],{maxBuffer:10*1024*1024}).toString('utf8');
const current=await readFile('index.html','utf8');
const inline=s=>[...s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('src=')).map(m=>m[2]);
assert.deepEqual(inline(current),inline(original),'Every original inline data and application script must remain byte-for-byte identical');
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline],{encoding:'utf8'}).trim().split('\n').filter(p=>/^assets\/(content|exams|exercises|games|labs|simulations|lessons|units)\//.test(p));
const verified=[];
for(const file of files){let before=execFileSync('git',['show',baseline+':'+file],{maxBuffer:20*1024*1024});let after=await readFile(file);if(/\.(js|css|json|jsonl|md|txt|svg)$/.test(file)){before=Buffer.from(before.toString('utf8').replace(/\r\n/g,'\n'));after=Buffer.from(after.toString('utf8').replace(/\r\n/g,'\n'))}assert.equal(hash(after),hash(before),file+' must remain identical (Git checkout line endings normalized)');verified.push({file,sha256:hash(after)})}
const context=vm.createContext({window:{}});vm.runInContext(inline(current)[0],context);const data=context.window.SLH_DATA;
const curriculum=data.curriculum;const lessons=Object.values(curriculum).flatMap(units=>units.flatMap(u=>u.lessons));
const covers=JSON.parse(current.match(/const LESSON_COVERS=(\{[^;]+\});/)[1]);
assert.equal(Object.keys(covers).length,lessons.length);
for(const lesson of lessons){assert(covers[lesson.id].includes('/'+lesson.id+'-'),lesson.id+' cover must match lesson');assert((await stat(covers[lesson.id])).size>0)}
const report={baseline,inlineScripts:'Exact byte comparison passed',protectedFiles:verified.length,grades:Object.keys(curriculum).length,units:Object.values(curriculum).reduce((n,u)=>n+u.length,0),lessons:lessons.length,sections:Object.values(data.packs).reduce((n,s)=>n+s.length,0),coverMappings:lessons.map(l=>({id:l.id,title:l.title,asset:covers[l.id]})),verified};
await mkdir('tmp/voxel-audit',{recursive:true});await writeFile('tmp/voxel-audit/integrity.json',JSON.stringify(report,null,2));
console.log({...report,coverMappings:report.coverMappings.length,verified:undefined});
