(() => {
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
  const hasKeyword = (text, word) => {
    // Allele case is meaningful; a number must not match inside a different value.
    if (word === 'aa') return /(^|[^A-Za-z])aa(?![A-Za-z])/.test(String(text));
    if (/^\d+(?:\.\d+)?$/.test(word)) return new RegExp('(?<![\\d.])' + word.replace('.', '\\.') + '(?![\\d.])').test(normalize(text));
    return normalize(text).includes(normalize(word));
  };

  window.scienceLabTextReport = function (lab, text) {
    const normalized = normalize(text);
    const groups = lab.keywords.map(words => ({ words, found: words.some(word => hasKeyword(text, word)) }));
    let explanation = normalized;
    for (const word of lab.keywords.flat().sort((a, b) => b.length - a.length)) explanation = explanation.split(normalize(word)).join('');
    const hasExplanation = normalized.trim().length >= 40 && explanation.replace(/[^\p{L}\p{N}]/gu, '').length >= 12;
    return { groups, hasExplanation, ready: hasExplanation && groups.every(group => group.found) };
  };

  window.renderScienceLab = function ({ lesson, sections, lab, progress, escapeHTML: esc }) {
    const choice = (field, title, note, options, selected) => `<fieldset class="labChoiceGroup"><legend>${esc(title)}</legend><p class="labSubtle">${esc(note)}</p><div class="labChoices">${options.map((text, index) => `<button type="button" class="labChoice ${selected === text ? 'isSelected' : ''}" data-lab-${field}="${esc(text)}" aria-pressed="${selected === text}"><span class="labChoiceLetter" aria-hidden="true">${index + 1}</span><span>${esc(text)}</span><span class="labChoiceMark" aria-hidden="true">${selected === text ? '✓' : ''}</span></button>`).join('')}</div></fieldset>`;
    const related = sections.filter(section => lab.focus.includes(section.title));
    return `<section class="labStudio" aria-labelledby="lab-title">
      <header class="labHero"><div><span class="labEyebrow">SCIENCE LAB · ห้องฝึกคิดวิทยาศาสตร์</span><h1 id="lab-title">${esc(lab.title)}</h1><p>${esc(lesson.title)}</p></div><span class="labHeroIcon" aria-hidden="true">🧪</span></header>
      <ol class="labJourney" aria-label="ลำดับกิจกรรม"><li><span>1</span> อ่านข้อมูล</li><li><span>2</span> เลือกหลักฐานและเหตุผล</li><li><span>3</span> เขียนข้อสรุป</li></ol>
      <div class="labWorkspace"><div class="labMain">
        <section class="labSheet"><div class="labSectionLabel">01 / สำรวจข้อมูล</div><h2>โจทย์ของนักสำรวจ</h2><p class="labTask">${esc(lab.task)}</p>
          <div class="labDataLabel">ข้อมูลตัวอย่างสำหรับฝึกวิเคราะห์</div><p class="labSubtle">ตารางนี้เป็นข้อมูลหรือแบบจำลองที่จัดทำเพื่อการเรียนรู้ ใช้ข้อมูลในตารางประกอบคำตอบ</p>
          <div class="labTableWrap" tabindex="0" role="region" aria-label="ตารางข้อมูลกิจกรรม เลื่อนในแนวนอนได้"><table class="labDataTable"><caption>ข้อมูลประกอบ: ${esc(lab.title)}</caption><thead><tr>${lab.headers.map(header => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead><tbody>${lab.rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <h3>ลองคิดตามทีละขั้น</h3><ol class="labSteps">${lab.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
        </section>
        <section class="labSheet"><div class="labSectionLabel">02 / เชื่อมหลักฐานกับความรู้</div><h2>เลือกสิ่งที่รองรับข้อสรุป</h2>
          ${choice('evidence', 'ก. หลักฐานใดตอบโจทย์นี้ได้ตรงที่สุด?', 'เลือกข้อมูลที่เกี่ยวข้องกับสิ่งที่ต้องการศึกษา', progress.lab.evidenceOptions, progress.lab.evidence)}
          ${choice('variable', 'ข. หลักการหรือเงื่อนไขใดถูกต้อง?', 'ใช้แนวคิดจากบทเรียนอธิบายข้อมูล ไม่ตัดสินจากคำสำคัญเพียงคำเดียว', progress.lab.variableOptions, progress.lab.variable)}
        </section>
      </div><aside class="labReference" aria-label="ความรู้ที่ใช้ในกิจกรรม"><div class="labReferenceInner"><span class="labSectionLabel">เปิดสมุดความรู้</span><h2>เชื่อมกับบทเรียน</h2>${related.map(section => `<details class="labRecall"><summary>${esc(section.title)}</summary><p>${esc(section.body)}</p>${section.formula ? `<p class="labRecallFormula">${esc(section.formula)}</p>` : ''}</details>`).join('')}<p class="labReferenceTip">อ่านตาราง → หาแนวโน้ม → อธิบายด้วยความรู้ด้านบน</p><button type="button" class="labTextButton" data-lab-review>กลับไปอ่านเนื้อหา →</button></div></aside></div>
      <section class="labSheet labWriting" aria-labelledby="lab-writing-title"><div class="labSectionLabel">03 / สรุปด้วยคำของเรา</div><h2 id="lab-writing-title">ข้อมูลนี้บอกอะไร และเพราะอะไร?</h2>
        <div class="labWritingGrid"><div><label class="labAnswerLabel" for="labText">ข้อสรุปของฉัน</label><p class="labSubtle" id="labAnswerHelp">อ้างผลจากตาราง แล้วเชื่อมกับหลักการในบทเรียน เขียนอย่างน้อย 40 ตัวอักษรและให้มีคำอธิบายมากกว่ารายการคำสำคัญ</p><div class="labInlineGuide"><b>คำสำคัญช่วยเขียน</b><p>ใช้คำในแต่ละกลุ่มเชื่อมเป็นข้อสรุป ✓ หมายถึงพบคำแล้ว ให้ตรวจความหมายกับข้อมูลอีกครั้ง</p><div class="labKeywords">${lab.keywords.map((words, index) => `<span class="labKeyword" data-lab-keyword="${index}"><span data-lab-keyword-mark aria-hidden="true">○</span> ${esc(words.join(' / '))}</span>`).join('')}</div><p id="labKeywordStatus" class="labKeywordStatus" role="status" aria-live="polite"></p></div><textarea class="labAnswer" id="labText" aria-describedby="labAnswerHelp labKeywordStatus" placeholder="จากข้อมูลพบว่า… หลักฐานคือ… อธิบายได้ว่า… ดังนั้น…">${esc(progress.lab.text || '')}</textarea><div class="labWritingMeta"><span id="labDraftStatus">บันทึกคำตอบระหว่างพิมพ์</span><span id="labCharCount">${(progress.lab.text || '').trim().length} ตัวอักษร</span></div></div>
        <aside class="labCoach"><h3>แนวทางเขียนข้อสรุป</h3><p>อ้างสิ่งที่พบจากตาราง แล้วอธิบายว่าเกี่ยวข้องกับความรู้ในบทเรียนอย่างไร</p><div class="labSentenceGuide"><b>โครงช่วยเขียน</b><ol><li>พบอะไรจากตาราง?</li><li>ค่าใดหรือเหตุการณ์ใดเป็นหลักฐาน?</li><li>อธิบายด้วยคำสำคัญข้างบนอย่างไร?</li></ol></div><details class="labModel"><summary>ดูแนวทางสรุปของเรื่องนี้</summary><p>${esc(lab.model)}</p><small>ใช้เป็นแนวทาง แล้วเรียบเรียงด้วยคำของตนเอง</small></details></aside></div>
        <div id="labFeedback" class="labFeedback" role="status" aria-live="polite">เลือกคำตอบทั้งสองข้อและเขียนข้อสรุป แล้วกดตรวจคำตอบ</div><div class="labActions"><button type="button" class="pixelBtn soft" data-lab-back>← กลับเนื้อหา</button><button type="button" class="pixelBtn green" data-lab-check>ตรวจคำตอบและไปเกม 1 →</button></div>
      </section>
    </section>`;
  };

  window.bindScienceLab = function ({ lab, getProgress, saveProgress, onBack, onComplete }) {
    const query = selector => document.querySelector(selector);
    const updateGuide = () => {
      const text = query('#labText').value;
      const report = window.scienceLabTextReport(lab, text);
      report.groups.forEach((group, index) => {
        const chip = query(`[data-lab-keyword="${index}"]`);
        chip.classList.toggle('isFound', group.found);
        chip.querySelector('[data-lab-keyword-mark]').textContent = group.found ? '✓' : '○';
      });
      const count = report.groups.filter(group => group.found).length;
      const message = `พบคำสำคัญ ${count}/${report.groups.length} กลุ่ม${report.hasExplanation ? ' · มีข้อความอธิบายแล้ว' : ' · เพิ่มประโยคอธิบายหลักฐานและเหตุผล'}`;
      if (query('#labKeywordStatus').textContent !== message) query('#labKeywordStatus').textContent = message;
      query('#labCharCount').textContent = `${text.trim().length} ตัวอักษร`;
    };
    query('#labText').addEventListener('input', () => {
      const p = getProgress(); p.lab.text = query('#labText').value; saveProgress(p);
      query('#labDraftStatus').textContent = 'บันทึกคำตอบแล้ว';
      query('#labFeedback').className = 'labFeedback';
      query('#labFeedback').textContent = 'แก้คำตอบแล้ว กดตรวจคำตอบอีกครั้งเมื่อพร้อม';
      updateGuide();
    });
    for (const [field, dataset] of [['evidence', 'labEvidence'], ['variable', 'labVariable']]) {
      const buttons = [...document.querySelectorAll(`[data-lab-${field}]`)];
      buttons.forEach(button => button.addEventListener('click', () => {
        const p = getProgress(); p.lab.text = query('#labText').value; p.lab[field] = button.dataset[dataset]; saveProgress(p);
        buttons.forEach(option => {
          const selected = option === button;
          option.classList.toggle('isSelected', selected); option.setAttribute('aria-pressed', String(selected));
          option.querySelector('.labChoiceMark').textContent = selected ? '✓' : '';
        });
        query('#labFeedback').className = 'labFeedback';
        query('#labFeedback').textContent = 'บันทึกตัวเลือกแล้ว เขียนข้อสรุปและกดตรวจเมื่อพร้อม';
      }));
    }
    ['[data-lab-back]', '[data-lab-review]'].forEach(selector => query(selector).addEventListener('click', () => {
      const p = getProgress(); p.lab.text = query('#labText').value; saveProgress(p); onBack();
    }));
    query('[data-lab-check]').addEventListener('click', () => {
      const p = getProgress(); p.lab.text = query('#labText').value.trim();
      const report = window.scienceLabTextReport(lab, p.lab.text), issues = [];
      if (p.lab.evidence !== lab.evidence) issues.push('หลักฐาน: ทบทวนว่าข้อมูลใดในตารางตอบโจทย์นี้โดยตรง');
      if (p.lab.variable !== lab.variable) issues.push('หลักการ: อ่านความรู้ประกอบ แล้วเลือกเหตุผลที่สอดคล้องกับตาราง');
      const missing = report.groups.filter(group => !group.found).map(group => group.words[0]);
      if (missing.length) issues.push('เพิ่มแนวคิดในข้อสรุป: ' + missing.join(' • '));
      if (!report.hasExplanation) issues.push('เขียนประโยคอธิบายหลักฐานและเหตุผลอย่างน้อย 40 ตัวอักษร ไม่เขียนเพียงรายการคำสำคัญ');
      saveProgress(p);
      const feedback = query('#labFeedback');
      if (issues.length) {
        feedback.className = 'labFeedback bad'; feedback.textContent = 'ลองทบทวนอีกนิด\n' + issues.join('\n');
        feedback.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      } else {
        p.lab.done = true; p.lab.version = lab.version; p.resume = 'g1'; p.xp = Math.max(p.xp, 20); saveProgress(p);
        onComplete();
      }
    });
    updateGuide();
  };
})();
