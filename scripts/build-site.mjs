import {readFile,writeFile,mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve,join,extname,posix} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));

const digest=content=>createHash('sha256').update(content).digest('hex').slice(0,16);
const localPath=url=>url.split(/[?#]/)[0];
const localResource=url=>!!url&&!/^(?:[a-z][\w+.-]*:|\/|#)/i.test(url);
const entryResources=html=>[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="/g)].length;
const blank=html=>!html.replace(/<!--[\s\S]*?-->/g,'').trim();
const cssString=String.raw`(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')`;
const cssURL=String.raw`url\(\s*(?:${cssString}|(?:\\[\s\S]|[^()"'])*)\s*\)`;
const cssToken=new RegExp(String.raw`/\*[\s\S]*?\*/|${cssString}|@import\b(?:${cssURL}|${cssString}|[^;])*;|@(?:charset|namespace)\b|${cssURL}`,'gi');
function unquote(value){
  let text=value.trim();if(/^['"]/.test(text))text=text.slice(1,-1);
  return text.replace(/\\(?:([\da-f]{1,6})\s?|\r\n|\n|\r|([\s\S]))/gi,(_,hex,char)=>hex?String.fromCodePoint(parseInt(hex,16)||0xfffd):(char||''));
}
function cssReference(value,source){
  if(!localResource(value))return value;
  // A sentinel directory also catches URLs escaping a project deployment's
  // subpath; resolving against the origin alone silently clips those ../ parts.
  const resolved=new URL(value,'https://slh.invalid/__site__/'+source);
  if(!resolved.pathname.startsWith('/__site__/'))throw Error('CSS URL outside deployment: '+value+' in '+source);
  return resolved.pathname.slice('/__site__/'.length)+resolved.search+resolved.hash;
}
// Resolve URLs against each original sheet, then concatenate in cascade order.
// CSS imports behave as rules at the import position (CSS Cascade §2). Expand
// local unconditional imports; reject unsupported imports rather than silently
// moving them after ordinary rules, where the browser would discard them.
export async function bundleCSS(content,source,readSource,stack=[]){
  if(stack.includes(source))throw Error('Circular stylesheet import: '+source);
  let result='',cursor=0;
  for(const token of content.matchAll(cssToken)){
    result+=content.slice(cursor,token.index);const raw=token[0];
    if(/^@import\b/i.test(raw)){
      const imported=raw.match(new RegExp(String.raw`^@import\s+(${cssURL}|${cssString})\s*;$`,'i'));
      if(!imported)throw Error('Only unconditional local CSS imports can be bundled: '+source);
      const value=unquote(imported[1].replace(/^url\(\s*|\s*\)$/gi,''));
      if(/^(?:[a-z][\w+.-]*:|\/|#)/i.test(value))throw Error('CSS import must be local: '+source);
      const path=localPath(cssReference(value,source));
      result+='\n'+await bundleCSS(await readSource(path),path,readSource,[...stack,source])+'\n';
    }else if(/^@(?:charset|namespace)\b/i.test(raw)){
      throw Error('Sheet-scoped CSS directive cannot be concatenated: '+source);
    }else if(/^url\(/i.test(raw)){
      const value=unquote(raw.slice(raw.indexOf('(')+1,-1));
      const rebased=cssReference(value,source);
      result+=rebased===value?raw:'url('+JSON.stringify(rebased)+')';
    }else result+=raw;
    cursor=token.index+raw.length;
  }
  return result+content.slice(cursor);
}

export async function bundleResources(html,readSource,writeBundle){
  const bundles=[];
  async function combine(matches,canJoin,create){
    const groups=[];
    for(const match of matches){
      const previous=groups.at(-1)?.at(-1);
      if(previous&&blank(html.slice(previous.index+previous[0].length,match.index))&&await canJoin(previous,match))groups.at(-1).push(match);
      else groups.push([match]);
    }
    let result='',cursor=0;
    for(const group of groups){
      result+=html.slice(cursor,group[0].index)+await create(group);
      const last=group.at(-1);cursor=last.index+last[0].length;
    }
    html=result+html.slice(cursor);
  }
  await combine([...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].filter(m=>localResource(m[1])),()=>true,async group=>{
    const sources=group.map(m=>localPath(m[1]));
    const content=(await Promise.all(sources.map(async source=>bundleCSS(await readSource(source),source,readSource)))).join('\n');
    const file=`inline-${digest(content)}.css`;
    await writeBundle(file,content);
    bundles.push({file,type:'css',sources,bytes:Buffer.byteLength(content),gzipBytes:gzipSync(content).length});
    return `<link rel="stylesheet" href="${file}">`;
  });
  const scripts=[...html.matchAll(/<script( defer)? src="([^"]+)"><\/script>/g)].filter(m=>localResource(m[2]));
  const contents=new Map(await Promise.all(scripts.map(async m=>[localPath(m[2]),await readSource(localPath(m[2]))])));
  const canBundle=match=>{
    const source=localPath(match[2]);
    // Configuration stays independently replaceable. Script-relative inspection
    // and top-level strict directives also require a separate script element.
    const code=contents.get(source).replace(/^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*/,'');
    return !source.endsWith('/sheets-config.js')&&!/document\s*\.\s*currentScript\b/.test(code)&&!/^(['"])use strict\1(?:\s*;|\s*$|\s*\n)/.test(code);
  };
  await combine(scripts,(a,b)=>a[1]===b[1]&&posix.dirname(localPath(a[2]))===posix.dirname(localPath(b[2]))&&canBundle(a)&&canBundle(b),async group=>{
    if(group.length===1)return group[0][0];
    const sources=group.map(m=>localPath(m[2]));
    const content=sources.map(source=>contents.get(source)).join('\n;\n');
    // Same directory preserves relative dynamic-import resolution without
    // rewriting a byte of the original scripts or changing their defer phase.
    const file=posix.join(posix.dirname(sources[0]),`bundle-${digest(content)}.js`);
    await writeBundle(file,content);
    bundles.push({file,type:'js',defer:!!group[0][1],sources,bytes:Buffer.byteLength(content),gzipBytes:gzipSync(content).length});
    return `<script${group[0][1]||''} src="${file}"></script>`;
  });
  return {html,bundles};
}

export async function buildSite(destination=join(root,'_site')){
  const output=resolve(destination);
  // Refuse to overwrite source files or reuse a stale deployment directory.
  if(output===resolve(root)||!output.startsWith(resolve(root)+ (process.platform==='win32'?'\\':'/')))throw Error('Build directory must be inside the project');
  await mkdir(output,{recursive:false});
  const report={sourceHTMLBytes:0,htmlBytes:0,htmlGzipBytes:0,files:0,assetBytes:0,extracted:[],bundles:[]};
  const allowed=new Set(['.js','.css','.svg','.png','.jpg','.jpeg','.webp','.woff','.woff2','.ico']);
  async function copyAssets(source,target){
    await mkdir(target,{recursive:true});
    for(const entry of await readdir(source,{withFileTypes:true})){
      const from=join(source,entry.name),to=join(target,entry.name);
      if(entry.isDirectory())await copyAssets(from,to);
      else if(allowed.has(extname(entry.name))||/^(LICENSE|NOTICE)(\.|$)/i.test(entry.name)){
        await copyFile(from,to);report.files++;report.assetBytes+=(await stat(from)).size;
      }
    }
  }
  await copyAssets(join(root,'assets'),join(output,'assets'));
  let html=await readFile(join(root,'index.html'),'utf8');report.sourceHTMLBytes=Buffer.byteLength(html);
  const pending=[];
  function extract(content,extension){
    const hash=digest(content);
    // Root-level CSS preserves the original relative image URLs and Pages subpaths.
    const name=`inline-${hash}.${extension}`;
    pending.push(writeFile(join(output,name),content));
    report.extracted.push({file:name,bytes:Buffer.byteLength(content),gzipBytes:gzipSync(content).length});
    return name;
  }
  html=html.replace(/<style>([\s\S]*?)<\/style>/g,(_,css)=>`<link rel="stylesheet" href="${extract(css,'css')}">`);
  html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(tag,attrs,js)=>{
    // Extract only plain inline classic scripts. JSON/import-map blocks need
    // inline text, and making an inline defer/async script external changes timing.
    if(attrs.trim()||!js.trim())return tag;
    return `<script${attrs} src="${extract(js,'js')}"></script>`;
  });
  await Promise.all(pending);
  const readSource=async path=>{
    const file=resolve(output,decodeURIComponent(path));
    if(!file.startsWith(output+(process.platform==='win32'?'\\':'/')))throw Error('Resource outside deployment: '+path);
    return readFile(file,'utf8');
  };
  report.entryResourcesBefore=entryResources(html);
  const combined=await bundleResources(html,readSource,(file,content)=>writeFile(join(output,file),content));
  html=combined.html;report.bundles=combined.bundles;
  report.entryResourcesAfter=entryResources(html);
  report.htmlBytes=Buffer.byteLength(html);report.htmlGzipBytes=gzipSync(html).length;
  await writeFile(join(output,'index.html'),html);
  await writeFile(join(output,'.nojekyll'),'');
  await writeFile(join(output,'build-report.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildSite(process.argv[2]),null,2));
