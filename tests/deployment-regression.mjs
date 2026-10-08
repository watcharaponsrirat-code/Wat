import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,process.argv[2]||'_site');
const original=await readFile(join(root,'index.html'),'utf8');
const deployed=await readFile(join(output,'index.html'),'utf8');
const scripts=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
async function sources(html,base){
  return Promise.all(scripts(html).map(async match=>{
    const src=match[1].match(/src="([^"]+)"/);
    return src?readFile(join(base,src[1].split('?')[0]),'utf8'):match[2];
  }));
}
assert.deepEqual(await sources(deployed,output),await sources(original,root),'Deployed scripts retain exact contents and execution order');
assert.deepEqual(scripts(deployed).map(m=>/\bdefer\b/.test(m[1])),scripts(original).map(m=>/\bdefer\b/.test(m[1])));
assert(!/data:image\//.test(original),'Branding images must be reusable external files');
assert(Buffer.byteLength(deployed)<10000,'Deployment HTML budget: 10 KB');
const oldStyles=[...original.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
const newStyles=[...deployed.matchAll(/href="(inline-[a-f0-9]+\.css)"/g)];
assert.deepEqual(await Promise.all(newStyles.map(m=>readFile(join(output,m[1]),'utf8'))),oldStyles);
for(const m of deployed.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^[a-z]+:/i.test(m[1]))continue;
  assert((await stat(join(output,m[1].split('?')[0]))).isFile(),m[1]);
}
// Include computed reading-image URLs used by the load scenario.
for(let i=1;i<=6;i++)assert((await stat(join(output,`assets/lessons/G1U1L1-${String(i).padStart(2,'0')}.jpg`))).isFile());
console.log({checks:['script byte equality/order','deferred execution preserved','CSS byte equality','HTML size budget','all entry resources and load-test figures exist']});
