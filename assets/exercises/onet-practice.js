// Practice against official papers; option numbers keep their original order.
(() => {
  'use strict';
  const rows = window.SLH_ONET_ORIGINAL_ROWS;
  const sources = window.SLH_ONET_SOURCES;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const questions = rows.map(([year,number,page,code,key,note]) => {
    const source = sources.find(s => s.year === year);
    const lesson = code.replace(/S\d+$/, '');
    if (!source || !window.SLH_DATA.packs[lesson]?.some(s => s.code === code) || key < 1 || key > 4 || page > source.pages) throw Error('Invalid O-NET reference: '+year+'/'+number);
    return {id:year+'-'+number,year,number,page,code,key,note,lesson,source};
  });
  window.SLH_ONET = {
    questions,
    render(id, progress) {
      const list = questions.filter(q => q.lesson === id);
      return `<section class="exerciseCard" style="margin-top:24px" aria-label="ฝึกข้อสอบ O-NET จริง"><h2>ฝึกข้อสอบ O-NET จริง</h2><p>เปิดต้นฉบับ สทศ. เพื่ออ่านโจทย์และตัวเลือก แล้วตอบด้วยหมายเลขเดิม 1–4 ด้านล่าง ต้องใช้อินเทอร์เน็ตเพื่อเปิดเอกสาร</p><p>แบบฝึกเสริมนี้บันทึกคำตอบแยกจากชุด Challenge และไม่เพิ่ม XP</p>${list.length ? list.map(q => {
        const saved = progress.onetOriginals?.[q.id] || {};
        return `<div class="question"><h3>ปีการศึกษา ${q.year} • ข้อ ${q.number}</h3><p><a href="${esc(q.source.pdf)}#page=${q.page}" target="_blank" rel="noopener noreferrer">เปิดข้อสอบต้นฉบับ • หน้า PDF ${q.page}</a> · <a href="${esc(q.source.landing)}" target="_blank" rel="noopener noreferrer">หน้ารวมข้อสอบและเฉลย สทศ.</a></p><div class="choiceGrid">${[1,2,3,4].map(n => `<button class="choice ${saved.answer === n ? 'sel' : ''}" data-onet-id="${q.id}" data-onet-answer="${n}" aria-pressed="${saved.answer === n}">ตัวเลือก ${n}</button>`).join('')}</div><p><button class="pixelBtn yellow small" data-onet-check="${q.id}" ${saved.answer ? '' : 'disabled'}>ตรวจคำตอบข้อ ${q.number}</button></p>${saved.checked ? `<div class="qFeedback" role="status">${saved.answer === q.key ? '✅ ถูกต้อง' : '❌ คำตอบที่ถูก: ตัวเลือก '+q.key}<br>${esc(q.note)}</div>` : ''}</div>`;
      }).join('') : '<p>บทนี้ยังไม่มีข้อสอบจริงที่จับคู่หัวข้อไว้ สามารถฝึกชุด Challenge ด้านบนได้</p>'}</section>`;
    },
    bind({id,getProgress,saveProgress,render}) {
      const allowed = new Map(questions.filter(q => q.lesson === id).map(q => [q.id,q]));
      document.querySelectorAll('[data-onet-answer]').forEach(button => button.onclick = () => {
        const key = button.dataset.onetId, answer = Number(button.dataset.onetAnswer);
        if (!allowed.has(key) || ![1,2,3,4].includes(answer)) return;
        const p = getProgress();
        p.onetOriginals ||= {};
        p.onetOriginals[key] = {answer,checked:false};
        saveProgress(p); render();
      });
      document.querySelectorAll('[data-onet-check]').forEach(button => button.onclick = () => {
        const key = button.dataset.onetCheck, p = getProgress();
        if (!allowed.has(key) || !p.onetOriginals?.[key]?.answer) return;
        p.onetOriginals[key].checked = true;
        saveProgress(p); render();
      });
    }
  };
})();
