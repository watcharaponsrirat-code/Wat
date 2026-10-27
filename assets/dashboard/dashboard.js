/* Dashboard presentation only. Progress is read through the existing application API. */
(() => {
  'use strict';
  const art = 'assets/dashboard/';
  let prepared = false;
  const preparedImages = [];
  function prepare() {
    if (prepared || typeof Image !== 'function' || window.navigator?.connection?.saveData) return;
    prepared = true;
    // Public artwork only. Start alongside login, never wait for it or retain account data.
    for (const name of ['wood-sign','student-welcome','flask','books','notebook','gamepad']) {
      try {
        const image = new Image(); image.decoding = 'async'; image.fetchPriority = 'low';
        image.src = art + name + '-v1.webp'; preparedImages.push(image);
        image.decode?.().catch(() => {});
      } catch { /* A failed artwork warmup must not interrupt login. */ }
    }
  }
  const shapes = {
    home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
    lessons: '<path d="M12 5C8 2 4 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-2-1-6-2-10 1Zm0 0v16"/>',
    results: '<path d="M4 21V12h4v9m2 0V7h4v14m2 0V3h4v18"/>',
    mission: '<rect x="5" y="4" width="15" height="18" rx="2"/><path d="M9 4V2h7v4H9m0 6 2 2 5-5m-7 9h7"/>',
    about: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    logout: '<path d="M10 3H4v18h6m-1-9h13m-5-5 5 5-5 5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-9m-3 0h4v4"/>'
  };
  const icon = (name, cls = '') => `<svg class="dashIcon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name] || shapes.arrow}</svg>`;
  const started = p => p.contentIndex > 0 || p.contentDone || (p.resume && p.resume !== 'content') ||
    Object.values(p.visited || {}).some(Boolean) || p.xp > 0 || p.exam.attempts > 0 || !!p.exam.current ||
    Object.values(p.games).some(g => g.done || g.attempts > 0 || !!g.state) ||
    Object.values(p.ex).some(e => e.done || !!e.state);
  function model(ctx) {
    const records = Object.values(ctx.lessons).map(lesson => ({lesson, meta:ctx.meta[lesson.id], p:ctx.getProgress(lesson.id)}));
    const grade = ctx.user.grade || ctx.grade;
    const unfinished = records.filter(r => !r.p.exam.passed);
    const focus = unfinished.find(r => r.meta.grade === grade && started(r.p)) ||
      unfinished.find(r => started(r.p)) || unfinished.find(r => r.meta.grade === grade) ||
      unfinished[0] || records.find(r => r.meta.grade === grade) || records[0];
    const progress = ctx.stats.total ? Math.round(ctx.stats.done / ctx.stats.total * 100) : 0;
    return {records, focus, progress};
  }
  function header() {
    return `<div class="dashEnvironment" aria-hidden="true"><img class="dashCloud" src="assets/login/cloud.svg" alt="" width="240" height="140"><i class="dashSunlight"></i></div>
      <div class="dashShell">
        <header class="dashHeader">
          <div class="dashSchoolSign"><img src="assets/branding/33852269be64c916.png" width="600" height="956" alt="ตราโรงเรียนห้องสอนศึกษา"><p>โรงเรียนห้องสอนศึกษา<span>ในพระอุปถัมภ์ฯ</span></p></div>
          <div class="dashBrandSign"><img src="assets/login/flask.svg" width="80" height="100" alt="" aria-hidden="true"><div><b>SCIENCE</b><span>LEARNING HUB</span></div></div>
          <button type="button" class="dashLogout" data-action="logout">${icon('logout')}<span>ออกจากระบบ</span></button>
        </header>`;
  }
  function render(ctx) {
    if (ctx.staffView) return `<main class="dashboardPage">${header()}</div></main>`;
    const {focus, progress} = model(ctx), e = ctx.escape, p = focus.p, id = focus.lesson.id;
    const exerciseCount = ['e1','e2','e3'].filter(s => p.ex[s].done).length;
    const gameCount = ['g1','g2','g3'].filter(s => p.games[s].done).length;
    const explored = !!p.simulation?.[id]?.explored;
    const tasks = [
      ['อ่านเนื้อหาบทเรียน', p.contentDone, p.contentDone ? 'อ่านจบแล้ว' : 'ยังอ่านไม่จบ'],
      ['ทำแบบฝึกหัด', exerciseCount === 3, `${exerciseCount}/3 ชุดสำเร็จ`],
      ['สำรวจ Simulation', explored, explored ? 'ทดลองแล้ว' : 'ยังไม่ได้สำรวจ'],
      ['เล่นเกมวิทยาศาสตร์', gameCount === 3, `${gameCount}/3 เกมสำเร็จ`]
    ];
    const action = p.exam.passed ? 'ทบทวน' : started(p) ? 'เรียนต่อ' : 'เริ่มเรียน';
    const stage = ctx.stageNames[p.resume] || ctx.stageNames.content;
    const image = (name, cls = '', lazy = false) => `<img class="${cls}" src="${art}${name}-v1.webp" width="384" height="384" alt="" aria-hidden="true" decoding="async"${lazy ? ' loading="lazy"' : ''}>`;
    const menu = (color, name, title, subtitle, hook) => `<button type="button" class="dashMenu quick dashMenu${color}" ${hook}>${image(name, '', true)}<span class="dashMenuCopy"><b>${title}</b><span>${subtitle}</span></span>${icon('arrow','dashMenuArrow')}</button>`;
    return `<main class="dashboardPage">
      ${header()}
        <section class="dashHud" aria-label="ข้อมูลผู้เรียน">
          <div class="dashIdentity"><div class="dashAvatar"><img src="${art}student-welcome-v1.webp" width="800" height="665" alt="ภาพตัวแทนนักเรียน Voxel"></div><div><strong data-dashboard-name>${e(ctx.user.name || ctx.user.id)}</strong><span data-dashboard-grade>${ctx.user.teacher ? 'ครูผู้สอน' : 'นักเรียนชั้น ม.' + e(String(ctx.user.grade))}</span></div></div>
          <div class="dashStat">${icon('results')}<div><span>ความก้าวหน้า</span><strong data-dashboard-progress>${progress}%</strong><div class="dashTrack" aria-hidden="true"><span style="width:${progress}%"></span></div></div></div>
          <div class="dashStat">${icon('lessons')}<div><span>บทเรียนที่ผ่าน</span><strong data-dashboard-completed>${ctx.stats.done}<small>/${ctx.stats.total}</small></strong></div></div>
        </section>
        <div class="dashMain">
          <section class="dashWelcome heroWorld" aria-labelledby="dashWelcomeHeading">
            <div class="dashCharacter" aria-hidden="true"><img class="dashCharacterBody" src="${art}student-welcome-v1.webp" width="800" height="665" alt="" decoding="async"><img class="dashCharacterArm" src="${art}student-welcome-v1.webp" width="800" height="665" alt="" decoding="async"></div>
            <div class="dashBubble"><span class="dashEyebrow">โลกของการค้นพบ</span><h1 id="dashWelcomeHeading">สวัสดีครับ!</h1><p>พร้อมเรียนรู้วิทยาศาสตร์<br>ไปด้วยกันวันนี้นะครับ</p>${icon('sun','dashGreetingSun')}</div>
          </section>
          <section class="dashMission dashPanel" aria-labelledby="dashMissionHeading">
            <div class="dashSectionHeading"><h2 id="dashMissionHeading">${icon('mission')}กิจกรรมของฉัน</h2><strong data-dashboard-missions>${tasks.filter(t => t[1]).length}<small>/4</small></strong></div>
            <p class="dashMissionLesson">บทเรียน: ${e(focus.lesson.title)}</p>
            <div class="dashMissionBody"><ul class="dashMissionList">${tasks.map(([label, done, status]) => `<li class="${done ? 'isDone' : ''}"><span class="dashCheck" aria-hidden="true">${done ? icon('check') : ''}</span><span><b>${label}</b><small>${status}</small></span></li>`).join('')}</ul><div class="dashMissionArt">${image('flask')}<span>ค่อย ๆ เรียนรู้<br>ทีละก้าว</span></div></div>
            <button type="button" class="dashMissionLink" data-lesson="${e(id)}">${action}กิจกรรม${icon('arrow')}</button>
          </section>
          <section class="dashMenus" aria-label="เลือกกิจกรรมวิทยาศาสตร์">
            ${menu('Gold','books','เลือกระดับชั้น','เลือก ม.1 • ม.2 • ม.3','data-dashboard-grades')}
            ${menu('Blue','notebook','แบบฝึกหัด','ฝึกทักษะและทบทวน','data-dashboard-exercises')}
            ${menu('Mint','flask','Simulation','จำลองการทดลอง','data-shortcut="lab"')}
            ${menu('Purple','gamepad','เกมวิทยาศาสตร์','เรียนรู้ผ่านเกม','data-shortcut="games"')}
          </section>
          <section class="dashProgress dashPanel" aria-label="ความก้าวหน้าและเรียนต่อ">
            <div class="dashOverall">${icon('results')}<div><h2>ความก้าวหน้าในการเรียนรวม</h2><div class="dashProgressLine"><div class="dashTrack" role="progressbar" aria-label="บทเรียนที่ผ่านข้อสอบ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div><strong>${progress}%</strong></div><p>ผ่านข้อสอบ ${ctx.stats.done} จาก ${ctx.stats.total} บทเรียน</p></div></div>
            <div class="dashResume"><span class="dashResumeIcon">${icon('target')}</span><div><span data-dashboard-resume-label>${p.exam.passed ? 'ทบทวนบทเรียน' : started(p) ? 'บทเรียนที่กำลังเรียน' : 'เริ่มการเรียนรู้'}</span><h3 data-dashboard-resume-title>${e(focus.lesson.title)}</h3><small>ม.${focus.meta.grade} · ${e(stage)}</small></div><button type="button" class="dashResumeButton" data-dashboard-resume data-lesson="${e(id)}">${action}${icon('arrow')}</button></div>
          </section>
        </div>
        <p class="dashFootnote">ความก้าวหน้าบันทึกในเบราว์เซอร์นี้</p>
      </div>
      <nav class="dashNav bottomNav" aria-label="เมนูหลัก">${[['home','หน้าหลัก'],['lessons','บทเรียน'],['results','ผลการเรียน'],['mission','ภารกิจ'],['about','เกี่ยวกับเรา']].map(([key,label]) => `<button type="button" class="bottomItem ${key === 'home' ? 'active' : ''}" data-nav="${key}"${key === 'home' ? ' aria-current="page"' : ''}>${icon(key)}<span>${label}</span></button>`).join('')}</nav>
      <dialog class="dashExerciseDialog" aria-labelledby="dashExerciseHeading"><form class="dashExerciseForm"><header><h2 id="dashExerciseHeading">เลือกแบบฝึกหัด</h2><button type="button" data-dashboard-close aria-label="ปิด">${icon('close')}</button></header><p>เลือกบทเรียนและชุดฝึกที่อยากทบทวน</p><label>ระดับชั้น<select name="grade">${Object.keys(ctx.curriculum).map(g => `<option value="${g}"${+g === (ctx.user.grade || ctx.grade) ? ' selected' : ''}>มัธยมศึกษาปีที่ ${g}</option>`).join('')}</select></label><label>บทเรียน<select name="lesson"></select></label><label>ชุดฝึก<select name="stage"><option value="e1">แบบฝึกพื้นฐาน</option><option value="e2">แบบฝึกประยุกต์</option><option value="e3">O-NET Challenge</option></select></label><button type="submit" class="dashExerciseStart">เริ่มฝึก${icon('arrow')}</button></form></dialog>
    </main>`;
  }
  function attach(app, ctx) {
    // DOM-only listeners; the application still owns authentication, progression and resume.
    if (ctx.staffView || !app.querySelector) return;
    const root = app.querySelector('.dashboardPage');
    const dialog = root.querySelector('.dashExerciseDialog');
    const form = dialog.querySelector('form');
    const grade = form.elements.grade, lesson = form.elements.lesson;
    const populate = () => { lesson.innerHTML = ctx.curriculum[grade.value].map(unit => `<optgroup label="${ctx.escape(unit.title)}">${unit.lessons.map(l => `<option value="${ctx.escape(l.id)}">${ctx.escape(l.title)}</option>`).join('')}</optgroup>`).join(''); };
    populate();
    grade.addEventListener('change', populate);
    root.querySelector('[data-dashboard-grades]').addEventListener('click', ctx.openGrades);
    root.querySelector('[data-dashboard-exercises]').addEventListener('click', () => dialog.showModal());
    root.querySelector('[data-dashboard-close]').addEventListener('click', () => dialog.close());
    form.addEventListener('submit', event => {
      event.preventDefault();
      const id = lesson.value, stage = form.elements.stage.value;
      if (!ctx.lessons[id] || !['e1','e2','e3'].includes(stage)) return;
      dialog.close();ctx.openExercise(id, stage);
    });
    // Pause offscreen character motion without an animation loop or persistent observer.
    if (typeof IntersectionObserver !== 'undefined') {
      const character = root.querySelector('.dashCharacter');
      const observer = new IntersectionObserver(([entry]) => character.classList.toggle('isPaused', !entry.isIntersecting));
      observer.observe(character);
      const replacement = new MutationObserver(() => { if (!root.isConnected) { observer.disconnect(); replacement.disconnect(); } });
      replacement.observe(app, {childList:true});
    }
  }
  window.SLH_DASHBOARD = {render, attach, prepare};
})();
