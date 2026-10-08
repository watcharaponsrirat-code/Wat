import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const scripts=[];
for(const block of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  const src=block[1].match(/src="([^"]+)"/);
  scripts.push(src?await readFile(new URL('../'+src[1],import.meta.url),'utf8'):block[2]);
}
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
export function harness(storage=new Map()){
  let markup='',elements=[];
  const stub=()=>({textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},focus(){},scrollIntoView(){},addEventListener(){},querySelector(){return stub()},querySelectorAll(){return []}});
  function matches(el,selector){
    if(selector.includes(':not(:disabled)')&&el.disabled)return false;
    const attributes=[...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
    return attributes.length>0&&attributes.every(([,key,value])=>key in el.attrs&&(value===undefined||el.attrs[key]===value));
  }
  function selectAll(selector){return elements.filter(el=>selector.split(',').some(part=>matches(el,part)))}
  const root={...stub(),querySelectorAll:selectAll};
  const app={get innerHTML(){return markup},set innerHTML(value){
    markup=value;elements=[];
    for(const match of value.matchAll(/<(button|input|select)\b([^>]*)>/g)){
      const attrs=Object.fromEntries([...match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([,k,v])=>[k,decode(v||'')]));
      const dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));
      elements.push({...stub(),attrs,dataset,disabled:'disabled' in attrs,value:attrs.value||'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn}});
    }
  }};
  const document={querySelector(selector){if(selector==='#app')return app;if(selector==='.arcade')return markup.includes('data-arcade-type')?root:null;return selectAll(selector)[0]||stub()},querySelectorAll:selectAll,addEventListener(){}};
  const context=vm.createContext({window:{scrollTo(){}},document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>0,clearTimeout(){}});
  scripts.forEach(source=>vm.runInContext(source,context));
  const qa=context.window.__SLH_QA__;
  function click(selector,value,event='click'){
    const el=selectAll(selector)[0];assert(el,'Missing control '+selector);assert(!el.disabled,'Disabled control '+selector);
    if(value!==undefined)el.value=value;
    const handler=el.listeners[event]||el['on'+event];assert(handler,'Missing handler '+selector);handler();
  }
  return {qa,context,storage,click,find:s=>selectAll(s)[0],get markup(){return markup}};
}


export function runExerciseRegression(){
  let h=harness();let sets=0,basic=0,applications=0;
  for(const id of h.qa.lessonIds){
    const bank=h.context.window.SLH_EXERCISES;
    const sections=h.context.window.SLH_DATA.packs[id];
    for(const [type,questions] of [['basic',bank.basic(id)],['apply',bank.apply(id)]]){
      assert(questions.length>=6,id+' '+type);
      assert.equal(new Set(questions.map(q=>q.q)).size,questions.length);
      for(const q of questions){assert.equal(q.type,type);assert.equal(q.opts.length,4);assert.equal(new Set(q.opts).size,4);assert(q.opts.includes(q.correct));assert(q.why);assert(sections.some(s=>s.code===q.code));}
      if(type==='basic')basic+=questions.length;else applications+=questions.length;
    }
    for(const stage of ['e1','e2','e3']){
      h.qa.reset(id);h.qa.open(id,stage);
      const state=()=>h.qa.snapshot(id).ex[stage].state;
      assert.equal(state().qs.length,6);assert(state().qs.every(q=>stage==='e3'?['onet','analyze'].includes(q.type):q.type===(stage==='e1'?'basic':'apply')));
      assert(!h.find('[data-ex-next]').disabled);h.click('[data-ex-check]');assert.equal(state().checked,false);
      state().qs.forEach((q,i)=>{const el=h.context.document.querySelectorAll('[data-ex-q="'+i+'"]').find(b=>b.dataset.exO!==q.correct);el.onclick()});
      h.click('[data-ex-check]');assert.equal(h.qa.snapshot(id).ex[stage].done,false);assert(!h.find('[data-ex-next]').disabled);
      const saved=JSON.stringify(state());h=harness(h.storage);h.qa.open(id,stage);assert.equal(JSON.stringify(state()),saved);
      state().qs.forEach((q,i)=>{const el=h.context.document.querySelectorAll('[data-ex-q="'+i+'"]').find(b=>b.dataset.exO===q.correct);el.onclick()});
      h.click('[data-ex-check]');assert.equal(h.qa.snapshot(id).ex[stage].done,true);assert(!h.find('[data-ex-next]').disabled);
      assert(h.find('[data-ex-check]').disabled);assert(h.find('[data-ex-q]').disabled);
      for(const q of state().qs)assert(h.markup.includes(q.why.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')));
      const complete=JSON.stringify(state());h.find('[data-ex-q]').onclick();assert.equal(JSON.stringify(state()),complete,'passed answers cannot be edited');
      const xp=h.qa.snapshot(id).xp;
      h.click('[data-ex-next]');
      assert.equal(h.qa.snapshot(id).resume,stage==='e1'?'e2':stage==='e2'?'e3':'exam');
      if(stage==='e3')assert(h.find('[data-exam-next]'),'challenge completion opens final exam');
      else assert(h.find('[data-ex-check]'),'completion opens next exercise');
      h.qa.open(id,stage);h.click('[data-ex-reset]');assert(!h.qa.snapshot(id).ex[stage].done);assert.equal(h.qa.snapshot(id).xp,xp);assert(!h.find('[data-ex-next]').disabled);
      sets++;
    }
    h.qa.open(id,'e3');assert.equal(h.qa.snapshot(id).ex.e3.state.qs.length,6);
    h.qa.open(id,'exam');const exam=h.qa.snapshot(id).exam.current;assert.equal(exam.qs.length,20);
    assert.equal(exam.version,3);assert(exam.qs.every(q=>q.id.startsWith(id+'-F')));assert(exam.qs.filter(q=>q.type==='apply').length>=4);
  }
  const id='G1U4L3';
  for(const previousVersion of [undefined,1]){
    h.qa.open(id,'e1');
    const entry=[...h.storage].find(([,v])=>{try{return JSON.parse(v).ex?.e1?.state?.qs?.[0]?.code.startsWith(id)}catch{return false}});
    assert(entry);const old=JSON.parse(entry[1]);
    if(previousVersion===undefined)delete old.ex.e1.state.version;else old.ex.e1.state.version=previousVersion;
    old.ex.e1.state.answers={0:old.ex.e1.state.qs[0].correct};old.ex.e1.done=true;old.xp=140;
    const oldState=JSON.stringify(old.ex.e1.state);h.storage.set(entry[0],JSON.stringify(old));h=harness(h.storage);h.qa.open(id,'e1');
    const migrated=h.qa.snapshot(id);assert.equal(JSON.stringify(migrated.ex.e1.previousState),oldState,'Archived practice preserves questions and selected answers');
    assert.equal(migrated.ex.e1.done,true);assert.equal(migrated.xp,140);assert.equal(migrated.ex.e1.state.version,2);assert(!h.find('[data-ex-next]').disabled);
    const saved=JSON.stringify(migrated.ex.e1);h=harness(h.storage);h.qa.open(id,'e1');assert.equal(JSON.stringify(h.qa.snapshot(id).ex.e1),saved,'Reload preserves migrated practice and archive');
  }
  return {lessons:h.qa.lessonIds.length,sets,basic,applications,checks:['strict level and topic alignment','wrong and incomplete responses do not earn a pass','correct explanations visible','passed answers frozen','reload preserves answers and question order','completion opens next exercise or final exam','replay retains XP','old attempt archived and earned progress retained','all final exams retain 20 questions']};
}
console.log(runExerciseRegression());
