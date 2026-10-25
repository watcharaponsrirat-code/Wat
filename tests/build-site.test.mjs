import assert from 'node:assert/strict';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {bundleCSS,bundleResources} from '../scripts/build-site.mjs';

test('CSS resolves each sheet and import relative to its source under a Pages subpath',async()=>{
  const sources=new Map([
    ['assets/theme/main.css','@import "../shared/base.css?v=2";\n.hero{background:url("./scene.webp?theme=1#day")}'],
    ['assets/shared/base.css','@import url("nested/fonts.css");\n.base{background:url(../images/base.png)}'],
    ['assets/shared/nested/fonts.css','@font-face{font-family:test;src:url("../../fonts/font.woff2")}']
  ]);
  const actual=await bundleCSS(sources.get('assets/theme/main.css'),'assets/theme/main.css',async path=>{
    assert(sources.has(path),path);return sources.get(path);
  });
  assert.equal(actual,'\n\n@font-face{font-family:test;src:url("assets/fonts/font.woff2")}\n\n.base{background:url("assets/images/base.png")}\n\n.hero{background:url("assets/theme/scene.webp?theme=1#day")}');
  for(const [original,source,rebased] of [
    ['./scene.webp?theme=1#day','assets/theme/main.css','assets/theme/scene.webp?theme=1#day'],
    ['../images/base.png','assets/shared/base.css','assets/images/base.png'],
    ['../../fonts/font.woff2','assets/shared/nested/fonts.css','assets/fonts/font.woff2']
  ])assert.equal(new URL(original,'https://example.test/school/'+source).href,new URL(rebased,'https://example.test/school/inline.css').href);
});

test('CSS leaves comments, strings, data, absolute and fragment URLs untouched and decodes escaped paths',async()=>{
  const css=String.raw`/* url('./ignored.png') */ .a{content:"url('./also-ignored.png')";background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E");mask:url(#shape);cursor:url(/global.cur);src:url(https://cdn.test/font.woff2)} .b{background:url('./my\20 image.webp')}`;
  const actual=await bundleCSS(css,'assets/theme/main.css',()=>assert.fail('No import expected'));
  assert.equal(actual,css.replace(String.raw`url('./my\20 image.webp')`,'url("assets/theme/my%20image.webp")'));
});

test('CSS rejects unsupported imports, cycles and project-subpath escapes instead of changing their meaning',async()=>{
  await assert.rejects(bundleCSS('@import "https://cdn.test/theme.css";','main.css',()=>''),/must be local/);
  await assert.rejects(bundleCSS('@import "small.css" screen;','main.css',()=>''),/unconditional/);
  await assert.rejects(bundleCSS('@namespace svg "http://www.w3.org/2000/svg";','main.css',()=>''),/Sheet-scoped/);
  await assert.rejects(bundleCSS('@import "main.css";','main.css',async()=> '@import "main.css";'),/Circular/);
  await assert.rejects(bundleCSS('.a{background:url(../../../outside.png)}','assets/theme/main.css',()=>''),/outside deployment/);
});

async function bundleFixture(html,files){
  const output=new Map();
  const result=await bundleResources(html,async name=>{assert(files.has(name),'Missing fixture '+name);return files.get(name);},async(name,code)=>output.set(name,code));
  return {...result,output};
}
const script=(src,attrs='')=>`<script${attrs} src="${src}"></script>`;

test('scripts keep source order, ASI boundaries, execution phases, markup boundaries and dynamic-import directories',async()=>{
  const files=new Map([
    ['assets/a/one.js','window.steps.push(1) // no trailing semicolon'],
    ['assets/a/two.js','(function(){window.steps.push(2)})()'],
    ['assets/a/three.js','window.steps.push(3);'],
    ['assets/b/four.js','window.load=()=>import("./model.mjs");'],
    ['assets/b/five.js','window.steps.push(5);'],
    ['assets/b/six.js','window.steps.push(6);'],
    ['assets/b/seven.js','window.steps.push(7);']
  ]);
  const html=script('assets/a/one.js')+'\n<!-- order -->\n'+script('assets/a/two.js')+script('assets/a/three.js',' defer')+script('assets/b/four.js',' defer')+script('assets/b/five.js',' defer')+'<div></div>'+script('assets/b/six.js',' defer')+script('assets/b/seven.js',' defer');
  const result=await bundleFixture(html,files);
  assert.deepEqual(result.bundles.map(b=>({sources:b.sources,defer:b.defer})),[
    {sources:['assets/a/one.js','assets/a/two.js'],defer:false},
    {sources:['assets/b/four.js','assets/b/five.js'],defer:true},
    {sources:['assets/b/six.js','assets/b/seven.js'],defer:true}
  ]);
  assert(result.html.includes(script('assets/a/three.js',' defer')));
  assert(result.html.includes('<div></div>'));
  const window={steps:[]};runInNewContext(result.output.get(result.bundles[0].file),{window});
  assert.deepEqual(window.steps,[1,2]);
  const dynamic=result.bundles[1];
  assert.equal(new URL('./model.mjs','https://example.test/school/'+dynamic.file).href,'https://example.test/school/assets/b/model.mjs');
});

test('runtime configuration, strict directives, currentScript, async, modules and remote resources retain separate tags',async()=>{
  const files=new Map([
    ['assets/a/one.js','window.one=1;'],
    ['assets/a/strict.js',"/* directive */\n'use strict'; window.strict=true;"],
    ['assets/a/current.js','window.source=document.currentScript.src;'],
    ['assets/a/sheets-config.js','window.config={};'],
    ['assets/a/two.js','window.two=2;']
  ]);
  const html=[script('assets/a/one.js'),script('assets/a/strict.js'),script('assets/a/current.js'),script('assets/a/sheets-config.js'),script('assets/a/two.js'),script('https://cdn.test/lib.js'),script('assets/a/missing.js',' async'),script('assets/a/module.js',' type="module"'),'<link rel="stylesheet" href="https://cdn.test/style.css">'].join('\n');
  const result=await bundleFixture(html,files);
  assert.equal(result.html,html);
  assert.deepEqual(result.bundles,[]);
});
