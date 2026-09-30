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
function harness(storage=new Map()){
  let markup='',elements=[];
  const stub=()=>({textContent:'',classList:{add(){},remove(){},toggle(){}},setAttribute(){},focus(){},scrollIntoView(){},addEventListener(){},querySelector(){return stub()},querySelectorAll(){return []}});
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

export function runGameRegression(){
  let h=harness();
  const catalog=h.context.window.SLH_GAME_CATALOG,packs=h.context.window.SLH_DATA.packs;
  assert.equal(Object.keys(catalog).length,40);
  const types=new Set();let played=0;
  for(const [id,games] of Object.entries(catalog)){
    assert.equal(games.length,3);
    assert.equal(new Set(games.map(g=>g.type)).size,3,id+' has distinct mechanics');
    for(const [index,game] of games.entries()){
      const stage='g'+(index+1),state=()=>h.qa.snapshot(id).games[stage].state;
      const progress=()=>h.qa.snapshot(id);
      types.add(game.type);assert(packs[id].some(s=>s.code===game.code),id+' uses an actual topic');
      if(game.type==='mission')for(const item of game.items){assert(packs[id].some(s=>s.code===item.code));assert.equal(new Set(item.options).size,item.options.length);assert(item.options.includes(item.answer));assert(item.explanation&&item.hint)}
      h.qa.reset(id);h.qa.open(id,stage);
      assert(h.markup.includes('data-arcade-type="'+game.type+'"'));
      assert(h.find('[data-arc-next]').disabled);
      h.click('[data-arc-hint]');assert(state().hint);
      // A full reload must keep the same random board, hint, and choices.
      const beforeReload=JSON.stringify(state());h=harness(h.storage);h.qa.open(id,stage);assert.equal(JSON.stringify(state()),beforeReload);
      const check=()=>h.click('[data-arc-check]');
      if(game.type==='memory'){
        let s=state();const a=0,b=s.deck.findIndex(c=>c.pair!==s.deck[a].pair);
        h.click('[data-arc-flip="'+a+'"]');h.click('[data-arc-flip="'+b+'"]');assert.equal(state().open.length,2);assert.equal(state().feedback.ok,false);assert(h.find('[data-arc-next]').disabled);
        const pending=JSON.stringify(state());h=harness(h.storage);h.qa.open(id,stage);assert.equal(JSON.stringify(state()),pending);
        h.click('[data-arc-fold]');
        for(let pair=0;pair<game.pairs.length;pair++){
          s=state();const indexes=s.deck.map((c,i)=>c.pair===pair?i:-1).filter(i=>i>=0);
          indexes.forEach(i=>h.click('[data-arc-flip="'+i+'"]'));
        }
      }else if(game.type==='route'){
        check();assert.equal(progress().games[stage].attempts,0,'incomplete route is not an attempt');
        for(let i=game.steps.length-1;i>=0;i--)h.click('[data-arc-route="'+i+'"]');check();assert.equal(state().feedback.ok,false);
        for(let i=0;i<game.steps.length;i++)h.click('[data-arc-undo]');
        game.steps.forEach((_,i)=>h.click('[data-arc-route="'+i+'"]'));check();
      }else if(game.type==='sort'){
        check();assert.equal(progress().games[stage].attempts,0);
        game.items.forEach((it,i)=>h.click(`[data-arc-sort="${i}"][data-arc-category="${game.categories.findIndex(c=>c!==it.answer)}"]`));check();assert.equal(state().feedback.ok,false);
        game.items.forEach((it,i)=>h.click(`[data-arc-sort="${i}"][data-arc-category="${game.categories.indexOf(it.answer)}"]`));check();
      }else if(game.type==='evidence'){
        const wrong=game.cards.findIndex(c=>!c.correct);h.click('[data-arc-evidence="'+wrong+'"]');check();assert.equal(state().feedback.ok,false);h.click('[data-arc-evidence="'+wrong+'"]');
        game.cards.forEach((it,i)=>{if(it.correct)h.click('[data-arc-evidence="'+i+'"]')});check();
      }else if(game.type==='tune'){
        check();assert.equal(state().feedback.ok,false);
        const solutions={density:60,percent:15,speed:80,lever:4,work:50,potential:5,wavelength:4,reflection:35,mass:18,energy:3};
        h.click('[data-arc-range="0"]',String(solutions[game.mode]),'change');check();
      }else if(game.type==='genetics'){
        check();assert.equal(progress().games[stage].attempts,0);
        for(let i=0;i<4;i++)h.click('[data-arc-cell="'+i+'"]','AA','change');check();assert.equal(state().feedback.ok,false);
        ['AA','Aa','Aa','aa'].forEach((v,i)=>h.click('[data-arc-cell="'+i+'"]',v,'change'));check();
      }else if(game.type==='circuit'){
        check();assert.equal(state().feedback.ok,false);
        h.click('[data-arc-switch="0"]');h.click('[data-arc-switch="1"]');h.click('[data-arc-switch="2"]');check();assert.equal(state().feedback.ok,false,'both lamps lit does not satisfy goal');h.click('[data-arc-switch="2"]');
        assert(h.markup.includes('หลอด A ติด'));assert(h.markup.includes('หลอด B ดับ'));check();
      }else if(game.type==='web'){
        h.click('[data-arc-node="1"]');h.click('[data-arc-node="0"]');check();assert.equal(state().feedback.ok,false,'reversed food arrow rejected');
        h.click('[data-arc-edge="1-0"]');
        for(const [a,b] of game.edges){h.click('[data-arc-node="'+a+'"]');h.click('[data-arc-node="'+b+'"]')}
        // A duplicate connection should not count as another edge.
        h.click('[data-arc-node="0"]');h.click('[data-arc-node="1"]');assert.equal(state().edges.length,game.edges.length);check();
      }else if(game.type==='mission'){
        for(let i=0;i<game.items.length;i++){
          const item=game.items[i],options=state().options[i];
          h.click('[data-arc-answer="'+options.findIndex(o=>o!==item.answer)+'"]');assert.equal(state().feedback.ok,false);assert(h.find('[data-arc-next]').disabled);
          h.click('[data-arc-answer="'+options.indexOf(item.answer)+'"]');assert.equal(state().feedback.ok,true);assert(h.markup.includes(item.explanation));
          if(i<game.items.length-1){assert(h.find('[data-arc-next]').disabled);h.click('[data-arc-mission-next]')}
        }
      }
      assert.equal(state().complete,true,id+'/'+stage+' puzzle completes');assert.equal(progress().games[stage].done,true);assert(!h.find('[data-arc-next]').disabled);
      assert(progress().trace.some(t=>t.stage===stage&&t.ok===false),'incorrect attempt recorded');assert(progress().trace.some(t=>t.stage===stage&&t.ok===true),'correct attempt recorded');
      const saved=JSON.stringify(state()),xp=progress().xp;h=harness(h.storage);h.qa.open(id,stage);assert.equal(JSON.stringify(state()),saved,'completion and explanations survive reload');
      h.click('[data-arc-next]');assert.equal(progress().resume,index===2?'e1':'g'+(index+2));
      h.qa.open(id,stage);h.click('[data-arc-reset]');assert.equal(progress().games[stage].done,false);assert.equal(progress().xp,xp,'replaying does not remove earned XP');assert(h.find('[data-arc-next]').disabled);
      played++;
    }
  }
  // Legacy states must migrate without deleting previously earned progress.
  const id='G1U1L1';h.qa.reset(id);h.qa.open(id,'g1');
  const key=[...h.storage.keys()].find(k=>k.endsWith(id));const p=JSON.parse(h.storage.get(key));
  p.games.g1={done:true,attempts:9,state:{pairs:[],matched:[]}};p.xp=300;p.exam.passed=true;p.lab.text='ข้อความที่บันทึกไว้';h.storage.set(key,JSON.stringify(p));
  h=harness(h.storage);h.qa.open(id,'g1');const migrated=h.qa.snapshot(id);
  assert.equal(migrated.games.g1.state.version,4);assert.equal(migrated.games.g1.done,true);assert.equal(migrated.games.g1.attempts,9);assert.equal(migrated.xp,300);assert.equal(migrated.exam.passed,true);assert.equal(migrated.lab.text,'ข้อความที่บันทึกไว้');assert(!h.find('[data-arc-next]').disabled);
  return {lessons:40,games:played,mechanics:[...types],checks:['incorrect answers and incomplete boards stay locked','all game types solved through UI event handlers','resume after page reload','feedback, hints and shuffling persisted','completion unlocks next stage','replay retains earned XP','legacy progress migration']};
}
console.log(runGameRegression());
