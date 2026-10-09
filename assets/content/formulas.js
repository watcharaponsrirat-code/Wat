// Presentation only: original formulas and answer values are kept for grading.
(() => {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fraction=(top,bottom)=>({fraction:[top,bottom]});
  const symbol=(base,sub='',sup='')=>({base,sub,sup});
  const E_p=symbol('E','p'),E_k=symbol('E','k'),v2=symbol('v','','2');
  const catalog={
    G1U2L1S6:{name:'ความหนาแน่น',words:['ความหนาแน่น','=',fraction('มวล (g)','ปริมาตร (cm³)')],symbols:['ρ','=',fraction('m','V')],legend:[['ρ','ความหนาแน่น (g/cm³)'],['m','มวล (g)'],['V','ปริมาตร (cm³)']],note:'เลือกหน่วยให้สอดคล้องกัน: ใช้ kg และ m³ จะได้ความหนาแน่นเป็น kg/m³'},
    G2U2L2S2:{name:'ร้อยละโดยมวล',words:['ร้อยละโดยมวล','=',fraction('มวลของตัวละลาย (g)','มวลของสารละลาย (g)'),'×','100'],note:'มวลของสารละลาย = มวลของตัวละลาย + มวลของตัวทำละลาย ต้องใช้หน่วยมวลเดียวกันทั้งเศษและส่วน'},
    G2U2L2S3:{name:'ร้อยละโดยปริมาตร',words:['ร้อยละโดยปริมาตร','=',fraction('ปริมาตรของตัวละลาย (cm³)','ปริมาตรของสารละลาย (cm³)'),'×','100'],note:'ใช้ปริมาตรของสารละลายสุดท้ายเป็นตัวส่วน ใช้ mL แทน cm³ ได้ โดย 1 mL = 1 cm³'},
    G2U2L2S4:{name:'ร้อยละโดยมวลต่อปริมาตร',words:['ร้อยละโดยมวลต่อปริมาตร','=',fraction('มวลของตัวละลาย (g)','ปริมาตรของสารละลาย (cm³)'),'×','100'],note:'ใช้มวลเป็น g และปริมาตรสารละลายเป็น cm³ หรือ mL โดย 1 cm³ = 1 mL เช่น 5% โดยมวลต่อปริมาตร หมายถึงตัวละลาย 5 g ในสารละลาย 100 cm³'},
    G2U4L1S4:{name:'อัตราเร็วเฉลี่ย',words:['อัตราเร็วเฉลี่ย (m/s)','=',fraction('ระยะทางรวม (m)','เวลารวม (s)')],note:'ใช้ระยะทางรวมที่เคลื่อนที่ได้ ไม่ใช้การกระจัดแทนระยะทาง'},
    G2U4L1S5:{name:'ความเร็วเฉลี่ย',words:['ความเร็วเฉลี่ย (m/s)','=',fraction('การกระจัด (m)','เวลารวม (s)')],note:'ความเร็วและการกระจัดมีทิศทาง ต้องระบุทิศอ้างอิง; กลับถึงจุดเดิมมีการกระจัดและความเร็วเฉลี่ยเป็นศูนย์'},
    G2U4L2S7:{name:'โมเมนต์ของแรง',words:['โมเมนต์ของแรง (N·m)','=','แรง (N)','×','ระยะตั้งฉาก (m)'],symbols:['M','=','F','×','l'],legend:[['M','โมเมนต์ของแรง (N·m)'],['F','ขนาดของแรง (N)'],['l','ระยะตั้งฉากจากจุดหมุนถึงแนวแรง (m)']],note:'พิจารณาทิศการหมุนตามเข็มหรือทวนเข็มนาฬิกาด้วย'},
    G2U5L1S1:{name:'งานทางฟิสิกส์',words:['งาน (J)','=','แรง (N)','×','ระยะทางตามแนวแรง (m)'],symbols:['W','=','F','×','s'],legend:[['W','งาน (J)'],['F','ขนาดของแรงคงตัว (N)'],['s','ขนาดการกระจัดในแนวแรง (m)']],note:'สูตรนี้ใช้เมื่อแรงคงตัวและการกระจัดมีทิศเดียวกับแรง'},
    G2U5L1S3:{name:'กำลัง',words:['กำลังเฉลี่ย (W)','=',fraction('งานที่ทำ (J)','เวลาที่ใช้ (s)')],symbols:['P','=',fraction('W','t')],legend:[['P','กำลัง (W)'],['W','งาน (J)'],['t','เวลา (s)']],note:'สัญลักษณ์ W ในสมการหมายถึงงาน ส่วน W ที่เขียนเป็นหน่วยหมายถึงวัตต์'},
    G2U5L2S2:{name:'พลังงานศักย์โน้มถ่วง',words:['พลังงานศักย์โน้มถ่วง (J)','=','มวล (kg)','×','ความเร่งโน้มถ่วง (m/s²)','×','ความสูง (m)'],symbols:[E_p,'=','m','×','g','×','h'],legend:[[E_p,'พลังงานศักย์โน้มถ่วง (J)'],['m','มวล (kg)'],['g','ความเร่งโน้มถ่วง (m/s²)'],['h','ความสูงจากระดับอ้างอิง (m)']],note:'ใช้ใกล้ผิวโลกเมื่อ g มีค่าประมาณคงที่ และกำหนดระดับอ้างอิงของความสูงให้ชัด'},
    G2U5L2S3:{name:'พลังงานจลน์',words:['พลังงานจลน์ (J)','=',fraction('1','2'),'×','มวล (kg)','×','อัตราเร็ว² (m²/s²)'],symbols:[E_k,'=',fraction('1','2'),'×','m','×',v2],legend:[[E_k,'พลังงานจลน์ (J)'],['m','มวล (kg)'],['v','อัตราเร็ว (m/s)']],note:'ยกกำลังสองเฉพาะอัตราเร็ว v ก่อนคูณกับมวลและหนึ่งส่วนสอง'},
    G3U3L1S5:{name:'ความถี่และคาบ',words:['คาบ (s)','=',fraction('1','ความถี่ (Hz)')],symbols:['T','=',fraction('1','f')],legend:[['T','คาบ หรือเวลาต่อหนึ่งรอบ (s)'],['f','ความถี่ หรือจำนวนรอบต่อวินาที (Hz)']],note:'ความถี่มากขึ้น คาบสั้นลง'},
    G3U3L1S6:{name:'อัตราเร็วคลื่น',words:['อัตราเร็วคลื่น (m/s)','=','ความถี่ (Hz)','×','ความยาวคลื่น (m)'],symbols:['v','=','f','×','λ'],legend:[['v','อัตราเร็วคลื่น (m/s)'],['f','ความถี่ (Hz)'],['λ','ความยาวคลื่น (m)']],note:'เนื้อหาเสริมตามบทเรียนเดิม; เมื่ออัตราเร็วคงที่ ความถี่มากขึ้นทำให้ความยาวคลื่นสั้นลง'},
    G3U3L2S7:{name:'ดัชนีหักเห',words:['ดัชนีหักเห','=',fraction('อัตราเร็วแสงในสุญญากาศ','อัตราเร็วแสงในตัวกลาง')],symbols:['n','=',fraction('c','v')],legend:[['n','ดัชนีหักเห (ไม่มีหน่วย)'],['c','อัตราเร็วแสงในสุญญากาศ (m/s)'],['v','อัตราเร็วแสงในตัวกลาง (m/s)']],note:'เนื้อหาเสริมตามบทเรียนเดิม; ใช้หน่วยอัตราเร็วเดียวกันในเศษและส่วน'},
    G3U6L1S2:{name:'กระแสไฟฟ้า',words:['กระแสไฟฟ้า (A)','=',fraction('ปริมาณประจุไฟฟ้า (C)','เวลา (s)')],symbols:['I','=',fraction('Q','t')],legend:[['I','กระแสไฟฟ้า (A)'],['Q','ปริมาณประจุที่ผ่านหน้าตัดตัวนำ (C)'],['t','เวลา (s)']]},
    G3U6L1S6:{name:'กฎของโอห์ม',words:['ความต่างศักย์ (V)','=','กระแสไฟฟ้า (A)','×','ความต้านทาน (Ω)'],symbols:['V','=','I','×','R'],legend:[['V','ความต่างศักย์ (V)'],['I','กระแสไฟฟ้า (A)'],['R','ความต้านทาน (Ω)']],note:'ใช้กับตัวนำโอห์มิกที่อุณหภูมิและสภาพทางกายภาพคงที่'},
    G3U6L2S1:{name:'กำลังไฟฟ้า',words:['กำลังไฟฟ้า (W)','=','ความต่างศักย์ (V)','×','กระแสไฟฟ้า (A)'],symbols:['P','=','V','×','I'],legend:[['P','กำลังไฟฟ้า (W)'],['V','ความต่างศักย์ (V)'],['I','กระแสไฟฟ้า (A)']]},
    G3U6L2S2:{name:'พลังงานไฟฟ้า',words:['พลังงานไฟฟ้า','=','กำลังไฟฟ้า','×','เวลา'],symbols:['E','=','P','×','t'],legend:[['E','พลังงานไฟฟ้า (J หรือ kWh)'],['P','กำลังไฟฟ้า (W หรือ kW)'],['t','เวลา (s หรือ h)']],note:'เมื่อกำลังคงที่: W × s ได้ J; kW × h ได้ kWh และ 1 kWh = 3.6 × 10⁶ J'}
  };

  // These relationships already appear in the existing explanations/worked examples.
  Object.assign(catalog,{
    G1U5L1S5:{name:'ความร้อนกับการเปลี่ยนอุณหภูมิ',words:['ปริมาณความร้อน (J)','=','มวล (g)','×','ความร้อนจำเพาะ [J/(g·°C)]','×','อุณหภูมิที่เปลี่ยนไป (°C)'],symbols:['Q','=','m','×','c','×','ΔT'],legend:[['Q','ปริมาณความร้อน (J)'],['m','มวล (g)'],['c','ความร้อนจำเพาะ [J/(g·°C)]'],['ΔT','อุณหภูมิสุดท้าย − อุณหภูมิเริ่มต้น (°C)']],note:'ใช้เมื่อสารไม่เปลี่ยนสถานะและ c ประมาณคงที่ ถ้าใช้มวล kg ต้องใช้ c ในหน่วย J/(kg·°C)'},
    G1U5L1S7:{name:'ความร้อนกับการเปลี่ยนสถานะ',words:['ปริมาณความร้อน (J)','=','มวล (g)','×','ความร้อนแฝงจำเพาะ (J/g)'],symbols:['Q','=','m','×','L'],legend:[['Q','ขนาดของความร้อนที่รับหรือคาย (J)'],['m','มวลที่เปลี่ยนสถานะ (g)'],['L','ความร้อนแฝงจำเพาะ (J/g)']],note:'ใช้ขณะเปลี่ยนสถานะที่อุณหภูมิคงที่ เลือก L ให้ตรงกับการเปลี่ยนสถานะและหน่วยมวล'},
    G1U5L2S6:{name:'สมดุลความร้อน',words:['ความร้อนที่คาย','=', 'ความร้อนที่รับ'],symbols:[symbol('Q','คาย'),'=',symbol('Q','รับ')],note:'คิดเป็นขนาดของพลังงาน เมื่อไม่มีความร้อนถ่ายโอนออกสู่สิ่งแวดล้อม และรวมทุกส่วนที่แลกเปลี่ยนความร้อนในระบบ'},
    G3U6L1S4:{name:'ความต่างศักย์',words:['ความต่างศักย์ (V)','=',fraction('งานหรือพลังงานไฟฟ้า (J)','ปริมาณประจุไฟฟ้า (C)')],symbols:['V','=',fraction('W','Q')],legend:[['V','ความต่างศักย์ระหว่างสองจุด (V)'],['W','งานหรือพลังงานที่ถ่ายโอน (J)'],['Q','ปริมาณประจุไฟฟ้า (C)']],note:'สัญลักษณ์ Q ในเรื่องไฟฟ้าหมายถึงประจุไฟฟ้า ต่างจาก Q ในเรื่องความร้อน'}
  });
  catalog.G1U5L1S8={...catalog.G1U5L1S7,name:'ความร้อนกับการกลายเป็นไอและควบแน่น'};

  function plain(node){
    if(Array.isArray(node))return node.map(plain).join(' ');
    if(node?.fraction)return plain(node.fraction[0])+' หารด้วย '+plain(node.fraction[1]);
    if(node?.base)return node.base+(node.sub?' ห้อย '+node.sub:'')+(node.sup?' ยกกำลัง '+node.sup:'');
    return String(node??'');
  }
  function token(node){
    if(Array.isArray(node))return node.map(token).join('<span class="eq-gap"></span>');
    if(node?.fraction)return '<span class="eq-fraction"><span class="eq-numerator">'+token(node.fraction[0])+'</span><span class="eq-denominator">'+token(node.fraction[1])+'</span></span>';
    if(node?.base)return '<span class="eq-symbol"><i>'+esc(node.base)+'</i>'+(node.sub?'<sub>'+esc(node.sub)+'</sub>':'')+(node.sup?'<sup>'+esc(node.sup)+'</sup>':'')+'</span>';
    if(/^[A-Za-zρλ]$/.test(String(node)))return '<i class="eq-var">'+esc(node)+'</i>';
    return esc(node).replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,m=>'<sup>'+[...m].map(c=>'⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')+'</sup>');
  }
  function equation(nodes,label,inline=false){
    const parts=Array.isArray(nodes)?nodes:[nodes];
    return '<span class="'+(inline?'eq-inline':'equationRow')+'" role="math" aria-label="'+esc(label||plain(parts))+'"><span class="equationVisual" aria-hidden="true">'+parts.map(n=>'<span class="eq-term">'+token(n)+'</span>').join('')+'</span></span>';
  }
  const aliases=[];
  const add=(source,nodes)=>aliases.push({source,nodes});
  for(const [id,entry] of Object.entries(catalog)){
    const section=Object.values(window.SLH_DATA?.packs||{}).flat().find(s=>s.code===id);
    if(section?.formula)add(section.formula,/[ก-๙]/.test(section.formula)?entry.words:(entry.symbols||entry.words));
  }
  [
    ['%w/w = มวลตัวละลาย ÷ มวลสารละลาย × 100',catalog.G2U2L2S2.words],
    ['อัตราเร็วเฉลี่ย = ระยะทาง ÷ เวลา',catalog.G2U4L1S4.words],
    ['มุมตกกระทบ = มุมสะท้อน',['มุมตกกระทบ','=','มุมสะท้อน']],
    ['มวลก่อน = มวลของแข็ง + มวลแก๊ส',['มวลก่อน','=','มวลของแข็ง','+','มวลแก๊ส']],
    ['E (kWh) = P (kW) × t (h)',['E (kWh)','=','P (kW)','×','t (h)']],
    ['ความเร็วเฉลี่ย = การกระจัด/เวลารวม',catalog.G2U4L1S5.words],
    ['ความหนาแน่น = มวล ÷ ปริมาตร',['ความหนาแน่น','=',fraction('มวล','ปริมาตร')]],
    ['อัตราเร็ว = ระยะทาง ÷ เวลา',['อัตราเร็ว','=',fraction('ระยะทาง','เวลา')]],
    ['ร้อยละโดยมวล = มวลตัวละลาย ÷ มวลสารละลาย × 100',['ร้อยละโดยมวล','=',fraction('มวลตัวละลาย','มวลสารละลาย'),'×','100']],
    ['Q = mcΔT',catalog.G1U5L1S5.symbols],
    ['Q = mL',catalog.G1U5L1S7.symbols],
    ['V = W/Q',catalog.G3U6L1S4.symbols],
    ['F = W/s',['F','=',fraction('W','s')]],
    ['ΔEp = mgΔh',[symbol('ΔE','p'),'=','m','×','g','×','Δh']],
    ['ρ = m ÷ V',catalog.G1U2L1S6.symbols],
    ['λ = v ÷ f',['λ','=',fraction('v','f')]],
    ['P = E/t',['P','=',fraction('E','t')]],
    ['I = V/R',['I','=',fraction('V','R')]],
    ['R = V/I',['R','=',fraction('V','I')]],
    ['λ = v/f',['λ','=',fraction('v','f')]],
    ['f = 1/T',['f','=',fraction('1','T')]],
    ['Ek = 1/2mv²',catalog.G2U5L2S3.symbols],
    ['Ep = m×g×h',catalog.G2U5L2S2.symbols],
    ['W = F×s',catalog.G2U5L1S1.symbols],
    ['V = I×R',catalog.G3U6L1S6.symbols],
    ['P = V×I',catalog.G3U6L2S1.symbols],
    ['E = P×t',catalog.G3U6L2S2.symbols]
  ].forEach(([s,n])=>add(s,n));
  const escapeRE=s=>s.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\$&');
  aliases.sort((a,b)=>b.source.length-a.source.length);
  const aliasRules=aliases.map(a=>({...a,re:new RegExp([...a.source.replace(/\s/g,'')].map(escapeRE).join('\\s*'),'g')}));
  function text(value){
    const raw=String(value??''),matches=[];
    for(const rule of aliasRules){
      rule.re.lastIndex=0;
      for(const m of raw.matchAll(rule.re)){
        const start=m.index,end=start+m[0].length;
        if(/[A-Za-z]/.test(raw[start-1]||'')||/[A-Za-z]/.test(raw[end]||''))continue;
        if(matches.some(x=>start<x.end&&end>x.start))continue;
        matches.push({start,end,html:equation(rule.nodes,m[0],true)});
      }
    }
    // Only arithmetic fractions. Unit slashes, dates and Thai alternatives remain text.
    const numeric=/(\d+(?:\.\d+)?(?:\s*[×*]\s*\d+(?:\.\d+)?)*)\s*[\/÷]\s*(\d+(?:\.\d+)?)/g;
    for(const m of raw.matchAll(numeric)){
      const start=m.index,end=start+m[0].length;
      if(/[A-Za-z\d./]/.test(raw[start-1]||'')||/[A-Za-z\d./⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(raw[end]||''))continue;
      if(matches.some(x=>start<x.end&&end>x.start))continue;
      matches.push({start,end,html:equation(fraction(m[1].replace(/\*/g,'×'),m[2]),m[0],true)});
    }
    const symbols=/(?<![A-Za-z0-9])(Ep|Ek|[CV][12])(?=[^A-Za-z0-9]|$)/g;
    for(const m of raw.matchAll(symbols)){
      const start=m.index,end=start+m[0].length;if(matches.some(x=>start<x.end&&end>x.start))continue;
      matches.push({start,end,html:equation(symbol(m[0][0],m[0][1]),m[0],true)});
    }
    matches.sort((a,b)=>a.start-b.start);
    let result='',cursor=0;
    for(const m of matches){result+=esc(raw.slice(cursor,m.start))+m.html;cursor=m.end}
    return result+esc(raw.slice(cursor));
  }
  function renderSection(section){
    const entry=catalog[section.code];
    if(!entry)return section.formula?'<div class="formula scienceEquation">'+text(section.formula)+'</div>':'';
    return '<div class="formula scienceEquation" data-equation="'+esc(section.code)+'">'+
      '<div class="equationHeading">ความสัมพันธ์ที่ใช้</div>'+equation(entry.words)+
      (entry.symbols?'<div class="equationSymbolRow"><span class="equationCaption">เขียนด้วยสัญลักษณ์</span>'+equation(entry.symbols)+'</div>':'')+
      (entry.legend?'<dl class="equationLegend">'+entry.legend.map(([s,meaning])=>'<div><dt>'+token(s)+'</dt><dd>'+text(meaning)+'</dd></div>').join('')+'</dl>':'')+
      (entry.note?'<p class="equationNote">'+text(entry.note)+'</p>':'')+'</div>';
  }
  window.SLH_MATH={text,renderSection,equation,catalog};
})();
