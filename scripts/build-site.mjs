import {readFile,writeFile,mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export async function buildSite(destination=join(root,'_site')){
  const output=resolve(destination);
  // Refuse to overwrite source files or reuse a stale deployment directory.
  if(output===resolve(root)||!output.startsWith(resolve(root)+ (process.platform==='win32'?'\\':'/')))throw Error('Build directory must be inside the project');
  await mkdir(output,{recursive:false});
  const report={sourceHTMLBytes:0,htmlBytes:0,htmlGzipBytes:0,files:0,assetBytes:0,extracted:[]};
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
    const hash=createHash('sha256').update(content).digest('hex').slice(0,16);
    // Root-level CSS preserves the original relative image URLs and Pages subpaths.
    const name=`inline-${hash}.${extension}`;
    pending.push(writeFile(join(output,name),content));
    report.extracted.push({file:name,bytes:Buffer.byteLength(content),gzipBytes:gzipSync(content).length});
    return name;
  }
  html=html.replace(/<style>([\s\S]*?)<\/style>/g,(_,css)=>`<link rel="stylesheet" href="${extract(css,'css')}">`);
  html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g,(tag,attrs,js)=>{
    if(/\bsrc\s*=/.test(attrs)||!js.trim())return tag;
    return `<script${attrs} src="${extract(js,'js')}"></script>`;
  });
  await Promise.all(pending);
  report.htmlBytes=Buffer.byteLength(html);report.htmlGzipBytes=gzipSync(html).length;
  await writeFile(join(output,'index.html'),html);
  await writeFile(join(output,'.nojekyll'),'');
  await writeFile(join(output,'build-report.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildSite(process.argv[2]),null,2));
