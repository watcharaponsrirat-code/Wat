/** Preserve the completed login design while allowing the Sheets auth adapter. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const run=promisify(execFile);
const baseline='186dfb1';
const git=async args=>(await run('git',args,{cwd:root,windowsHide:true,maxBuffer:16*1024*1024})).stdout;
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const original=await git(['show',baseline+':index.html']);
const login=html.slice(html.indexOf('function renderLogin()'),html.indexOf('function renderDashboard()'));
const previousLogin=original.slice(original.indexOf('function renderLogin()'),original.indexOf('function renderDashboard()'));
// Normalize only the explicit live-account defaults and operational notice;
// all remaining content, markup, IDs and styling must match the original.
const demoLogin=login
  .replace('const connected=window.SLH_SHEETS.enabled();','')
  .replace('id="loginUser" name="username" value=""','id="loginUser" name="username" value="M20105"')
  .replace('id="loginPass" name="password" type="password" value=""','id="loginPass" name="password" type="password" value="1234"')
  .replace("${connected?'<strong>บัญชีโรงเรียน:</strong> ใช้บัญชีโรงเรียน คะแนนส่งถึงครูเมื่อเชื่อมต่ออินเทอร์เน็ต ความคืบหน้าการเรียนต่อยังเก็บในเบราว์เซอร์นี้':'<strong>โหมดสาธิต:</strong> ใช้บัญชีตัวอย่าง ความคืบหน้าเก็บเฉพาะเบราว์เซอร์นี้ ไม่ซิงก์ข้ามเครื่อง และจะหายเมื่อล้างข้อมูลเว็บไซต์'}",'<strong>โหมดสาธิต:</strong> ใช้บัญชีตัวอย่าง ความคืบหน้าเก็บเฉพาะเบราว์เซอร์นี้ ไม่ซิงก์ข้ามเครื่อง และจะหายเมื่อล้างข้อมูลเว็บไซต์');
assert.equal(demoLogin.replace(/\r\n/g,'\n'),previousLogin.replace(/\r\n/g,'\n'),'Existing login content, design and IDs are unchanged apart from explicit live-account defaults and notice');
for(const file of ['assets/login/login-ui.js','assets/login/login.css']){
  const content=await readFile(new URL('../'+file,import.meta.url),'utf8');
  const preserved=content.replace('// Async authentication owns the disabled/busy state until it completes.','// The existing authentication is synchronous; never delay or replace it.').replace('button.isConnected && !button.disabled','button.isConnected');
  assert.equal(preserved.replace(/\r\n/g,'\n'),(await git(['show',baseline+':'+file])).replace(/\r\n/g,'\n'),'Login presentation remains unchanged apart from keeping busy visible during async authentication: '+file);
}
for(const hook of ['id="loginForm"','id="loginUser"','id="loginPass"','id="loginMsg"','data-action="login"','data-login-password','data-login-support'])assert(login.includes(hook),'Preserve/add hook '+hook);
assert(login.includes('assets/branding/33852269be64c916.png'),'The genuine existing school crest is required');
assert(login.includes('โหมดสาธิต'),'Existing demo disclosure remains visible');
assert(!/type="checkbox"|data-action="register"|autocomplete="new-password"/.test(login),'Do not invent remember/signup functionality');
const ui=await readFile(new URL('../assets/login/login-ui.js',import.meta.url),'utf8');
assert(!/\b(?:localStorage|sessionStorage|fetch|XMLHttpRequest)\b|document\.cookie|SESSION\s*[.=]|USERS\s*[.=]/.test(ui),'Login decoration must never access persistence or authentication');
console.log({baseline,checks:['login markup and styling unchanged','real school crest and original login hooks','no new signup or remember feature','no storage, network or authentication in login decoration']});
