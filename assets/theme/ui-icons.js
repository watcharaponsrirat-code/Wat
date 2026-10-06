/* Presentation-only icons. Never rewrites lesson data, answer values or storage. */
(() => {
  'use strict';
  if (!document.createTreeWalker || typeof MutationObserver === 'undefined') return;
  const shapes = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    atom:'<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1"/>',
    microscope:'<path d="m9 3 4 2-4 8-4-2 4-8Zm2 7c9 0 10 11 0 11H4m4-7H3m5 7v-4h6"/><path d="m11 2 3 1"/>',
    leaf:'<path d="M20 3C8 2 2 8 5 15s15 6 15-12Z"/><path d="M3 22 16 9m-8 8v-5m4 1h5"/>',
    thermometer:'<path d="M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0Z"/><path d="M12 8v10m6-12h3m-3 4h2"/><circle cx="12" cy="18" r="1.5"/>',
    weather:'<circle cx="7" cy="7" r="3"/><path d="M7 1v1M1 7h1m1-4 1 1m7-1-1 1M7 17h12a3 3 0 0 0 0-6 5 5 0 0 0-9-2 4 4 0 0 0-3 8Zm3 3-1 2m6-2-1 2m6-2-1 2"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
    salt:'<path d="m8 8-3 12h14L16 8H8Zm1 0V4h6v4M8 14h8"/><path d="M10 3h4m-5 14h.1m3 1h.1m3-1h.1"/>',
    heart:'<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1s-1 7 1 9l7 7 7-7c2-2 4-6 1-9Z"/><path d="M3 12h5l2-4 3 8 2-4h6"/>',
    run:'<circle cx="15" cy="4" r="2"/><path d="m7 9 4-2 4 4 5 1m-9-5-3 7 5 2-1 6m-4-8-3 5H2"/>',
    gear:'<path d="m9 3 1-2h4l1 2 3 2 2 .5 2 3-1 2v3l1 2-2 3-2 .5-3 2-1 2h-4l-1-2-3-2-2-.5-2-3 1-2v-3l-1-2 2-3L6 5Z"/><circle cx="12" cy="12" r="3"/>',
    flask:'<path d="M9 2h6m-5 0v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 15h10"/><circle cx="10" cy="18" r=".7"/><path d="M14 11h.1"/>',
    globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
    battery:'<rect x="2" y="6" width="18" height="12" rx="2"/><path d="M22 10v4M6 10v4m4-4v4m4-4v4"/>',
    bulb:'<path d="M9 18v-2a7 7 0 1 1 6 0v2M9 18h6m-6 3h6M12 9v6m-3-6 3 2 3-2"/>',
    dna:'<path d="M6 2c0 10 12 10 12 20M18 2C18 12 6 12 6 22M7 5h10M9 9h6m-6 6h6M7 19h10"/>',
    rainbow:'<path d="M2 20v-7a10 10 0 0 1 20 0v7M6 20v-7a6 6 0 0 1 12 0v7m-8 0v-7a2 2 0 0 1 4 0v7"/>',
    planet:'<circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="12" ry="3" transform="rotate(-25 12 12)"/>',
    bolt:'<path d="m14 2-11 12h8l-1 8 11-13h-8l1-7Z"/>',
    tree:'<path d="M10 21v-5H6a4 4 0 0 1-2-7 5 5 0 0 1 4-5 5 5 0 0 1 9 1 5 5 0 0 1 3 8 4 4 0 0 1-3 3h-3v5M7 22h10m-5-6V9m0 4-3-3m3 5 4-4"/>',
    home:'<path d="m2 11 10-8 10 8M5 9v12h5v-7h4v7h5V9"/>',
    graduate:'<path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7m4-2v9"/>',
    gem:'<path d="m3 8 4-5h10l4 5-9 14L3 8Zm0 0h18M7 3l5 19 5-19"/>',
    refresh:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
    star:'<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z"/>',
    telescope:'<path d="m4 10 13-7 4 7-14 6-3-6Zm-2 2 2-1 2 4-2 1-2-4Zm11 1v3m0 0-5 6m5-6 5 6"/>',
    block:'<path d="m12 2 10 5v10l-10 5-10-5V7l10-5Zm-10 5 10 5 10-5M12 12v10"/>',
    play:'<path d="m8 4 12 8-12 8V4Z"/>',
    pause:'<path d="M8 4v16M16 4v16"/>',
    game:'<path d="M7 7h10c4 0 6 11 3 13-2 1-4-4-5-4H9c-1 0-3 5-5 4C1 18 3 7 7 7Z"/><path d="M6 11v5m-2-2h5m7-2h.1m3 3h.1M10 7l1-4h3"/>',
    book:'<path d="M12 5C8 2 4 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-2-1-6-2-10 1Zm0 0v16M5 8h4m-4 4h4m6-4h4m-4 4h4"/>',
    person:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    pickaxe:'<path d="m4 21 12-13M5 3c6-2 13 3 16 10l-8-6-8-4Z"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    pin:'<path d="M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
    close:'<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8m0-8-8 8"/>',
    trophy:'<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v5m-5 2h10m-9-2h8"/>',
    celebrate:'<path d="m3 21 4-14 10 10-14 4Zm4-14 10 10M14 3v3m4 2 3-2m-1 7h3M8 2l1 2m9-2 1 1"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    cards:'<rect x="7" y="3" width="14" height="18" rx="2"/><path d="M4 5H3v14h1m10-12 4 5-4 5-4-5 4-5Z"/>',
    sliders:'<path d="M5 2v5m0 4v11M12 2v11m0 4v5M19 2v3m0 4v13"/><rect x="3" y="7" width="4" height="4" rx="1"/><rect x="10" y="13" width="4" height="4" rx="1"/><rect x="17" y="5" width="4" height="4" rx="1"/>',
    rocket:'<path d="M9 15c-1-6 6-12 13-13 0 7-6 14-13 13Zm0 0-3-3-4 3 6-9m1 9 3 3-3 4 9-6M6 17l-3 4 4-3"/><circle cx="16" cy="8" r="2"/>',
    grasshopper:'<path d="m5 14 7-4 7 3-5 3-9-2Zm0 0-3 5m12-3 3 4m-5-10 3-5 4 5m0 3 2-2m-3 1 1-5m-2 5-2-4m-6 7-3 6"/>',
    mouse:'<path d="M6 17c-5 4-6-4-3-5m3 5c-3-6 2-10 6-10s7 5 9 9c-3 5-11 5-15 1Z"/><circle cx="12" cy="7" r="3"/><path d="M18 13h.1m3 3h1"/>',
    frog:'<path d="M5 10a4 4 0 1 1 7-3 4 4 0 1 1 7 3c5 9-19 9-14 0ZM6 17l-3 4h5m10-4 3 4h-5M8 7h.1M16 7h.1m-7 5c2 2 4 2 6 0"/>',
    snake:'<path d="M18 5c-8-5-12 7-5 7h2c9 0 6 10-2 9C1 20 1 11 5 10m13-5 3 2-3 2h-3m6-2h2m-5-1h.1"/>',
    flag:'<path d="M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
    left:'<path d="m10 5-7 7 7 7M3 12h18"/>',
    right:'<path d="m14 5 7 7-7 7M3 12h18"/>'
  };
  const entries=[
    ['🔍🔎','search','ค้นหา'],['⚛','atom','อะตอม'],['🔬','microscope','กล้องจุลทรรศน์'],['🌿','leaf','พืช'],['🌡','thermometer','อุณหภูมิ'],['🌦','weather','สภาพอากาศ'],['🧭','compass','เข็มทิศ'],['🧂','salt','สารละลาย'],['🫀','heart','หัวใจ'],['🏃','run','การเคลื่อนที่'],['⚙','gear','เครื่องกล'],['🧪⚗','flask','การทดลอง'],['🌍','globe','โลก'],['🔋','battery','แบตเตอรี่'],['💡','bulb','หลอดไฟ'],['🧬','dna','พันธุศาสตร์'],['🌈','rainbow','แสง'],['🪐','planet','ดาวเคราะห์'],['⚡','bolt','ไฟฟ้า'],['🌳','tree','ต้นไม้'],['🏠','home','หน้าหลัก'],['🎓','graduate','ผู้เรียน'],['💎','gem','คะแนนประสบการณ์'],['🔄','refresh','ทบทวน'],['⭐★','star','ดาว'],['🔭','telescope','กล้องโทรทรรศน์'],['🟫','block','บล็อก'],['▶','play','เล่น'],['🎮','game','เกม'],['📘📚','book','บทเรียน'],['🧑','person','ผู้ใช้'],['⛏','pickaxe','ภารกิจ'],['✅✓','check','ถูกต้อง'],['📍','pin','จุดที่บันทึก'],['❌','close','ไม่ถูกต้อง'],['🏆','trophy','รางวัล'],['🎉','celebrate','สำเร็จ'],['🎯','target','เป้าหมาย'],['🃏','cards','การ์ด'],['📦','block','จัดกลุ่ม'],['🎛','sliders','ปรับค่า'],['🚀','rocket','ภารกิจ'],['🦗','grasshopper','ตั๊กแตน'],['🐁','mouse','หนู'],['🐸','frog','กบ'],['🐍','snake','งู'],['⚑','flag','จุดเรียนต่อ']
  ];
  const icons=new Map();for(const [chars,name,label] of entries)for(const char of chars)icons.set(char,{name,label});
  const arrows=new Map([['←',{name:'left',label:'ย้อนกลับ'}],['→',{name:'right',label:'ถัดไป'}],['↻',{name:'refresh',label:'เริ่มใหม่'}],['↺',{name:'refresh',label:'เริ่มใหม่'}],['↶',{name:'refresh',label:'หมุนซ้าย'}],['↷',{name:'refresh',label:'หมุนขวา'}],['❚❚',{name:'pause',label:'หยุดเวลา'}]]);
  const pattern=new RegExp([...icons.keys(),...arrows.keys()].sort((a,b)=>b.length-a.length).join('|')+'|\uFE0F','gu');
  const skip='script,style,textarea,input,select,option,code,pre,svg,canvas,[contenteditable]:not([contenteditable="false"]),.uiIcon';
  function replaceText(node){
    const parent=node.parentElement;if(!parent||parent.closest(skip))return;
    const text=node.nodeValue;pattern.lastIndex=0;if(!pattern.test(text))return;
    pattern.lastIndex=0;const fragment=document.createDocumentFragment();let offset=0,changed=false;
    for(const match of text.matchAll(pattern)){
      const info=icons.get(match[0])||(parent.closest('button,a')?arrows.get(match[0]):null);
      if(!info)continue;
      fragment.append(document.createTextNode(text.slice(offset,match.index)));
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','uiIcon uiIcon--'+info.name);
      svg.setAttribute('focusable','false');
      if(parent.closest('[aria-label],[aria-hidden="true"]')||(/\p{L}/u.test(parent.textContent)&&info.name!=='gem'))svg.setAttribute('aria-hidden','true');
      else{svg.setAttribute('role','img');svg.setAttribute('aria-label',info.label)}
      svg.innerHTML=shapes[info.name];fragment.append(svg);
      offset=match.index+match[0].length;if(text[offset]==='\uFE0F')offset++;
      changed=true;
    }
    if(changed){fragment.append(document.createTextNode(text.slice(offset)));node.replaceWith(fragment)}
  }
  function scan(root){
    if(root.nodeType===Node.TEXT_NODE){replaceText(root);return}
    if(root.nodeType!==Node.ELEMENT_NODE||root.closest(skip))return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement.closest(skip)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(replaceText);
  }
  const observer=new MutationObserver(records=>{
    observer.disconnect();
    try{for(const record of records){if(record.type==='characterData'&&record.target.isConnected)scan(record.target);for(const node of record.addedNodes)if(node.isConnected)scan(node)}}
    finally{observe()}
  });
  function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true})}
  scan(document.body);observe();
})();
