import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function runLabRegression() {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const storage = new Map(), nodes = new Map();
  let markup = '';
  const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const app = {get innerHTML(){return markup;}, set innerHTML(value){markup=value; nodes.clear();}};
  function element() {
    const children = new Map();
    return {textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},scrollIntoView(){},
      addEventListener(type,fn){this[type]=fn;},
      querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);}};
  }
  function node(selector) {
    if(selector==='#app') return app;
    if(!nodes.has(selector)) nodes.set(selector, {...element(),value: selector==='#labText' ? decode(markup.match(/<textarea[^>]*id="labText"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] || '') : ''});
    return nodes.get(selector);
  }
  const document = {querySelector:node, addEventListener(){}, querySelectorAll(selector){
    const field=selector==='[data-lab-evidence]'?'evidence':selector==='[data-lab-variable]'?'variable':null;
    if(!field) return [];
    const key='buttons-'+field;
    if(!nodes.has(key)) nodes.set(key, [...markup.matchAll(new RegExp('data-lab-'+field+'="([^"]*)"','g'))].map(m=>({...element(),dataset:{[field==='evidence'?'labEvidence':'labVariable']:decode(m[1])}})));
    return nodes.get(key);
  }};
  const context=vm.createContext({window:{scrollTo(){}}, document, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>0,clearTimeout(){}});
  for(const block of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src=block[1].match(/src="([^"]+)"/);
    vm.runInContext(src?await readFile(new URL('../'+src[1],import.meta.url),'utf8'):block[2],context);
  }
  const qa=context.window.__SLH_QA__, data=context.window.SLH_DATA, labs=context.window.SLH_LABS;
  assert.equal(Object.keys(labs).length,qa.lessonIds.length);
  assert.equal(new Set(Object.values(labs).map(lab=>JSON.stringify(lab.steps))).size,qa.lessonIds.length);
  assert(!context.window.scienceLabTextReport(labs.G3U2L1,labs.G3U2L1.model.replace('aa','Aa')).ready,'allele case remains meaningful');
  assert(!context.window.scienceLabTextReport(labs.G3U6L1,labs.G3U6L1.model.replace('10','100')).ready,'10 must not match inside 100');
  function write(text){node('#labText').value=text;node('#labText').input();}
  function choose(field,text){const key=field==='evidence'?'labEvidence':'labVariable';document.querySelectorAll('[data-lab-'+field+']').find(button=>button.dataset[key]===text).click();}
  for(const id of qa.lessonIds) {
    const lab=labs[id];
    assert(lab.focus.every(title=>data.packs[id].some(section=>section.title===title)),id+' references actual lesson sections');
    assert(lab.rows.every(row=>row.length===lab.headers.length),id+' has consistent table columns');
    assert(context.window.scienceLabTextReport(lab,lab.model).ready,id+' accepts its model conclusion');
    assert(!context.window.scienceLabTextReport(lab,lab.keywords.map(words=>words[0]).join(' ')).ready,id+' rejects a keyword list');
    // Old in-progress answers survive the content migration; old choices are refreshed.
    storage.set('slh_v162_'+id,JSON.stringify({lab:{text:'ร่างเดิมของนักเรียน',evidence:'ตัวเลือกเก่า',variable:'ตัวเลือกเก่า',evidenceOptions:['ตัวเลือกเก่า'],variableOptions:['ตัวเลือกเก่า']}}));
    qa.open(id,'lab');
    assert.equal(node('#labText').value,'ร่างเดิมของนักเรียน');
    assert.equal(qa.snapshot(id).lab.evidence,'');
    const draft='บันทึกการทดลอง: '+lab.goal+' <ตัวอย่าง> & ข้อมูล';
    node('#labText').value=draft;
    node('#labText').input();
    assert.equal(qa.snapshot(id).lab.text,draft,id+' saves input');
    document.querySelectorAll('[data-lab-evidence]')[0].click();
    assert.equal(node('#labText').value,draft,id+' retains draft after evidence');
    document.querySelectorAll('[data-lab-variable]')[0].click();
    assert.equal(node('#labText').value,draft,id+' retains draft after variable');
    qa.open(id,'content');qa.open(id,'lab');
    assert.equal(node('#labText').value,draft,id+' retains draft after leaving lab');
    for(const field of ['evidence','variable']) {
      const options=qa.snapshot(id).lab[field+'Options'];
      assert.equal(options.length,4);assert.equal(new Set(options).size,4);assert(options.includes(lab[field]));
    }
    choose('evidence',lab.evidence);choose('variable',lab.variable);
    write('');node('[data-lab-check]').click();
    assert.equal(qa.snapshot(id).lab.done,false,id+' rejects empty conclusion');
    write(lab.keywords.map(words=>words[0]).join(' '));node('[data-lab-check]').click();
    assert.equal(qa.snapshot(id).lab.done,false,id+' rejects keywords without explanation');
    write(lab.model);
    assert(node('#labKeywordStatus').textContent.includes(lab.keywords.length+'/'+lab.keywords.length),id+' updates keyword guidance');
    choose('variable',lab.reasonOptions[1]);node('[data-lab-check]').click();
    assert.equal(qa.snapshot(id).lab.done,false,id+' rejects incorrect concept even with full model text');
    choose('variable',lab.variable);choose('evidence',lab.evidenceOptions[1]);node('[data-lab-check]').click();
    assert.equal(qa.snapshot(id).lab.done,false,id+' rejects incorrect evidence');
    choose('evidence',lab.evidence);node('[data-lab-check]').click();
    assert.equal(qa.snapshot(id).lab.done,true,id+' completes valid activity');
    assert.equal(qa.snapshot(id).resume,'g1');
    assert(markup.includes('gameStage'),id+' opens game 1');
    qa.open(id,'lab');
    assert.equal(qa.snapshot(id).lab.done,true,id+' retains completed work');
    assert.equal(node('#labText').value,lab.model,id+' retains completed conclusion');
  }
  const completedId=qa.lessonIds[0];
  storage.set('slh_v162_'+completedId,JSON.stringify({lab:{done:true,text:'ข้อสรุปเดิมที่ผ่านแล้ว'},games:{g1:{done:true}},xp:40}));
  qa.open(completedId,'lab');
  assert.equal(qa.snapshot(completedId).lab.done,true,'migration preserves completed labs');
  assert.equal(qa.snapshot(completedId).games.g1.done,true,'migration preserves game completion');
  assert.equal(qa.snapshot(completedId).xp,40,'migration preserves XP');
  return {lessons:qa.lessonIds.length,checks:['lesson section alignment and distinct procedures','all model conclusions accepted','live keyword guidance','old draft migration and retention','incorrect choices, empty text and keyword lists rejected','valid activity unlocks game and persists']};
}

console.log(await runLabRegression());
