// Local review server. All accounts, scores and sheets exist in memory only.
// The production source and endpoint are never changed.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {staffFixture} from './helpers/staff-fixture.mjs';
const {h,teacherId,teacherPassword}=staffFixture(),root=resolve('.');
const endpoint='https://script.google.com/macros/s/SYNTHETIC_LOCAL_ONLY/exec';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
 res.setHeader('Cache-Control','no-store');
 if(path==='/_preview_api'&&req.method==='POST'){
  let text='';for await(const chunk of req){text+=chunk;if(text.length>1048576)throw Error();}
  const body=JSON.parse(text);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(h.call(body.action,body.payload,body.token)));return;
 }
 if(path==='/assets/integrations/sheets-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.SLH_SHEETS_CONFIG='+JSON.stringify({endpoint})+';');return;}
 if(path!=='/'&&!path.startsWith('/assets/'))throw Error();
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(path!=='/'&&!file.startsWith(root+sep+'assets'+sep))throw Error();
 let body=await readFile(file);
 if(path==='/'){
  const teacher=url.searchParams.get('as')==='teacher',credentials={username:teacher?teacherId:'watcharapon',password:teacher?teacherPassword:h.staffPassword};
  const bootstrap=`<script>(()=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>{if(String(url)===${JSON.stringify(endpoint)})return original('/_preview_api',options);if(['script.google.com','script.googleusercontent.com'].includes(new URL(String(url),location.href).hostname))return Promise.reject(Error('Preview blocks live Google requests'));return original(url,options);};window.addEventListener('DOMContentLoaded',()=>{const credentials=${JSON.stringify(credentials)};document.querySelector('#loginUser').value=credentials.username;document.querySelector('#loginPass').value=credentials.password;const note=document.createElement('aside');note.style.cssText='position:relative;z-index:100;padding:12px;background:#fff3c4;color:#243634;text-align:center;font:15px sans-serif';note.innerHTML='LOCAL PREVIEW • ข้อมูลจำลองในเครื่อง ไม่เชื่อมชีตโรงเรียน • <a href="/">ดูแอดมิน</a> / <a href="/?as=teacher">ดูครูห้อง A</a> • กดเข้าสู่ระบบด้วยค่าตัวอย่างที่กรอกไว้';document.body.prepend(note);});})();</script>`;
  body=Buffer.from(body.toString('utf8').replace('</head>',bootstrap+'</head>'));
 }
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(body);
}catch{res.writeHead(404);res.end('Not found');}});
server.listen(Number(process.env.SLH_PREVIEW_PORT)||4337,'127.0.0.1',()=>console.log('Synthetic staff review: http://127.0.0.1:'+server.address().port+'/ (Admin), /?as=teacher (Teacher). No real school data or Google requests.'));
