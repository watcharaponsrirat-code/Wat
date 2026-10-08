// Run only against a deployment you own and have permission to load-test.
// k6 run -e BASE_URL=https://your-host/your-project/ tests/load-1000.js
import http from 'k6/http';
import {check,sleep} from 'k6';

const base=__ENV.BASE_URL;
if(!base||!/^https?:\/\//.test(base)||!base.endsWith('/'))throw new Error('BASE_URL must be an HTTP(S) URL ending in /');
const localSmoke=__ENV.PROFILE==='local-smoke';
if(localSmoke&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(base))throw new Error('local-smoke is restricted to localhost');
export const options={
  scenarios:{learners:{executor:'ramping-vus',startVUs:0,stages:localSmoke?[
    {duration:'20s',target:1000},{duration:'30s',target:1000},{duration:'10s',target:0},
  ]:[
    {duration:'1m',target:100},{duration:'2m',target:500},
    {duration:'2m',target:1000},{duration:'5m',target:1000},{duration:'1m',target:0},
  ],gracefulRampDown:'30s'}},
  thresholds:{http_req_failed:['rate<0.01'],http_req_duration:['p(95)<2000','p(99)<5000'],checks:['rate>0.99']},
  batch:6,batchPerHost:6,discardResponseBodies:true,
};
function okay(response){check(response,{'HTTP 200':r=>r.status===200})}
export function setup(){
  const page=http.get(base+'index.html',{responseType:'text'});
  if(page.status!==200)throw new Error('Could not load index.html');
  const assets=[...page.body.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
    .map(m=>m[1]).filter(path=>!/^([a-z]+:|\/\/|#)/i.test(path));
  return {assets:[...new Set(assets)]};
}
export default function({assets}){
  okay(http.get(base+'index.html',{tags:{step:'navigation'}}));
  // Each VU downloads app resources once; later iterations represent a warm cache.
  if(__ITER===0)http.batch(assets.map(path=>['GET',base+path,null,{tags:{step:'startup'}}])).forEach(okay);
  // Typical reading session: six lazily loaded figures, followed by reading time.
  http.batch(Array.from({length:6},(_,i)=>['GET',base+`assets/lessons/G1U1L1-${String(i+1).padStart(2,'0')}.jpg`,null,{tags:{step:'reading'}}])).forEach(okay);
  sleep(localSmoke?3+Math.random()*2:20+Math.random()*20);
}
