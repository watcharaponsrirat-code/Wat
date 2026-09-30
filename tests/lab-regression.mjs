import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function runLabRegression() {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const storage = new Map(), nodes = new Map();
  let markup = '';
  const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const app = {get innerHTML(){return markup;}, set innerHTML(value){markup=value; nodes.clear();}};
  function node(selector) {
    if(selector==='#app') return app;
    if(!nodes.has(selector)) nodes.set(selector, {value: selector==='#labText' ? decode(markup.match(/<textarea[^>]*id="labText"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] || '') : '', classList:{add(){},remove(){}}, addEventListener(type,fn){this[type]=fn;}});
    return nodes.get(selector);
  }
  const document = {querySelector:node, addEventListener(){}, querySelectorAll(selector){
    const field=selector==='[data-lab-evidence]'?'evidence':selector==='[data-lab-variable]'?'variable':null;
    if(!field) return [];
    const key='buttons-'+field;
    if(!nodes.has(key)) nodes.set(key, [...markup.matchAll(new RegExp('data-lab-'+field+'="([^"]*)"','g'))].map(m=>({dataset:{[field==='evidence'?'labEvidence':'labVariable']:decode(m[1])}})));
    return nodes.get(key);
  }};
  const context=vm.createContext({window:{scrollTo(){}}, document, localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:()=>0,clearTimeout(){}});
  for(const block of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src=block[1].match(/src="([^"]+)"/);
    vm.runInContext(src?await readFile(new URL('../'+src[1],import.meta.url),'utf8'):block[2],context);
  }
  const qa=context.window.__SLH_QA__, data=context.window.SLH_DATA;
  for(const id of qa.lessonIds) {
    qa.open(id,'lab');
    const draft='บันทึกการทดลอง: '+data.activities[id].goal+' <ตัวอย่าง> & ข้อมูล';
    node('#labText').value=draft;
    node('#labText').input();
    assert.equal(qa.snapshot(id).lab.text,draft,id+' saves input');
    document.querySelectorAll('[data-lab-evidence]')[0].onclick();
    assert.equal(node('#labText').value,draft,id+' retains draft after evidence');
    document.querySelectorAll('[data-lab-variable]')[0].onclick();
    assert.equal(node('#labText').value,draft,id+' retains draft after variable');
    qa.open(id,'content');qa.open(id,'lab');
    assert.equal(node('#labText').value,draft,id+' retains draft after leaving lab');
    for(const field of ['evidence','variable']) {
      const options=qa.snapshot(id).lab[field+'Options'];
      assert.equal(options.length,4);assert.equal(new Set(options).size,4);assert(options.includes(data.activities[id][field]));
    }
    node('#labText').value='';node('#labText').input();node('[data-lab-check]').click();
    assert.equal(qa.snapshot(id).lab.done,false,id+' rejects empty conclusion');
  }
  return {lessons:qa.lessonIds.length,checks:['draft persistence through option changes and navigation','four distinct choices including expected answer','empty conclusion does not unlock game']};
}

console.log(await runLabRegression());
