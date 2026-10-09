/** TASK 01 guard: the login presentation may change; the learning app may not. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const run=promisify(execFile);
const baseline='50ae884';
const git=async args=>(await run('git',args,{cwd:root,windowsHide:true,maxBuffer:16*1024*1024})).stdout;
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const original=await git(['show',baseline+':index.html']);
function outsideLogin(source){
  const start=source.indexOf('function renderLogin()');
  const end=source.indexOf('function renderDashboard()',start);
  assert(start>=0&&end>start,'Both existing render boundaries must remain');
  return (source.slice(0,start)+'/* LOGIN PRESENTATION */\n'+source.slice(end))
    .replace(/\r\n/g,'\n')
    .split('\n').filter(line=>!/^\s*<(?:link|script)\b[^>]*(?:href|src)="assets\/login\//.test(line)).join('\n');
}
assert.equal(outsideLogin(html),outsideLogin(original),'Authentication, data, session, routing and every other page must stay byte-identical');
const changes=(await git(['diff','--name-status','--no-renames',baseline,'--'])).trim().split(/\r?\n/).filter(Boolean);
for(const change of changes){
  const [status,path]=change.split('\t');
  assert(status==='A'||path==='index.html','Existing file outside Login changed: '+path);
}
const login=html.slice(html.indexOf('function renderLogin()'),html.indexOf('function renderDashboard()'));
for(const hook of ['id="loginForm"','id="loginUser"','id="loginPass"','id="loginMsg"','data-action="login"','data-login-password','data-login-support'])assert(login.includes(hook),'Preserve/add hook '+hook);
assert(login.includes('assets/branding/33852269be64c916.png'),'The genuine existing school crest is required');
assert(login.includes('โหมดสาธิต'),'Existing demo disclosure remains visible');
assert(!/type="checkbox"|data-action="register"|autocomplete="new-password"/.test(login),'Do not invent remember/signup functionality');
const ui=await readFile(new URL('../assets/login/login-ui.js',import.meta.url),'utf8');
assert(!/\b(?:localStorage|sessionStorage|fetch|XMLHttpRequest)\b|document\.cookie|SESSION\s*[.=]|USERS\s*[.=]/.test(ui),'Login decoration must never access persistence or authentication');
console.log({baseline,checks:['all non-login index code is identical','existing shared files untouched','real school crest and original login hooks','no new signup or remember feature','no storage, network or authentication in login decoration']});
