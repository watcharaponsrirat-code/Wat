// Reproduce the committed deployment beside a fresh workspace deployment.
// No checkout, git index changes, hosted deployment, or school data.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {buildSite} from './build-site.mjs';
const root=resolve('.'),base=resolve(process.argv[2]||'tmp/performance-v2');
if(!base.startsWith(root+'\\')&&!base.startsWith(root+'/'))throw Error('Output must be inside workspace');
await mkdir(base,{recursive:false});
const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:16*1024*1024});
const commit=git('rev-parse','HEAD').toString().trim(),beforeRoot=join(base,'before-source');
// Read the committed tree, not the index: staged additions/deletions must not
// become part of (or disappear from) the baseline.
const paths=git('ls-tree','-r','--name-only','-z',commit,'--','assets','index.html','scripts/build-site.mjs').toString().split('\0').filter(Boolean);
const changed=new Set(git('diff','--name-only','-z',commit,'--').toString().split('\0').filter(Boolean));
for(const name of paths){
  const destination=join(beforeRoot,name);await mkdir(dirname(destination),{recursive:true});
  if(changed.has(name))await writeFile(destination,git('show',commit+':'+name));
  // Independent copies preserve the snapshot when the workspace is edited.
  else try{await copyFile(join(root,name),destination);}catch{await writeFile(destination,git('show',commit+':'+name));}
}
const {buildSite:buildBefore}=await import(pathToFileURL(join(beforeRoot,'scripts/build-site.mjs')));
const before=join(beforeRoot,'site'),after=join(base,'after');
await buildBefore(before);await buildSite(after);
await writeFile(join(base,'before-Code.gs'),git('show',commit+':integrations/google-sheets/Code.gs'));
await copyFile(join(root,'integrations/google-sheets/Code.gs'),join(base,'after-Code.gs'));
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const manifest={schemaVersion:2,createdAt:new Date().toISOString(),baselineCommit:commit,before,after,beforeBackend:join(base,'before-Code.gs'),afterBackend:join(base,'after-Code.gs'),beforeBackendSHA256:await hash(join(base,'before-Code.gs')),afterBackendSHA256:await hash(join(base,'after-Code.gs')),indexUnchanged:await hash(join(beforeRoot,'index.html'))===await hash(join(root,'index.html'))};
await writeFile(join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
