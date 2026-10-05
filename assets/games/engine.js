(() => {
  'use strict';
  const VERSION=4;
  const names={memory:'เปิดการ์ดความจำ',route:'เรียงเส้นทาง',sort:'จัดหมวดหมู่',evidence:'สืบหาหลักฐาน',tune:'ปรับค่าให้ถึงเป้าหมาย',genetics:'ต่อพันธุกรรม',circuit:'ควบคุมวงจร',web:'ต่อสายใยอาหาร',mission:'ตัดสินใจจากสถานการณ์'};
  const icons={memory:'🃏',route:'🧭',sort:'📦',evidence:'🔎',tune:'🎛️',genetics:'🧬',circuit:'💡',web:'🌿',mission:'🚀'};
  const next={g1:'g2',g2:'g3',g3:'e1'};
  const shuffle=items=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result};
  const gameFor=(id,stage)=>window.SLH_GAME_CATALOG[id][Number(stage.slice(1))-1];
  const fresh=game=>{
    const s={version:VERSION,type:game.type,complete:false,feedback:null,hint:false};
    if(game.type==='memory')Object.assign(s,{deck:shuffle(game.pairs.flatMap((p,i)=>[{pair:i,text:p.left,side:'แนวคิด'},{pair:i,text:p.right,side:'ตัวอย่าง'}])),open:[],matched:[]});
    if(game.type==='route')Object.assign(s,{pool:shuffle(game.steps.map((_,i)=>i)),picked:[]});
    if(game.type==='sort')Object.assign(s,{pool:shuffle(game.items.map((_,i)=>i)),answers:{}});
    if(game.type==='evidence')Object.assign(s,{pool:shuffle(game.cards.map((_,i)=>i)),selected:[]});
    if(game.type==='tune')s.values=game.controls.map(c=>c.value);
    if(game.type==='genetics')s.cells=['','','',''];
    if(game.type==='circuit')s.switches=[false,false,false];
    if(game.type==='web')Object.assign(s,{from:null,edges:[]});
    if(game.type==='mission')Object.assign(s,{idx:0,solved:[],selected:null,options:game.items.map(it=>shuffle(it.options))});
    return s;
  };
  const ensure=(game,p,stage)=>{
    const state=p.games[stage].state;
    if(!state||state.version!==VERSION||state.type!==game.type)p.games[stage].state=fresh(game);
    return p.games[stage].state;
  };
  const valueOf=(game,s)=>{
    const x=s.values[0],k=game.constant;
    if(['density','speed'].includes(game.mode))return x/k;
    if(game.mode==='percent')return 100*x/k;
    if(game.mode==='mass')return x+k;
    if(game.mode==='reflection')return x;
    if(game.mode==='wavelength')return k/x;
    return x*k;
  };
  const number=x=>Number(x.toFixed(2)).toLocaleString('th-TH');
  const edgeKey=([a,b])=>a+'-'+b;
  const solved=(game,s)=>{
    if(game.type==='route')return s.picked.length===game.steps.length&&s.picked.every((v,i)=>v===i);
    if(game.type==='sort')return game.items.every((it,i)=>s.answers[i]===it.answer);
    if(game.type==='evidence')return game.cards.every((it,i)=>s.selected.includes(i)===it.correct);
    if(game.type==='tune')return Math.abs(valueOf(game,s)-game.target)<0.000001;
    if(game.type==='genetics')return s.cells.join('|')==='AA|Aa|Aa|aa';
    if(game.type==='circuit')return s.switches[0]&&s.switches[1]&&!s.switches[2];
    if(game.type==='web')return s.edges.length===game.edges.length&&game.edges.every(edge=>s.edges.includes(edgeKey(edge)));
    return false;
  };
  const hintFor=game=>({route:'เริ่มจากจุดเริ่มต้นที่โจทย์กำหนด แล้วถามว่าอะไรเกิดขึ้นก่อน–หลัง กดย้อนหนึ่งขั้นเพื่อแก้ลำดับได้',sort:'อ่านคุณสมบัติหรือหน้าที่ของแต่ละการ์ด แล้วเทียบกับชื่อหมวด อย่าตัดสินจากคำที่คล้ายกันเพียงอย่างเดียว',evidence:'เลือกเฉพาะข้อมูลหรือการกระทำที่ตอบเป้าหมายของโจทย์ ตรวจทั้งใบที่เลือกและใบที่ยังไม่ได้เลือก',tune:'ใช้ความสัมพันธ์ '+(game.formula||'ที่กำหนด')+' แล้วตรวจหน่วยและค่าที่คงที่',genetics:'อ่านแอลลีลหัวแถวและหัวคอลัมน์ ช่องหนึ่งรับจากแต่ละฝ่ายอย่างละหนึ่ง ตัว A กับ a ต้องแยกกัน',circuit:'กระแสต้องไหลครบวง ทั้งสวิตช์หลักและสวิตช์ของแขนงนั้นต้องปิด (ต่อถึงกัน)',web:'เริ่มลูกศรที่สิ่งมีชีวิตซึ่งถูกกิน แล้วไปยังผู้กิน แตะเส้นที่สร้างแล้วเพื่อลบได้',memory:'ชื่อแนวคิดต้องจับคู่กับตัวอย่างของแนวคิดนั้น จำตำแหน่งที่เปิดไปแล้วและลองอธิบายความเชื่อมโยง'}[game.type]||'ทบทวนข้อมูลในสถานการณ์ แล้วตัดตัวเลือกที่กล่าวเกินหลักฐาน');
  function progress(game,s){
    if(s.complete)return 'สำเร็จ 100%';
    if(game.type==='memory')return 'จับคู่แล้ว '+s.matched.length+'/'+game.pairs.length+' คู่';
    if(game.type==='mission')return 'ภารกิจสำเร็จ '+s.solved.length+'/'+game.items.length;
    if(game.type==='route')return 'วางแล้ว '+s.picked.length+'/'+game.steps.length+' ขั้น';
    if(game.type==='web')return 'เชื่อมแล้ว '+s.edges.length+'/'+game.edges.length+' เส้น';
    return 'ทดลองได้ไม่จำกัด • ผ่านเมื่อถูกครบ';
  }
  function illustration(game,s,e){
    if(game.mode==='reflection'){
      const rad=s.values[0]*Math.PI/180, x=180+110*Math.sin(rad),y=150-110*Math.cos(rad);
      return `<svg class="arcade-diagram" viewBox="0 0 360 185" role="img" aria-label="กระจก เส้นปกติ มุมตกกระทบ 35 องศา และมุมสะท้อน ${s.values[0]} องศา"><path d="M30 150H330" stroke="#183052" stroke-width="7"/><path d="M180 15V150" stroke="#61718a" stroke-dasharray="6 5"/><path d="M117 60L180 150" stroke="#f08a24" stroke-width="4"/><path d="M180 150L${x} ${y}" stroke="#2089bb" stroke-width="4"/><text x="28" y="42">ตกกระทบ 35°</text><text x="200" y="30">สะท้อน ${s.values[0]}°</text><text x="145" y="176">กระจก</text></svg>`;
    }
    if(game.mode==='lever'){
      const tilt=Math.max(-15,Math.min(15,(game.target-valueOf(game,s))/2));
      return `<svg class="arcade-diagram" viewBox="0 0 360 180" role="img" aria-label="คานจำลอง โมเมนต์ซ้าย 40 นิวตันเมตร ขวา ${valueOf(game,s)} นิวตันเมตร"><path d="M180 98L153 157H207Z" fill="#92a9bc"/><g transform="rotate(${-tilt} 180 98)"><path d="M40 98H320" stroke="#89512a" stroke-width="9"/><rect x="56" y="57" width="50" height="40" rx="8" fill="#7965d9"/><rect x="${180+s.values[0]*20-15}" y="67" width="30" height="30" rx="6" fill="#23a8db"/></g><text x="25" y="25">ซ้าย: 20 N × 2 m</text><text x="195" y="25">ขวา: 10 N × ${s.values[0]} m</text></svg><small>ภาพช่วยเปรียบเทียบโมเมนต์ ไม่ได้แสดงระยะตามมาตราส่วน</small>`;
    }
    const ratio=Math.max(0,Math.min(100,valueOf(game,s)/Math.max(game.target*1.5,1)*100));
    return `<div class="arcade-meter" aria-hidden="true"><span style="width:${ratio}%"></span><i style="left:66.666%"></i></div><small>ขีดบนแถบคือเป้าหมาย ${e(game.target+' '+game.unit)}</small>`;
  }
  function board(game,s,e){
    const disabled=s.complete?'disabled':'';
    if(game.type==='memory')return `<div class="arcade-memory">${s.deck.map((card,i)=>{
      const matched=s.matched.includes(card.pair),open=matched||s.open.includes(i);
      return `<button class="arcade-card ${open?'is-open':''} ${matched?'is-matched':''}" data-arc-flip="${i}" aria-label="${open?e(card.side+': '+card.text):'เปิดการ์ดใบที่ '+(i+1)}" ${matched||s.open.includes(i)||s.open.length===2||s.complete?'disabled':''}>${open?`<small>${matched?'✓ จับคู่แล้ว':card.side}</small><span>${e(card.text)}</span>`:`<span class="card-symbol" aria-hidden="true">✦</span><small>ใบที่ ${i+1}</small>`}</button>`;
    }).join('')}</div>${s.open.length===2?'<button class="pixelBtn blue" data-arc-fold>คว่ำการ์ดแล้วลองใหม่</button>':''}`;
    if(game.type==='route')return `<div class="arcade-route" aria-label="เส้นทางที่จัดไว้">${s.picked.length?s.picked.map((id,i)=>`<div class="arcade-step"><b>${i+1}</b><span>${e(game.steps[id])}</span></div>`).join(''):'<p class="arcade-empty">🧭 เส้นทางยังว่าง เลือกจุดเริ่มต้นจากการ์ดด้านล่าง</p>'}</div><div class="arcade-pool">${s.pool.map(id=>`<button class="tile" data-arc-route="${id}" ${s.picked.includes(id)||s.complete?'disabled':''}>${e(game.steps[id])}</button>`).join('')}</div><button class="pixelBtn soft small" data-arc-undo ${!s.picked.length||s.complete?'disabled':''}>↶ ย้อนหนึ่งขั้น</button>`;
    if(game.type==='sort')return `<div class="arcade-sort">${s.pool.map(i=>`<article class="arcade-sort-card"><h3>${e(game.items[i].text)}</h3><div class="arcade-categories" role="group" aria-label="หมวดของ ${e(game.items[i].text)}">${game.categories.map((cat,j)=>`<button class="arcade-chip ${s.answers[i]===cat?'is-selected':''}" data-arc-sort="${i}" data-arc-category="${j}" aria-pressed="${s.answers[i]===cat}" ${disabled}>${s.answers[i]===cat?'✓ ':''}${e(cat)}</button>`).join('')}</div></article>`).join('')}</div>`;
    if(game.type==='evidence')return `<div class="arcade-evidence">${s.pool.map(i=>`<button class="arcade-evidence-card ${s.selected.includes(i)?'is-selected':''}" data-arc-evidence="${i}" aria-pressed="${s.selected.includes(i)}" ${disabled}><span class="arcade-check" aria-hidden="true">${s.selected.includes(i)?'✓':'+'}</span><span>${e(game.cards[i].text)}</span></button>`).join('')}</div><p>เลือกได้หลายใบ • แตะใบที่เลือกแล้วเพื่อยกเลิก</p>`;
    if(game.type==='tune')return `<div class="arcade-simulator"><div class="arcade-target"><span>🎯 เป้าหมาย <strong>${e(game.target+' '+game.unit)}</strong></span><span>ค่าปัจจุบัน <strong>${e(number(valueOf(game,s))+' '+game.unit)}</strong></span></div>${illustration(game,s,e)}<p class="arcade-formula">${e(game.formula)}</p>${game.controls.map((c,i)=>`<div class="arcade-control"><label id="arc-control-${i}">${e(c.label)} <b>${e(s.values[i]+' '+c.unit)}</b></label><div><button class="arcade-adjust" data-arc-adjust="${i}" data-arc-delta="-1" aria-label="ลด${e(c.label)}" ${s.values[i]<=c.min||s.complete?'disabled':''}>−</button><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${s.values[i]}" data-arc-range="${i}" aria-labelledby="arc-control-${i}" ${disabled}><button class="arcade-adjust" data-arc-adjust="${i}" data-arc-delta="1" aria-label="เพิ่ม${e(c.label)}" ${s.values[i]>=c.max||s.complete?'disabled':''}>+</button></div></div>`).join('')}</div>`;
    if(game.type==='genetics')return `<div class="arcade-genetics"><table><caption>แอลลีลของพ่อแม่ Aa × Aa</caption><thead><tr><th scope="col">แถว × คอลัมน์</th><th scope="col">A</th><th scope="col">a</th></tr></thead><tbody>${['A','a'].map((row,r)=>`<tr><th scope="row">${row}</th>${['A','a'].map((col,c)=>{const i=r*2+c;return `<td><label class="arcade-sr" for="arc-cell-${i}">แถว ${row} คอลัมน์ ${col}</label><select id="arc-cell-${i}" data-arc-cell="${i}" ${disabled}><option value="">เลือก</option>${['AA','Aa','aa'].map(v=>`<option ${s.cells[i]===v?'selected':''}>${v}</option>`).join('')}</select></td>`}).join('')}</tr>`).join('')}</tbody></table><p>แต่ละช่องมีโอกาส 1 ใน 4 • ใช้ตัว A และ a ตามโจทย์</p></div>`;
    if(game.type==='circuit')return `<div class="arcade-circuit"><div class="circuit-source">🔋 แบตเตอรี่จำลอง</div><div class="circuit-main">${switchButton(0,'M • สวิตช์หลัก',s,e)}</div><div class="circuit-branches">${['A','B'].map((label,i)=>{const lit=s.switches[0]&&s.switches[i+1];return `<div class="circuit-branch ${lit?'is-lit':''}">${switchButton(i+1,label+' • สวิตช์แขนง',s,e)}<div class="circuit-bulb ${lit?'is-lit':''}" role="img" aria-label="หลอด ${label} ${lit?'ติด':'ดับ'}">💡</div><b>หลอด ${label}: ${lit?'ติด':'ดับ'}</b></div>`}).join('')}</div><div class="circuit-return">สายกลับสู่แบตเตอรี่</div><p>ปิดสวิตช์ = ต่อถึงกัน • เปิดสวิตช์ = วงจรขาด</p></div>`;
    if(game.type==='web')return `<div class="arcade-web"><p class="arcade-web-instruction">${s.from===null?'① เลือกอาหาร (ต้นทางลูกศร)':'② เลือกผู้กิน '+e(game.nodes[s.from])+' หรือแตะต้นทางเดิมเพื่อยกเลิก'}</p><div class="arcade-web-nodes">${game.nodes.map((n,i)=>`<button class="tile ${s.from===i?'sel':''}" data-arc-node="${i}" aria-pressed="${s.from===i}" ${disabled}>${e(n)}</button>`).join('')}</div><div class="arcade-web-edges" aria-label="ลูกศรที่สร้าง">${s.edges.length?s.edges.map(key=>{const [a,b]=key.split('-').map(Number);return `<button class="arcade-edge" data-arc-edge="${key}" aria-label="ลบเส้น ${e(game.nodes[a])} ไป ${e(game.nodes[b])}" ${disabled}>${e(game.nodes[a])} <b>→</b> ${e(game.nodes[b])}<span aria-hidden="true"> ×</span></button>`}).join(''):'<p class="arcade-empty">ยังไม่มีลูกศร เชื่อมอาหารกับผู้กินทีละเส้น</p>'}</div><small>แตะลูกศรเพื่อลบและเชื่อมใหม่</small></div>`;
    const item=game.items[s.idx],locked=s.solved.includes(s.idx);
    return `<div class="arcade-mission"><span class="arcade-pill">ภารกิจ ${s.idx+1} / ${game.items.length}</span><h3>${e(item.question)}</h3><div class="arcade-choices">${s.options[s.idx].map((text,i)=>`<button class="choice ${s.selected===text?'sel':''}" data-arc-answer="${i}" ${locked||s.complete?'disabled':''}><b>${['ก','ข','ค','ง'][i]}.</b> ${e(text)}</button>`).join('')}</div>${locked&&s.idx<game.items.length-1?'<button class="pixelBtn blue" data-arc-mission-next>ภารกิจถัดไป →</button>':''}</div>`;
  }
  function switchButton(i,label,s,e){return `<button class="arcade-switch ${s.switches[i]?'is-selected':''}" data-arc-switch="${i}" aria-pressed="${s.switches[i]}" ${s.complete?'disabled':''}>${e(label)}<strong>${s.switches[i]?'ปิดสวิตช์ (ต่อถึงกัน)':'เปิดสวิตช์ (ขาด)'}</strong></button>`}
  function render(api,p){
    const game=gameFor(api.lessonId,api.stage),s=ensure(game,p,api.stage),e=api.escapeHTML;
    api.saveProgress(p);
    const noCheck=['memory','mission'].includes(game.type);
    return `<section class="gameStage arcade" data-arcade-type="${game.type}" aria-labelledby="arcade-title"><div class="arcade-trail">${window.SLH_GAME_CATALOG[api.lessonId].map((g,i)=>`<span class="${api.stage==='g'+(i+1)?'is-current':''}">${p.games['g'+(i+1)].done?'✓':i+1} ${e(names[g.type])}</span>`).join('')}</div><header class="arcade-header"><div class="arcade-icon" aria-hidden="true">${icons[game.type]}</div><div><small>SCIENCE ARCADE • เกม ${api.stage.slice(1)} / 3</small><h2 id="arcade-title">${e(game.title)}</h2><p>${e(game.prompt)}</p></div></header><div class="arcade-status"><b>${e(progress(game,s))}</b><span>ลองแล้ว ${p.games[api.stage].attempts} ครั้ง</span></div><div class="arcade-board">${board(game,s,e)}</div>${s.feedback?`<div class="arcade-feedback ${s.feedback.ok?'is-success':'is-retry'}" role="status" aria-live="polite"><strong>${s.feedback.ok?'✓ ทำได้แล้ว!':'ลองปรับอีกนิด'}</strong><p>${e(s.feedback.text)}</p></div>`:''}${s.complete?'<div class="arcade-win">🏆 ผ่านเกมนี้ครบแล้ว พร้อมไปด่านถัดไป!</div>':''}${p.games[api.stage].done&&!s.complete?'<p class="arcade-previous">คุณเคยผ่านเกมขั้นนี้แล้ว เล่นรูปแบบใหม่เพื่อทบทวนได้ และยังไปขั้นถัดไปได้ตามเดิม</p>':''}<div class="arcade-actions">${!noCheck?`<button class="pixelBtn yellow" data-arc-check ${s.complete?'disabled':''}>ตรวจภารกิจ</button>`:''}<button class="pixelBtn soft" data-arc-hint aria-expanded="${s.hint}">${s.hint?'ซ่อนคำใบ้':'💡 ขอคำใบ้'}</button><button class="pixelBtn soft" data-arc-reset>↻ เล่นใหม่</button><button class="pixelBtn green" data-arc-next>${api.stage==='g3'?'ไปแบบฝึกพื้นฐาน':'ไปเกม '+(Number(api.stage.slice(1))+1)} →</button></div>${s.hint?`<aside class="arcade-hint">💡 ${e(game.type==='mission'?game.items[s.idx].hint:hintFor(game))}</aside>`:''}<p class="arcade-footer">ไม่จับเวลา • เล่นได้ด้วยการแตะหรือแป้นพิมพ์ • บันทึกความคืบหน้าอัตโนมัติ</p></section>`;
  }
  function bind(api){
    const root=document.querySelector('.arcade');if(!root)return;
    const game=gameFor(api.lessonId,api.stage);
    function change(fn,focus){
      const p=api.getProgress(),s=ensure(game,p,api.stage);
      fn(p,s);api.saveProgress(p);api.render();
      if(focus)document.querySelector(focus)?.focus({preventScroll:true});
    }
    const listen=(selector,event,fn)=>root.querySelectorAll(selector).forEach(el=>el.addEventListener(event,()=>fn(el)));
    const attempt=(p,ok,question,selected,answer,code=game.code)=>{
      p.games[api.stage].attempts++;
      api.record({code,q:question,correct:answer},selected,ok,p);
    };
    const complete=(p,s)=>{s.complete=true;p.games[api.stage].done=true;p.xp=Math.max(p.xp,{g1:50,g2:80,g3:110}[api.stage]);p.resume=next[api.stage]};
    const edit=(s,fn)=>{if(s.complete)return;fn();s.feedback=null};
    listen('[data-arc-flip]','click',el=>change((p,s)=>{
      const i=+el.dataset.arcFlip;if(s.complete||s.open.length===2||s.open.includes(i)||s.matched.includes(s.deck[i].pair))return;
      s.open.push(i);s.feedback=null;
      if(s.open.length===2){const [a,b]=s.open.map(n=>s.deck[n]),ok=a.pair===b.pair;
        attempt(p,ok,game.pairs[a.pair].left,a.text+' / '+b.text,game.pairs[a.pair].right,game.pairs[a.pair].code);
        if(ok){s.matched.push(a.pair);s.open=[];s.feedback={ok:true,text:'คู่นี้เชื่อมโยงกัน: '+game.pairs[a.pair].left+' — '+game.pairs[a.pair].right};if(s.matched.length===game.pairs.length)complete(p,s)}
        else s.feedback={ok:false,text:'สองใบนี้ยังไม่ใช่คู่กัน จำตำแหน่งไว้ แล้วกดคว่ำการ์ดเพื่อลองอีกครั้ง'};
      }
    },'[data-arc-fold]:not(:disabled), [data-arc-flip]:not(:disabled), [data-arc-next]:not(:disabled)'));
    listen('[data-arc-fold]','click',()=>change((p,s)=>edit(s,()=>{s.open=[]}), '[data-arc-flip]:not(:disabled)'));
    listen('[data-arc-route]','click',el=>change((p,s)=>edit(s,()=>{const i=+el.dataset.arcRoute;if(!s.picked.includes(i))s.picked.push(i)}),'[data-arc-route]:not(:disabled), [data-arc-check]'));
    listen('[data-arc-undo]','click',()=>change((p,s)=>edit(s,()=>s.picked.pop()),'[data-arc-undo]:not(:disabled), [data-arc-route]:not(:disabled)'));
    listen('[data-arc-sort]','click',el=>change((p,s)=>edit(s,()=>{s.answers[el.dataset.arcSort]=game.categories[+el.dataset.arcCategory]}),`[data-arc-sort="${el.dataset.arcSort}"][data-arc-category="${el.dataset.arcCategory}"]`));
    listen('[data-arc-evidence]','click',el=>change((p,s)=>edit(s,()=>{const i=+el.dataset.arcEvidence;s.selected=s.selected.includes(i)?s.selected.filter(x=>x!==i):[...s.selected,i]}),`[data-arc-evidence="${el.dataset.arcEvidence}"]`));
    listen('[data-arc-range]','change',el=>change((p,s)=>edit(s,()=>{const i=+el.dataset.arcRange,c=game.controls[i];s.values[i]=Math.max(c.min,Math.min(c.max,c.min+Math.round((Number(el.value)-c.min)/c.step)*c.step))}),`[data-arc-range="${el.dataset.arcRange}"]`));
    listen('[data-arc-adjust]','click',el=>change((p,s)=>edit(s,()=>{const i=+el.dataset.arcAdjust,c=game.controls[i];s.values[i]=Math.max(c.min,Math.min(c.max,s.values[i]+Number(el.dataset.arcDelta)*c.step))}),`[data-arc-adjust="${el.dataset.arcAdjust}"][data-arc-delta="${el.dataset.arcDelta}"]:not(:disabled), [data-arc-range="${el.dataset.arcAdjust}"]`));
    listen('[data-arc-cell]','change',el=>change((p,s)=>edit(s,()=>{if(['','AA','Aa','aa'].includes(el.value))s.cells[+el.dataset.arcCell]=el.value}),`[data-arc-cell="${el.dataset.arcCell}"]`));
    listen('[data-arc-switch]','click',el=>change((p,s)=>edit(s,()=>{const i=+el.dataset.arcSwitch;s.switches[i]=!s.switches[i]}),`[data-arc-switch="${el.dataset.arcSwitch}"]`));
    listen('[data-arc-node]','click',el=>change((p,s)=>edit(s,()=>{const i=+el.dataset.arcNode;if(s.from===null)s.from=i;else if(s.from===i)s.from=null;else{const key=s.from+'-'+i;if(!s.edges.includes(key))s.edges.push(key);s.from=null}}),`[data-arc-node="${el.dataset.arcNode}"]`));
    listen('[data-arc-edge]','click',el=>change((p,s)=>edit(s,()=>{s.edges=s.edges.filter(x=>x!==el.dataset.arcEdge)}),'[data-arc-node]'));
    listen('[data-arc-answer]','click',el=>change((p,s)=>{
      if(s.complete||s.solved.includes(s.idx))return;
      const item=game.items[s.idx],answer=s.options[s.idx][+el.dataset.arcAnswer],ok=answer===item.answer;
      s.selected=answer;attempt(p,ok,item.question,answer,item.answer,item.code);
      s.feedback={ok,text:ok?item.explanation:item.hint};
      if(ok){s.solved.push(s.idx);if(s.solved.length===game.items.length)complete(p,s)}
    },'[data-arc-mission-next], [data-arc-answer]:not(:disabled), [data-arc-next]:not(:disabled)'));
    listen('[data-arc-mission-next]','click',()=>change((p,s)=>{
      if(s.complete||!s.solved.includes(s.idx)||s.idx>=game.items.length-1)return;
      s.idx++;s.selected=null;s.feedback=null;s.hint=false;
    },'[data-arc-answer]'));
    listen('[data-arc-check]','click',()=>change((p,s)=>{
      if(s.complete)return;
      if(game.type==='route'&&s.picked.length!==game.steps.length||game.type==='sort'&&Object.keys(s.answers).length!==game.items.length||game.type==='genetics'&&s.cells.some(x=>!x)){
        s.feedback={ok:false,text:'ทำกระดานให้ครบทุกช่องก่อน แล้วค่อยตรวจภารกิจ'};return;
      }
      const ok=solved(game,s);
      // Store compact, readable evidence, not a whole deck or UI state.
      let selected='',answer='';
      if(game.type==='route'){selected=s.picked.map(i=>game.steps[i]).join(' → ');answer=game.steps.join(' → ')}
      if(game.type==='sort'){selected=game.items.map((it,i)=>it.text+': '+s.answers[i]).join(' | ');answer=game.items.map(it=>it.text+': '+it.answer).join(' | ')}
      if(game.type==='evidence'){selected=s.selected.map(i=>game.cards[i].text).join(' | ');answer=game.cards.filter(it=>it.correct).map(it=>it.text).join(' | ')}
      if(game.type==='tune'){selected=valueOf(game,s)+' '+game.unit;answer=game.target+' '+game.unit}
      if(game.type==='genetics'){selected=s.cells.join(', ');answer='AA, Aa, Aa, aa'}
      if(game.type==='circuit'){selected='M/A/B: '+s.switches.map(v=>v?'ปิด':'เปิด').join('/');answer='M/A/B: ปิด/ปิด/เปิด'}
      if(game.type==='web'){const labels=keys=>keys.map(key=>key.split('-').map(i=>game.nodes[+i]).join(' → ')).join(' | ');selected=labels(s.edges);answer=labels(game.edges.map(edgeKey))}
      attempt(p,ok,game.prompt,selected,answer);
      s.feedback={ok,text:ok?game.why:retryText(game,s)};
      if(ok)complete(p,s);
    },'[data-arc-next]:not(:disabled), [data-arc-check]:not(:disabled)'));
    listen('[data-arc-hint]','click',()=>change((p,s)=>{s.hint=!s.hint},'[data-arc-hint]'));
    listen('[data-arc-reset]','click',()=>change((p)=>{p.games[api.stage].state=fresh(game);p.games[api.stage].done=false;p.resume=api.stage},'[data-arc-hint]'));
    listen('[data-arc-next]','click',()=>{const p=api.getProgress();p.resume=next[api.stage];api.saveProgress(p);api.advance(next[api.stage])});
  }
  function retryText(game,s){
    if(game.type==='route'){const n=s.picked.filter((v,i)=>v===i).length;return 'ถูกตำแหน่งแล้ว '+n+'/'+game.steps.length+' ขั้น ลองย้อนและจัดใหม่ โดยเริ่มจากจุดที่โจทย์กำหนด'}
    if(game.type==='sort'){const n=game.items.filter((it,i)=>s.answers[i]===it.answer).length;return 'จัดถูกแล้ว '+n+'/'+game.items.length+' ใบ ตรวจสมบัติของการ์ดกับหมวดที่เลือกอีกครั้ง'}
    if(game.type==='tune')return 'ค่าปัจจุบัน '+number(valueOf(game,s))+' '+game.unit+' ยัง'+(valueOf(game,s)<game.target?'ต่ำ':'สูง')+'กว่าเป้าหมาย ลองใช้สูตรปรับค่าอีกครั้ง';
    if(game.type==='genetics')return 'บางช่องยังไม่ตรง ลองนำแอลลีลจากหัวแถวและหัวคอลัมน์มารวมทีละช่อง';
    if(game.type==='circuit')return 'ตรวจสวิตช์หลักและทั้งสองแขนง เป้าหมายคือหลอด A ติด แต่หลอด B ดับ';
    if(game.type==='web')return 'เส้นทางยังไม่ครบหรือมีเส้นที่ไม่ตรงโจทย์ ตรวจทิศจากอาหารไปยังผู้กิน และแตะเส้นที่ต้องการลบ';
    return 'ยังเลือกหลักฐานไม่ตรงทั้งหมด ตรวจทั้งการ์ดที่เลือกไว้และการ์ดที่เว้นไว้ แล้วลองอีกครั้ง';
  }
  window.SLH_GAMES={render,bind};
})();
