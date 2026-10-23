(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('th-TH', {timeZone:'Asia/Bangkok'}); };
  const score = value => value == null ? '—' : esc(value) + '%';
  const activity = result => !result ? '—' : result.pct != null ? score(result.pct) : result.passed || result.done ? 'ผ่านแล้ว' : result.correct === true ? 'ตอบถูก' : 'ทำแล้ว';
  function mount(app, context) {
    if (!window.SLH_SHEETS.enabled() || !context.user.roles?.some(role => role === 'Teacher' || role === 'Admin') || !document.createElement) return;
    const root = app.querySelector('.dashboardPage'); if (!root) return;
    const panel = document.createElement('section'); panel.className = 'panel'; panel.setAttribute('aria-label', 'Teacher Dashboard');
    panel.innerHTML = `<h2>Teacher Dashboard • ปีการศึกษา 2569</h2><form data-teacher-filters style="display:flex;flex-wrap:wrap;gap:12px;align-items:end"><label style="display:flex;flex-direction:column;min-width:0;max-width:100%;flex:1 1 140px">ชั้น <select style="width:100%;min-width:0;max-width:100%" name="grade"><option value="">ทุกชั้น</option>${[1,2,3].map(g => `<option value="${g}">ม.${g}</option>`).join('')}</select></label> <label style="display:flex;flex-direction:column;min-width:0;max-width:100%;flex:1 1 140px">ห้อง <input style="width:100%;min-width:0;max-width:100%;box-sizing:border-box" name="room" inputmode="numeric" size="5" placeholder="ทุกห้อง"></label> <label style="display:flex;flex-direction:column;min-width:0;max-width:100%;flex:1 1 140px">บทเรียน <select style="width:100%;min-width:0;max-width:100%" name="lessonId"><option value="">ทุกบทเรียน</option>${Object.values(context.lessons).map(l => `<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('')}</select></label> <label style="display:flex;flex-direction:column;min-width:0;max-width:100%;flex:1 1 140px">นักเรียน <input style="width:100%;min-width:0;max-width:100%;box-sizing:border-box" name="student" placeholder="ชื่อหรือรหัสผู้ใช้"></label> <button class="pixelBtn blue" type="submit">ค้นหา</button></form><p data-teacher-message role="status"></p><div data-teacher-rows style="overflow:auto"></div><div class="contentNav"><button type="button" class="pixelBtn soft" data-teacher-prev>ก่อนหน้า</button><span data-teacher-page></span><button type="button" class="pixelBtn soft" data-teacher-next>ถัดไป</button></div><section data-teacher-history hidden></section>`;
    root.appendChild(panel);
    const form = panel.querySelector('form'), message = panel.querySelector('[data-teacher-message]'), rows = panel.querySelector('[data-teacher-rows]'), history = panel.querySelector('[data-teacher-history]');
    const prev = panel.querySelector('[data-teacher-prev]'), next = panel.querySelector('[data-teacher-next]');
    let offset = 0, total = 0, requestId = 0, historyId = 0, currentRows = [];
    const limit = 25, filters = () => ({grade:form.elements.grade.value,room:form.elements.room.value.trim(),lessonId:form.elements.lessonId.value,student:form.elements.student.value.trim(),offset,limit});
    async function load() {
      const ticket = ++requestId; ++historyId; history.hidden = true; message.textContent = 'กำลังอ่านผลกิจกรรม…'; prev.disabled = next.disabled = true;
      try {
        const data = await window.SLH_SHEETS.teacherSummary(filters());
        if (ticket !== requestId || !panel.isConnected) return;
        currentRows = data.rows || []; total = Number(data.total) || 0;
        rows.innerHTML = `<table><thead><tr><th>นักเรียน</th><th>ชั้น/ห้อง</th><th>บทเรียน</th><th>เกม 1 / 2 / 3</th><th>แบบฝึก 1 / 2 / 3</th><th>Simulation</th><th>สอบล่าสุด</th><th>สอบสูงสุด</th><th>ครั้ง</th><th>ประวัติ</th></tr></thead><tbody>${currentRows.map((r,i) => `<tr><td>${esc(r.name)}<br><small>${esc(r.username || r.studentId)}</small></td><td>ม.${esc(r.grade)}/${esc(r.room)} เลขที่ ${esc(r.number)}</td><td>${esc(context.lessons[r.lessonId]?.title || r.lessonId)}</td><td>${['g1','g2','g3'].map(k => activity(r.games?.[k])).join(' / ')}</td><td>${['e1','e2','e3'].map(k => activity(r.exercises?.[k])).join(' / ')}${r.onet ? '<br><small>O-NET จริง: ' + activity(r.onet) + '</small>' : ''}</td><td>${r.simulation ? 'ทดลองแล้ว' : '—'}${r.simulation?.summary ? '<br><small>' + esc(r.simulation.summary) + '</small>' : ''}${Array.isArray(r.simulation?.metrics) ? r.simulation.metrics.map(m => '<br><small>' + esc(m[0]) + ': ' + esc(m[1]) + '</small>').join('') : ''}</td><td>${score(r.exam?.last)}</td><td>${score(r.exam?.best)}</td><td>${esc(r.exam?.attempts || 0)}</td><td><button type="button" class="pixelBtn soft small" data-exam-history="${i}">เปิดประวัติสอบ</button></td></tr>`).join('')}</tbody></table>`;
        message.textContent = total ? 'พบ ' + total + ' รายการ • ผลกิจกรรมคำนวณจากเว็บไซต์ผู้เรียน' : 'ยังไม่มีผลกิจกรรมที่ตรงกับตัวกรอง';
        panel.querySelector('[data-teacher-page]').textContent = total ? (offset + 1) + '–' + Math.min(offset + limit, total) + ' / ' + total : '0 รายการ';
        prev.disabled = offset === 0; next.disabled = offset + limit >= total;
        rows.querySelectorAll('[data-exam-history]').forEach(b => b.onclick = () => showHistory(currentRows[Number(b.dataset.examHistory)], 0));
      } catch (error) { if (ticket === requestId && panel.isConnected) { rows.textContent = ''; message.textContent = error.message; } }
    }
    async function showHistory(student, start) {
      const ticket = ++historyId; history.hidden = false; history.textContent = 'กำลังอ่านประวัติสอบ…';
      try {
        const data = await window.SLH_SHEETS.examHistory({studentId:student.studentId,lessonId:student.lessonId,offset:start,limit:10});
        if (ticket !== historyId || !panel.isConnected) return;
        history.innerHTML = `<h3>ประวัติสอบ: ${esc(student.name)} • ${esc(context.lessons[student.lessonId]?.title || student.lessonId)}</h3><p>คะแนนล่าสุด ${score(student.exam?.last)} • คะแนนสูงสุด ${score(student.exam?.best)} • ทั้งหมด ${esc(data.total)} ครั้ง</p>${(data.rows || []).map(event => `<details class="callout"><summary>${esc(date(event.occurredAt))} • ${score(event.result?.pct)} (${esc(event.result?.score)}/${esc(event.result?.total || 20)})</summary>${(event.result?.responses || []).map((r,i) => `<p><b>${i + 1}. ${esc(r.q || r.id)}</b><br>ตอบ: ${esc(r.selected)} • ${r.ok ? 'ถูก' : 'ผิด'}<br>คำตอบที่ถูก: ${esc(r.correct)}<br>${esc(r.why)}</p>`).join('')}</details>`).join('')}<div class="contentNav"><button type="button" class="pixelBtn soft" data-history-prev ${start === 0 ? 'disabled' : ''}>ก่อนหน้า</button><button type="button" class="pixelBtn soft" data-history-next ${start + 10 >= data.total ? 'disabled' : ''}>ถัดไป</button><button type="button" class="pixelBtn soft" data-history-close>ปิดประวัติ</button></div>`;
        history.querySelector('[data-history-prev]').onclick = () => showHistory(student, Math.max(0,start - 10));
        history.querySelector('[data-history-next]').onclick = () => showHistory(student, start + 10);
        history.querySelector('[data-history-close]').onclick = () => { ++historyId; history.hidden = true; };
      } catch (error) { if (ticket === historyId && panel.isConnected) history.textContent = error.message; }
    }
    form.onsubmit = e => { e.preventDefault(); offset = 0; void load(); };
    prev.onclick = () => { offset = Math.max(0,offset - limit); void load(); };
    next.onclick = () => { offset += limit; void load(); };
    void load();
  }
  window.SLH_TEACHER = {mount};
})();
