(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const missing = value => value === null || value === undefined || value === '';
  const text = value => missing(value) ? 'ไม่มีข้อมูล' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const value = item => esc(text(item));
  const pct = item => missing(item) ? 'ไม่มีข้อมูล' : value(item) + '%';
  const date = item => { if (missing(item)) return 'ไม่มีข้อมูล'; const d = new Date(item); return Number.isNaN(d.getTime()) ? 'ไม่มีข้อมูล' : d.toLocaleString('th-TH', {timeZone:'Asia/Bangkok'}); };
  const points = result => !result ? 'ยังไม่ทำ' : value(result.score) + ' / ' + value(result.total) + ' คะแนน' + (!missing(result.pct) ? ' (' + pct(result.pct) + ')' : '');
  const game = result => !result ? 'ยังไม่ทำ' : result.done === true || result.passed === true ? 'ผ่านแล้ว' : result.done === false || result.passed === false ? 'ทำแล้วแต่ยังไม่ผ่าน' : 'ไม่มีข้อมูล';
  const button = (attr, label) => `<button type="button" class="pixelBtn soft" ${attr}>${label}</button>`;
  function mount(app, context) {
    const api = window.SLH_SHEETS;
    if (!api.enabled() || !context.user.roles?.some(role => role === 'Teacher' || role === 'Admin') || !document.createElement) return;
    const root = app.querySelector('.dashboardPage'); if (!root || root.querySelector('[data-teacher-panel]')) return;
    // Staff use the existing header and theme. Student rendering is untouched.
    root.querySelectorAll('.dashHud,.dashMain,.dashFootnote,.dashNav,.dashExerciseDialog').forEach(el => el.remove());
    const isAdmin = context.user.roles.includes('Admin'), panel = document.createElement('section');
    panel.className = 'panel slhStaff'; panel.dataset.teacherPanel = ''; panel.setAttribute('aria-label', 'Teacher Dashboard');
    panel.innerHTML = `<style>
      .slhStaff{min-width:0;overflow-wrap:anywhere}.slhStaff *{box-sizing:border-box}.slhStaff [hidden]{display:none!important}
      .slhStaff h2,.slhStaff h3,.slhStaff h4{margin-top:0}.slhStaff .staffFlex{display:flex;flex-wrap:wrap;gap:12px;align-items:end}
      .slhStaff label.staffField{display:flex;flex:1 1 140px;min-width:0;flex-direction:column;gap:6px}.slhStaff input:not([type=checkbox]),.slhStaff select{width:100%;min-width:0;max-width:100%}
      .slhStaff .staffGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px}.slhStaff .staffCard{margin:0;min-width:0;padding:16px}
      .slhStaff .staffList{display:grid;gap:10px}.slhStaff .staffRow{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0;padding:12px}.slhStaff .staffIdentity{flex:1 1 180px;min-width:0}
      .slhStaff .staffName{text-align:left;white-space:normal;max-width:100%;cursor:pointer}.slhStaff .staffPager{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:16px 0}
      .slhStaff .staffSection{margin-top:20px}.slhStaff .staffTabs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}.slhStaff .staffTabs [aria-selected=true]{outline:2px solid currentColor;outline-offset:2px}
      .slhStaff dl{margin:8px 0}.slhStaff dt{font-weight:700}.slhStaff dd{margin:0 0 8px;white-space:pre-wrap}.slhStaff details>summary{cursor:pointer}.slhStaff .staffRooms{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:10px}
      .slhStaff fieldset{min-width:0;max-width:100%;margin:12px 0}.slhStaff .pixelBtn{white-space:normal;max-width:100%}
      @media(max-width:480px){.slhStaff .staffCard{padding:12px}.slhStaff .staffFlex>.pixelBtn{width:100%}.slhStaff .staffPager{justify-content:flex-start}}
    </style><h2>หน้าครู${isAdmin ? 'และแอดมิน' : ''}</h2><p data-staff-term role="status">กำลังอ่านข้อมูลเทอมปัจจุบัน…</p>
    ${isAdmin ? `<div class="staffTabs" role="tablist" aria-label="หน้าที่"><button type="button" class="pixelBtn blue" role="tab" aria-selected="true" data-staff-tab="teacher">ผลนักเรียน</button><button type="button" class="pixelBtn soft" role="tab" aria-selected="false" data-staff-tab="admin">จัดการผู้สอน</button></div>` : ''}
    <div data-staff-view="teacher"><form data-teacher-filters class="staffFlex"><label class="staffField">ชั้น<select name="grade" aria-label="ชั้น" disabled></select></label><label class="staffField">ห้อง<select name="room" aria-label="ห้อง" disabled></select></label><label class="staffField">ค้นหานักเรียน<input name="student" placeholder="ชื่อหรือ Username" maxlength="120" autocomplete="off"></label><button type="submit" class="pixelBtn blue" data-roster-search disabled>ค้นหา</button>${button('data-teacher-refresh', 'โหลดห้องใหม่')}</form><p data-teacher-message role="status"></p><div data-teacher-rows class="staffList"></div><div class="staffPager" data-roster-pager hidden>${button('data-teacher-prev', 'ก่อนหน้า')}<span data-teacher-page></span>${button('data-teacher-next', 'ถัดไป')}</div><section data-student-results class="staffSection" hidden></section></div>
    ${isAdmin ? `<div data-staff-view="admin" hidden><h3>ผู้สอนในเทอมปัจจุบัน</h3><p>กำหนดได้หลายห้อง และแต่ละห้องมีผู้สอนได้หลายคน การเปลี่ยนสิทธิ์ไม่ลบผลนักเรียน</p><details class="callout"><summary>เพิ่มบัญชีครู</summary><form data-admin-create class="staffFlex staffSection"><label class="staffField">Username<input name="username" required maxlength="120" autocomplete="off"></label><label class="staffField">ชื่อผู้สอน<input name="name" required maxlength="200" autocomplete="off"></label><label class="staffField">รหัสผ่านเริ่มต้น<input name="password" type="password" required minlength="8" maxlength="200" autocomplete="new-password"></label><button type="submit" class="pixelBtn blue">เพิ่มครู</button></form></details><p data-admin-message role="status"></p>${button('data-admin-refresh', 'โหลดรายชื่อใหม่')}<div data-admin-rows class="staffList staffSection"></div><div class="staffPager" data-admin-pager hidden>${button('data-admin-prev', 'ก่อนหน้า')}<span data-admin-page></span>${button('data-admin-next', 'ถัดไป')}</div><section data-admin-editor class="staffSection" hidden></section></div>` : ''}`;
    (root.querySelector('.dashShell') || root).appendChild(panel);
    const $ = selector => panel.querySelector(selector), form = $('[data-teacher-filters]'), pending = new Map();
    let options = null, rosterOffset = 0, rosterRows = [], rosterKey = '', selected = null, adminOffset = 0, adminRows = [], adminLoaded = false;
    let bootstrap = api.takeTeacherBootstrap?.() || null;
    let optionId = 0, rosterId = 0, resultId = 0, historyId = 0, adminId = 0, editorId = 0, creating = false;
    const alive = () => panel.isConnected;
    // Deduplicate only in-flight requests; a later read always rechecks permissions at the server.
    function call(action, payload = {}) { const key = action + JSON.stringify(payload); if (pending.has(key)) return pending.get(key); const task = Promise.resolve().then(() => api[action](payload)); pending.set(key,task); task.then(() => pending.delete(key), () => pending.delete(key)); return task; }
    function errorAt(target, error, retry, attr) { target.textContent = error?.message || 'อ่านข้อมูลไม่สำเร็จ'; const b = document.createElement('button'); b.type = 'button'; b.className = 'pixelBtn soft'; b.setAttribute(attr,''); b.textContent = 'ลองใหม่'; b.onclick = () => retry(); target.appendChild(document.createTextNode(' ')); target.appendChild(b); }
    function clearStudent() { ++resultId; ++historyId; selected = null; $('[data-student-results]').hidden = true; $('[data-student-results]').textContent = ''; }
    function clearRoster() { ++rosterId; rosterRows = []; rosterKey = ''; $('[data-teacher-rows]').textContent = ''; $('[data-roster-pager]').hidden = true; clearStudent(); }
    function updateRooms(preferred) { const rooms = (options?.rooms || []).filter(r => Number(r.grade) === Number(form.elements.grade.value)); form.elements.room.innerHTML = rooms.map(r => `<option value="${esc(r.room)}">ห้อง ${esc(r.room)}</option>`).join(''); if (rooms.some(r => String(r.room) === String(preferred))) form.elements.room.value = preferred; form.elements.room.disabled = !rooms.length; $('[data-roster-search]').disabled = !rooms.length; }
    async function loadOptions() {
      const ticket = ++optionId, oldGrade = form.elements.grade.value, oldRoom = form.elements.room.value, student = form.elements.student.value.trim();
      clearRoster(); form.elements.grade.disabled = form.elements.room.disabled = $('[data-roster-search]').disabled = true;
      $('[data-teacher-message]').textContent = 'กำลังอ่านห้องที่ได้รับมอบหมาย…';
      try {
        const firstPage = bootstrap; bootstrap = null;
        const data = firstPage || await call('teacherOptions',{includeRoster:true,grade:oldGrade || undefined,room:oldRoom || undefined,student}); if (ticket !== optionId || !alive()) return; options = data;
        $('[data-staff-term]').textContent = 'ปีการศึกษา ' + text(data.academicYear) + ' • มอบหมายห้องสำหรับเทอม ' + text(data.term) + (isAdmin ? ' • แอดมินดูผลได้ทุกห้อง' : ' • เฉพาะห้องที่ได้รับมอบหมาย') + ' • แสดงผลที่บันทึกในปีการศึกษา ' + text(data.academicYear);
        const grades = [...new Set((data.rooms || []).map(r => Number(r.grade)))].sort((a,b) => a-b);
        form.elements.grade.innerHTML = grades.map(g => `<option value="${g}">ม.${g}</option>`).join('');
        const preferredGrade = data.roster?.grade ?? oldGrade, preferredRoom = data.roster?.room ?? oldRoom;
        if (grades.includes(Number(preferredGrade))) form.elements.grade.value = String(preferredGrade);
        form.elements.grade.disabled = !grades.length; updateRooms(preferredRoom); rosterOffset = 0;
        if (!grades.length) { $('[data-teacher-message]').textContent = 'ยังไม่มีห้องที่ได้รับมอบหมายในเทอมนี้ กรุณาติดต่อแอดมิน'; return; }
        const firstRoster = data.roster;
        await loadRoster(firstRoster && student === form.elements.student.value.trim() && Number(firstRoster.grade) === Number(form.elements.grade.value) && String(firstRoster.room) === form.elements.room.value && firstRoster.offset === 0 && firstRoster.limit === 25 ? firstRoster : null);
      } catch (error) { if (ticket === optionId && alive()) { options = null; errorAt($('[data-teacher-message]'),error,loadOptions,'data-options-retry'); } }
    }
    async function loadRoster(firstPage = null) {
      if (!options || !form.elements.grade.value || !form.elements.room.value) return;
      const ticket = ++rosterId, payload = {grade:Number(form.elements.grade.value),room:form.elements.room.value,student:form.elements.student.value.trim(),offset:rosterOffset,limit:25};
      const key = JSON.stringify(payload); clearStudent(); $('[data-teacher-rows]').textContent = ''; $('[data-roster-pager]').hidden = true; $('[data-roster-search]').disabled = true;
      $('[data-teacher-message]').textContent = 'กำลังอ่านรายชื่อนักเรียน…';
      try {
        // New deployments supply the first page with the authorized options/login response.
        // Older Apps Script deployments continue through the original roster API.
        const data = firstPage || await call('teacherRoster',payload); if (ticket !== rosterId || !alive()) return;
        rosterRows = data.rows || []; rosterKey = key;
        $('[data-teacher-rows]').innerHTML = rosterRows.map(r => `<div class="callout staffRow"><span>เลขที่ ${value(r.number)}</span><div class="staffIdentity"><button type="button" class="pixelBtn soft staffName" data-student-open="${esc(r.id || r.studentId || r.username)}">${esc(r.name)}</button><br><small>${esc(r.username || r.id || r.studentId)}</small></div><span>ม.${value(r.grade)}/${value(r.room)}</span></div>`).join('');
        $('[data-teacher-message]').textContent = data.total ? 'นักเรียน ' + data.total + ' คน • เลือกชื่อเพื่อดูผลรายบทเรียน' : 'ไม่พบนักเรียนที่ตรงกับการค้นหา';
        $('[data-teacher-page]').textContent = data.total ? (rosterOffset + 1) + '–' + Math.min(rosterOffset + 25,data.total) + ' / ' + data.total : '0 คน';
        $('[data-roster-pager]').hidden = !data.total; $('[data-teacher-prev]').disabled = rosterOffset === 0; $('[data-teacher-next]').disabled = rosterOffset + 25 >= data.total;
        panel.querySelectorAll('[data-student-open]').forEach(b => b.onclick = () => openStudent(rosterRows.find(r => String(r.id || r.studentId || r.username) === b.dataset.studentOpen)));
      } catch (error) { if (ticket === rosterId && alive()) { rosterKey = ''; errorAt($('[data-teacher-message]'),error,loadRoster,'data-roster-retry'); } }
      finally { if (ticket === rosterId && alive()) $('[data-roster-search]').disabled = false; }
    }
    function openStudent(student) {
      if (!student) return; selected = student; ++resultId; ++historyId;
      const area = $('[data-student-results]'), lessons = Object.values(context.lessons).filter(l => Number(context.meta?.[l.id]?.grade ?? l.id.match(/^G(\d)/)?.[1]) === Number(student.grade));
      area.hidden = false; area.innerHTML = `${button('data-student-close','กลับรายชื่อนักเรียน')}<h3 class="staffSection">${esc(student.name)} <small>(${esc(student.username || student.id || student.studentId)})</small></h3><p>ม.${value(student.grade)}/${value(student.room)} • เลขที่ ${value(student.number)}</p><div class="staffFlex"><label class="staffField">บทเรียน<select name="lessonId" aria-label="บทเรียน">${lessons.map(l => `<option value="${esc(l.id)}">${esc(l.title)}</option>`).join('')}</select></label>${button('data-result-refresh','โหลดผลใหม่')}</div><div data-result-body class="staffSection" role="status"></div><section data-teacher-history class="staffSection" hidden></section>`;
      area.querySelector('[name=lessonId]').onchange = loadResult; $('[data-result-refresh]').onclick = loadResult;
      $('[data-student-close]').onclick = () => { clearStudent(); form.scrollIntoView?.({block:'start'}); };
      area.scrollIntoView?.({block:'start'});
      if (lessons.length) void loadResult(); else $('[data-result-body]').textContent = 'ไม่มีข้อมูลบทเรียนสำหรับชั้นนี้';
    }
    function simulationDetails(simulation, lessonId) {
      if (!simulation) return '<p>ยังไม่ทำ</p>';
      const metrics = Array.isArray(simulation.metrics) ? simulation.metrics.map(m => Array.isArray(m) ? {label:m[0],value:m[1],unit:m[2]} : m && typeof m === 'object' ? m : {label:null,value:m}) : simulation.metrics && typeof simulation.metrics === 'object' ? Object.entries(simulation.metrics).map(([label,value]) => ({label,value})) : [];
      const entries = simulation.values && typeof simulation.values === 'object' ? Object.entries(simulation.values) : [], controls = window.SLH_SIMULATIONS?.[lessonId]?.controls || [];
      return `<p>ทำแล้ว</p><details data-simulation-details><summary>ดูรายละเอียดผลที่บันทึกไว้</summary><p>${value(simulation.summary)}</p><h5>ค่าที่ตั้งในการทดลอง</h5>${entries.length ? '<dl>' + entries.map(([k,v]) => { const control = controls.find(c => c.key === k || c.id === k); return `<dt>${esc(control?.label || k)}</dt><dd>${value(v)}${missing(control?.unit) ? '' : ' ' + value(control.unit)}</dd>`; }).join('') + '</dl>' : '<p>ไม่มีข้อมูล</p>'}<h5>ผลการทดลอง</h5>${metrics.length ? '<dl>' + metrics.map(m => `<dt>${value(m.label ?? m.name)}</dt><dd>${value(m.value)}${missing(m.unit) ? '' : ' ' + value(m.unit)}</dd>`).join('') + '</dl>' : '<p>ไม่มีข้อมูล</p>'}</details>`;
    }
    async function loadResult() {
      if (!selected) return;
      const ticket = ++resultId, student = selected, lessonId = $('[data-student-results] [name=lessonId]').value; ++historyId;
      const body = $('[data-result-body]'); $('[data-teacher-history]').hidden = true; $('[data-teacher-history]').textContent = ''; body.textContent = 'กำลังอ่านผลบทเรียน…'; $('[data-result-refresh]').disabled = true;
      try {
        const data = await call('studentResults',{studentId:student.id || student.studentId || student.username,lessonId}); if (ticket !== resultId || !alive()) return;
        const result = data.result || {}, exam = result.exam, attempts = exam?.attempts, neverExam = attempts === 0;
        body.innerHTML = `<div class="staffGrid"><section class="callout staffCard"><h4>เกม</h4>${[1,2,3].map(i => `<p data-game-result="g${i}">เกม ${i}: <strong>${game(result.games?.['g'+i])}</strong></p>`).join('')}</section><section class="callout staffCard"><h4>แบบฝึกหัด</h4>${[1,2,3].map(i => `<p data-exercise-result="e${i}">แบบฝึก ${i}: <strong>${points(result.exercises?.['e'+i])}</strong></p>`).join('')}<p data-onet-result>O-NET (ผลล่าสุด): <strong>${points(result.onet)}</strong></p></section><section class="callout staffCard" data-simulation-result><h4>Simulation</h4>${simulationDetails(result.simulation,lessonId)}</section><section class="callout staffCard" data-exam-result><h4>สอบท้ายบท</h4><p>คะแนนล่าสุด: <strong data-exam-last>${neverExam ? 'ยังไม่ทำ' : pct(exam?.last)}</strong></p><p>คะแนนสูงสุด: <strong data-exam-best>${neverExam ? 'ยังไม่ทำ' : pct(exam?.best)}</strong></p><p>จำนวนครั้ง: <strong data-exam-count>${value(attempts)}</strong></p><p>สอบล่าสุด: ${neverExam ? 'ยังไม่ทำ' : esc(date(exam?.lastAt))}</p>${button('data-exam-history-open','ดูประวัติสอบทุกครั้ง')}</section></div><p><small>“ยังไม่ทำ” คือไม่มีผลกิจกรรมนั้น ส่วน “ไม่มีข้อมูล” คือรายการที่บันทึกไว้ไม่มีค่านั้น เวลาแสดงตามประเทศไทย</small></p>`;
        $('[data-exam-history-open]').onclick = () => loadHistory(0);
      } catch (error) { if (ticket === resultId && alive()) errorAt(body,error,loadResult,'data-result-retry'); }
      finally { if (ticket === resultId && alive()) $('[data-result-refresh]').disabled = false; }
    }
    async function loadHistory(offset) {
      if (!selected) return; const ticket = ++historyId, area = $('[data-teacher-history]'), lessonId = $('[data-student-results] [name=lessonId]').value;
      area.hidden = false; area.textContent = 'กำลังอ่านประวัติสอบ…';
      try {
        const data = await call('examHistory',{studentId:selected.id || selected.studentId || selected.username,lessonId,offset,limit:10}); if (ticket !== historyId || !alive()) return;
        area.innerHTML = `<h4>ประวัติสอบทุกครั้ง</h4><p>ทั้งหมด ${value(data.total)} ครั้ง • เวลาไทย</p>${(data.rows || []).map(event => `<details class="callout" data-exam-attempt><summary>${esc(date(event.occurredAt))} • ${points(event.result)}</summary>${Array.isArray(event.result?.responses) ? event.result.responses.map((r,i) => `<p><b>${i + 1}. ${value(r.q ?? r.id)}</b><br>ตอบ: ${value(r.selected)} • ${r.ok === true ? 'ถูก' : r.ok === false ? 'ผิด' : 'ไม่มีข้อมูล'}<br>คำตอบที่ถูก: ${value(r.correct)}<br>${value(r.why)}</p>`).join('') : '<p>ไม่มีข้อมูลคำตอบรายข้อ</p>'}</details>`).join('') || '<p>ยังไม่ทำข้อสอบบทนี้</p>'}<div class="staffPager">${button('data-history-prev','ก่อนหน้า')}<span>${data.total ? (offset+1) + '–' + Math.min(offset+10,data.total) + ' / ' + data.total : '0 ครั้ง'}</span>${button('data-history-next','ถัดไป')}${button('data-history-close','ปิดประวัติ')}</div>`;
        $('[data-history-prev]').disabled = offset === 0; $('[data-history-next]').disabled = offset + 10 >= data.total;
        $('[data-history-prev]').onclick = () => loadHistory(Math.max(0,offset-10)); $('[data-history-next]').onclick = () => loadHistory(offset+10);
        $('[data-history-close]').onclick = () => { ++historyId; area.hidden = true; area.textContent = ''; };
      } catch (error) { if (ticket === historyId && alive()) errorAt(area,error,() => loadHistory(offset),'data-history-retry'); }
    }
    async function loadAdmin() {
      if (!isAdmin) return; const ticket = ++adminId; ++editorId; $('[data-admin-editor]').hidden = true; $('[data-admin-editor]').textContent = ''; $('[data-admin-rows]').textContent = ''; $('[data-admin-pager]').hidden = true; $('[data-admin-message]').textContent = 'กำลังอ่านรายชื่อผู้สอน…';
      try {
        const data = await call('adminTeachers',{offset:adminOffset,limit:25}); if (ticket !== adminId || !alive()) return; adminLoaded = true; adminRows = data.rows || [];
        $('[data-admin-rows]').innerHTML = adminRows.map(t => `<div class="callout staffRow"><div class="staffIdentity"><strong>${esc(t.name)}</strong> <small>(${esc(t.id)})</small><br>${t.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} • ${esc((t.roles || []).join(' + '))}<br><small>${t.roles?.includes('Admin') ? 'เข้าดูผลได้ทุกห้อง' : (t.assignments || []).map(r => 'ม.' + esc(r.grade) + '/' + esc(r.room)).join(', ') || 'ยังไม่ได้รับมอบหมายห้อง'}</small></div><button type="button" class="pixelBtn soft" data-teacher-edit="${esc(t.id)}">จัดการ</button></div>`).join('');
        $('[data-admin-message]').textContent = 'ผู้สอน ' + text(data.total) + ' คน'; $('[data-admin-page]').textContent = data.total ? (adminOffset+1) + '–' + Math.min(adminOffset+25,data.total) + ' / ' + data.total : '0 คน';
        $('[data-admin-pager]').hidden = !data.total; $('[data-admin-prev]').disabled = adminOffset === 0; $('[data-admin-next]').disabled = adminOffset+25 >= data.total;
        panel.querySelectorAll('[data-teacher-edit]').forEach(b => b.onclick = () => openEditor(adminRows.find(t => t.id === b.dataset.teacherEdit)));
      } catch (error) { if (ticket === adminId && alive()) { adminLoaded = false; errorAt($('[data-admin-message]'),error,loadAdmin,'data-admin-retry'); } }
    }
    function openEditor(teacher) {
      if (!teacher) return; const ticket = ++editorId, area = $('[data-admin-editor]'); area.hidden = false;
      if (!options) { errorAt(area,Error('ยังอ่านรายชื่อห้องไม่สำเร็จ'),async () => { await loadOptions(); if (ticket === editorId && alive()) openEditor(teacher); },'data-editor-retry'); return; }
      const assigned = new Set((teacher.assignments || []).map(r => r.grade + ':' + r.room));
      area.innerHTML = `<h4>จัดการ ${esc(teacher.name)} (${esc(teacher.id)})</h4><form data-admin-edit-form><label><input type="checkbox" name="enabled" ${teacher.enabled ? 'checked' : ''} ${teacher.protected ? 'disabled' : ''}> เปิดใช้งานบัญชี</label>${teacher.protected ? '<p>บัญชีหลักคงสิทธิ์ Teacher + Admin และเปิดใช้งานเสมอ</p>' : ''}<fieldset><legend>ห้องที่ดูแล • เทอม ${value(options.term)} ปี ${value(options.academicYear)}</legend><div class="staffRooms">${(options.rooms || []).map(r => `<label><input type="checkbox" name="room" value="${esc(r.grade + ':' + r.room)}" ${assigned.has(r.grade + ':' + r.room) ? 'checked' : ''}> ม.${esc(r.grade)}/${esc(r.room)}</label>`).join('') || '<p>ไม่มีข้อมูลห้อง</p>'}</div></fieldset>${teacher.roles?.includes('Admin') ? '<p>สิทธิ์ Admin อ่านผลได้ทุกห้อง แม้ไม่ได้เลือกห้องไว้</p>' : ''}<button type="submit" class="pixelBtn blue" data-admin-save>บันทึกสิทธิ์</button> ${button('data-admin-cancel','ปิด')}<p data-admin-edit-message role="status"></p></form>`;
      const editForm = area.querySelector('form'); let saving = false;
      area.scrollIntoView?.({block:'start'});
      $('[data-admin-cancel]').onclick = () => { ++editorId; area.hidden = true; area.textContent = ''; };
      editForm.onsubmit = async e => {
        e.preventDefault(); if (saving) return; saving = true; const saveButton = $('[data-admin-save]'), message = $('[data-admin-edit-message]'); saveButton.disabled = true; message.textContent = 'กำลังบันทึกสิทธิ์…';
        const rooms = [...editForm.querySelectorAll('[name=room]:checked')].map(el => { const split = el.value.indexOf(':'); return {grade:Number(el.value.slice(0,split)),room:el.value.slice(split+1)}; });
        const payload = {teacherId:teacher.id,term:options.term,enabled:editForm.elements.enabled.checked,rooms};
        try { const data = await api.adminUpdateTeacher(payload); if (ticket !== editorId || !alive()) return; await loadAdmin(); if (alive()) { if (data.teacher) openEditor(data.teacher); $('[data-admin-message]').textContent = 'บันทึกสิทธิ์แล้ว การเรียกข้อมูลครั้งถัดไปใช้สิทธิ์ล่าสุด'; } }
        catch (error) { if (ticket === editorId && alive()) errorAt(message,error,() => editForm.requestSubmit(),'data-admin-save-retry'); }
        finally { saving = false; if (ticket === editorId && alive()) saveButton.disabled = false; }
      };
    }
    form.elements.grade.onchange = () => { clearRoster(); updateRooms(); rosterOffset = 0; void loadRoster(); };
    form.elements.room.onchange = () => { clearRoster(); rosterOffset = 0; void loadRoster(); };
    form.onsubmit = e => { e.preventDefault(); rosterOffset = 0; const payload = {grade:Number(form.elements.grade.value),room:form.elements.room.value,student:form.elements.student.value.trim(),offset:0,limit:25}; if (JSON.stringify(payload) !== rosterKey) void loadRoster(); };
    $('[data-teacher-refresh]').onclick = loadOptions;
    $('[data-teacher-prev]').onclick = () => { rosterOffset = Math.max(0,rosterOffset-25); void loadRoster(); }; $('[data-teacher-next]').onclick = () => { rosterOffset += 25; void loadRoster(); };
    if (isAdmin) {
      panel.querySelectorAll('[data-staff-tab]').forEach(b => b.onclick = () => { panel.querySelectorAll('[data-staff-tab]').forEach(tab => tab.setAttribute('aria-selected',String(tab === b))); panel.querySelectorAll('[data-staff-view]').forEach(view => { view.hidden = view.dataset.staffView !== b.dataset.staffTab; }); if (b.dataset.staffTab === 'admin' && !adminLoaded) void loadAdmin(); });
      $('[data-admin-refresh]').onclick = loadAdmin; $('[data-admin-prev]').onclick = () => { adminOffset = Math.max(0,adminOffset-25); void loadAdmin(); }; $('[data-admin-next]').onclick = () => { adminOffset += 25; void loadAdmin(); };
      const createForm = $('[data-admin-create]');
      createForm.onsubmit = async e => {
        e.preventDefault(); if (creating) return; creating = true; const submit = createForm.querySelector('[type=submit]'); submit.disabled = true;
        const payload = {username:createForm.elements.username.value.trim(),name:createForm.elements.name.value.trim(),password:createForm.elements.password.value}; createForm.elements.password.value = '';
        $('[data-admin-message]').textContent = 'กำลังเพิ่มบัญชีครู…';
        try { const data = await api.adminCreateTeacher(payload); if (!alive()) return; createForm.reset(); adminOffset = 0; await loadAdmin(); if (alive()) { $('[data-admin-message]').textContent = 'เพิ่มบัญชีครูแล้ว เลือกห้องที่ดูแลและบันทึกสิทธิ์'; if (data.teacher) openEditor(data.teacher); } }
        catch (error) { if (alive()) errorAt($('[data-admin-message]'),error,() => { createForm.closest('details').open = true; createForm.elements.password.focus(); },'data-admin-create-retry'); }
        finally { payload.password = ''; creating = false; if (alive()) submit.disabled = false; }
      };
    }
    void loadOptions();
  }
  window.SLH_TEACHER = {mount};
})();
