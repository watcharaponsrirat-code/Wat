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
    const image = window.SLH_ONET_IMAGES[year+'-'+number];
    if (!image) throw Error('Missing O-NET image: '+year+'/'+number);
    return {id:year+'-'+number,year,number,page,code,key,note,lesson,source,image};
  });
  window.SLH_ONET = {
    questions,
    render(id, progress) {
      const list = questions.filter(q => q.lesson === id);
      const answered = list.filter(q => progress.onetOriginals?.[q.id]?.answer).length;
      const correct = list.filter(q => progress.onetOriginals?.[q.id]?.checked && progress.onetOriginals[q.id].answer === q.key).length;
      return `<section class="exerciseCard onetPractice" aria-label="ฝึกข้อสอบ O-NET จริง"><div class="gameTitle"><span class="num">C</span><div><h2>แบบฝึกระดับ 3 • O-NET ข้อสอบจริง</h2><p>อ่านโจทย์และตัวเลือกจากภาพต้นฉบับ แล้วเลือกคำตอบ 1–4 ได้เลย</p></div></div><p class="onetNote">บันทึกคำตอบให้อัตโนมัติ • ฝึกซ้ำได้ • แบบฝึกเสริมนี้ไม่เพิ่ม XP</p><p role="status">ตอบแล้ว ${answered}/${list.length} ข้อ • ตรวจถูกแล้ว ${correct} ข้อ</p>${list.length ? list.map((q,index) => {
        const saved = progress.onetOriginals?.[q.id] || {};
        return `<div class="question onetQuestion"><span class="qTag onet">O-NET • ปีการศึกษา ${q.year}</span><h3 id="onet-title-${q.id}">ข้อ ${index+1}. ข้อสอบจริงปี ${q.year} ข้อ ${q.number}</h3><div class="onetImageTools"><button class="pixelBtn soft small" data-onet-zoom="${q.id}" aria-expanded="false" aria-controls="onet-image-${q.id}">ขยายภาพโจทย์</button><span>ภาพมีโจทย์ ภาพประกอบ และตัวเลือกครบทั้ง 4 ข้อ</span></div><div class="onetImageFrame" id="onet-image-${q.id}" tabindex="0" role="region" aria-label="ภาพโจทย์ปี ${q.year} ข้อ ${q.number}"><img class="onetQuestionImage" src="${esc(q.image.src)}" width="${q.image.width}" height="${q.image.height}" loading="lazy" decoding="async" alt="โจทย์และตัวเลือก O-NET วิทยาศาสตร์ ม.3 ปีการศึกษา ${q.year} ข้อ ${q.number}"></div><p class="onetImageError" data-onet-error="${q.id}" hidden>โหลดภาพไม่สำเร็จ ลองโหลดหน้าใหม่ หรือเปิดข้อสอบต้นฉบับจากลิงก์ด้านล่าง</p><div class="choiceGrid onetChoices" role="group" aria-labelledby="onet-title-${q.id}">${[1,2,3,4].map(n => {
          const selected = saved.answer === n;
          const state = selected ? (saved.checked ? (n === q.key ? 'correct' : 'wrong') : 'sel') : '';
          return `<button class="choice ${state}" data-onet-id="${q.id}" data-onet-answer="${n}" aria-pressed="${selected}"><span class="onetChoiceNumber">${n}</span> เลือกคำตอบ ${n}${selected ? '<span class="onetSelected">✓ เลือกแล้ว</span>' : ''}</button>`;
        }).join('')}</div><p><button class="pixelBtn yellow small" data-onet-check="${q.id}" ${saved.answer ? '' : 'disabled'}>ตรวจคำตอบข้อ ${q.number}</button></p>${saved.checked ? `<div class="qFeedback" role="status">${saved.answer === q.key ? '✅ ถูกต้อง' : '❌ คำตอบที่ถูก: ตัวเลือก '+q.key}<br>${esc(q.note)}</div>` : ''}<p class="onetSource"><a href="${esc(q.source.pdf)}#page=${q.page}" target="_blank" rel="noopener noreferrer">ต้นฉบับ สทศ. • หน้า PDF ${q.page}</a> · <a href="${esc(q.source.landing)}" target="_blank" rel="noopener noreferrer">แหล่งข้อสอบและเฉลย</a></p></div>`;
      }).join('') : '<p>บทนี้ยังไม่มีข้อสอบจริงที่จับคู่หัวข้อไว้ สามารถฝึกชุด Challenge ด้านล่างได้</p>'}</section>`;
    },
    bind({id,getProgress,saveProgress,render}) {
      const allowed = new Map(questions.filter(q => q.lesson === id).map(q => [q.id,q]));
      document.querySelectorAll('[data-onet-zoom]').forEach(button => button.onclick = () => {
        const key = button.dataset.onetZoom;
        if (!allowed.has(key)) return;
        const frame = document.querySelector('#onet-image-'+key);
        const expanded = frame.classList.toggle('expanded');
        button.setAttribute('aria-expanded',String(expanded));
        button.textContent = expanded ? 'ย่อภาพให้พอดีหน้าจอ' : 'ขยายภาพโจทย์';
      });
      document.querySelectorAll('.onetQuestionImage').forEach(img => {
        const showError = () => { img.parentElement.nextElementSibling.hidden = false; };
        img.addEventListener('error',showError);
        if (img.complete && !img.naturalWidth) showError();
      });
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
