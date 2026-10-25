import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const journeyActions={
  full:['login','logout','teacherOptions','teacherRoster','studentResults','examHistory','adminTeachers'],
  'login-roster':['login','logout','teacherOptions','teacherRoster']
};

export function parseJourneyOption(args) {
  const selections=args.flatMap((value,index)=>value==='--journey'?[args[index+1]]:value.startsWith('--journey=')?[value.slice('--journey='.length)]:[]);
  assert(selections.length<=1,'Pass --journey only once');
  const journey=selections.length?selections[0]:'full';
  assert(Object.hasOwn(journeyActions,journey),'Journey must be full or login-roster');
  return journey;
}

// Share the boundary with the browser route so the focused run cannot expand
// into score/administration reads or writes if the frontend changes later.
export function performanceActionAllowed(action,journey='full') {
  return Object.hasOwn(journeyActions,journey)&&journeyActions[journey].includes(action);
}

export function validateRunOptions({samples,variants,roles,journey='full'}) {
  assert(Number.isInteger(samples)&&samples>0&&samples<=10,'Samples must be an integer from 1 to 10');
  assert(Object.hasOwn(journeyActions,journey),'Journey must be full or login-roster');
  for(const [name,values,allowed] of [['variants',variants,['before','after']],['roles',roles,['student','teacher']]])
    assert(values.length&&new Set(values).size===values.length&&values.every(value=>allowed.includes(value)),'Invalid or duplicate '+name);
}

export function parsePerformanceCredentials(input) {
  let credentials;
  try{credentials=JSON.parse(input.replace(/^\uFEFF/,''));}
  catch{throw new Error('Credential input must be valid JSON; raw input omitted');}
  assert(credentials?.teacher&&Array.isArray(credentials.students)&&credentials.students.length,'Credential reader must supply a teacher and students');
  for(const item of [credentials.teacher,...credentials.students])
    assert(typeof item?.username==='string'&&item.username.length&&typeof item.password==='string'&&item.password.length,'Credential reader must supply nonempty username/password strings');
  return credentials;
}

export async function readBackendSnapshots(manifest,variants) {
  assert.equal(manifest.schemaVersion,2,'Create a fresh performance manifest with frozen backend snapshots');
  const sources=new Map();
  for(const variant of variants){
    const bytes=await readFile(manifest[variant+'Backend']);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest[variant+'BackendSHA256'],variant+' backend snapshot changed; prepare a fresh comparison');
    sources.set(variant,bytes.toString('utf8'));
  }
  return sources;
}

export async function withTimeout(promise,ms,label='measurement') {
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timeout')),ms)})]);}
  finally{clearTimeout(timer);}
}

export function failureDiagnostic(error,credentials=[],live=false) {
  // A server or browser error can include arbitrary response content. Live
  // reports retain only our step/type, never raw page text or response errors.
  if(live)return 'Live operation failed; raw page and server messages omitted';
  let message=String(error?.message||'Operation failed').split('\n')[0];
  for(const item of credentials)for(const [field,label] of [['username','account'],['password','secret']])
    if(item?.[field])message=message.replaceAll(item[field],'['+label+']');
  return message.replace(/[a-f0-9]{64}/gi,'[token]').slice(0,200);
}
