import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve,join,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleCSS} from '../scripts/build-site.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,process.argv[2]||'_site');
const original=await readFile(join(root,'index.html'),'utf8');
const deployed=await readFile(join(output,'index.html'),'utf8');
const report=JSON.parse(await readFile(join(output,'build-report.json'),'utf8'));
const scripts=html=>[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const path=url=>url.split(/[?#]/)[0];
const extracted=(code,extension)=>`inline-${createHash('sha256').update(code).digest('hex').slice(0,16)}.${extension}`;
const originals=new Map();
const expectedScripts=[];
for(const match of scripts(original)){
  const src=match[1].match(/src="([^"]+)"/);
  const source=src?path(src[1]):extracted(match[2],'js');
  const code=src?await readFile(join(root,decodeURIComponent(source)),'utf8'):match[2];
  originals.set(source,code);
  expectedScripts.push({source,code,defer:/\bdefer\b/.test(match[1])});
}
const actualScripts=[];
for(const match of scripts(deployed)){
  const src=match[1].match(/src="([^"]+)"/);
  assert(src,'Plain inline scripts must be extracted');
  const file=path(src[1]),defer=/\bdefer\b/.test(match[1]);
  const bundle=report.bundles.find(b=>b.type==='js'&&b.file===file);
  const sources=bundle?.sources||[file];
  const contents=await Promise.all(sources.map(source=>readFile(join(output,source),'utf8')));
  assert.equal(await readFile(join(output,file),'utf8'),contents.join('\n;\n'),'Bundle retains every original script byte with a safe separator');
  if(bundle){
    assert.equal(bundle.defer,defer,'Manifest agrees with script execution phase');
    for(const source of sources)assert.equal(posix.dirname(file),posix.dirname(source),'Relative dynamic imports retain their base directory');
  }
  actualScripts.push(...sources.map((source,i)=>({source,code:contents[i],defer})));
}
assert.deepEqual(actualScripts,expectedScripts,'Expanded deployed scripts retain exact source identities, bytes, order and defer phases');
assert(deployed.includes('src="assets/integrations/sheets-config.js"'),'Public configuration stays independently replaceable');
assert(!/data:image\//.test(original),'Branding images must be reusable external files');
assert(Buffer.byteLength(deployed)<10000,'Deployment HTML budget: 10 KB');

const expectedStyles=[];
for(const match of original.matchAll(/<link rel="stylesheet" href="([^"]+)">|<style>([\s\S]*?)<\/style>/g)){
  const source=match[1]?path(match[1]):extracted(match[2],'css');
  const code=match[1]?await readFile(join(root,decodeURIComponent(source)),'utf8'):match[2];
  originals.set(source,code);expectedStyles.push(source);
}
const actualStyles=[];
const readOriginal=async source=>originals.has(source)?originals.get(source):readFile(join(root,decodeURIComponent(source)),'utf8');
for(const match of deployed.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)){
  const file=path(match[1]),bundle=report.bundles.find(b=>b.type==='css'&&b.file===file);
  assert(bundle,'Every bundled stylesheet has a manifest entry');
  actualStyles.push(...bundle.sources);
  const expected=(await Promise.all(bundle.sources.map(async source=>bundleCSS(await readOriginal(source),source,readOriginal)))).join('\n');
  assert.equal(await readFile(join(output,file),'utf8'),expected,'All stylesheet rules and imported rules retain cascade order');
}
assert.deepEqual(actualStyles,expectedStyles,'All original stylesheets retain cascade order');
for(const asset of [...report.extracted,...report.bundles]){
  const bytes=await readFile(join(output,asset.file));
  assert.equal(asset.bytes,bytes.length,asset.file+' byte count');
  assert.equal(asset.gzipBytes,gzipSync(bytes).length,asset.file+' gzip count');
}
const entryResources=html=>[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="/g)].length;
assert.equal(report.entryResourcesBefore,entryResources(original)+report.extracted.length,'Resource count comes from input HTML');
assert.equal(report.entryResourcesAfter,entryResources(deployed),'Resource count comes from deployed HTML');
assert(report.entryResourcesAfter<report.entryResourcesBefore,'Bundling reduces entry resources');
assert.equal(report.sourceHTMLBytes,Buffer.byteLength(original));
assert.equal(report.htmlBytes,Buffer.byteLength(deployed));
assert.equal(report.htmlGzipBytes,gzipSync(deployed).length);
for(const m of deployed.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^[a-z]+:/i.test(m[1]))continue;
  assert((await stat(join(output,decodeURIComponent(path(m[1]))))).isFile(),m[1]);
}
// Include computed reading-image URLs used by the load scenario.
for(let i=1;i<=6;i++)assert((await stat(join(output,`assets/lessons/G1U1L1-${String(i).padStart(2,'0')}.jpg`))).isFile());
console.log({checks:['script byte equality/order/defer phases','dynamic-import directories','replaceable public configuration','CSS cascade/imports','measured report sizes/counts','HTML size budget','all entry resources and load-test figures exist'],entryResourcesBefore:report.entryResourcesBefore,entryResourcesAfter:report.entryResourcesAfter});
