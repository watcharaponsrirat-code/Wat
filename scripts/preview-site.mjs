// Local preview/load-test fixture; production continues to use GitHub Pages.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.argv[2]||'_site'),port=Number(process.argv[3]||4173);
const cache=new Map();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'};
async function asset(file){
  if(!cache.has(file))cache.set(file,(async()=>{
    if(!(await stat(file)).isFile())throw Error('Not a file');
    const body=await readFile(file),type=mime[extname(file)]||'application/octet-stream';
    return {body,compressed:/^(text\/|image\/svg|application\/json)/.test(type)?gzipSync(body):null,type,etag:'"'+createHash('sha256').update(body).digest('hex')+'"'};
  })().catch(error=>{cache.delete(file);throw error}));
  return cache.get(file);
}
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(root+sep))throw Error('Outside site');
    const entry=await asset(file);
    const useGzip=entry.compressed&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
    const body=useGzip?entry.compressed:entry.body;
    res.setHeader('Content-Type',entry.type);res.setHeader('Vary','Accept-Encoding');res.setHeader('ETag',entry.etag);
    res.setHeader('Cache-Control',/inline-[a-f0-9]{16}\./.test(file)||file.includes(sep+'branding'+sep)?'public, max-age=31536000, immutable':'no-cache');
    if(req.headers['if-none-match']===entry.etag){res.writeHead(304);res.end();return}
    if(useGzip)res.setHeader('Content-Encoding','gzip');
    res.setHeader('Content-Length',body.length);res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404);res.end('Not found')}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${server.address().port}/ (restart after rebuilding)`));
