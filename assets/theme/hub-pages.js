/* Presentation for results, learning goals and About. All progress stays owned by the app. */
(() => {
  'use strict';
  const art = name => `<img src="assets/dashboard/${name}-v1.webp" alt="" width="384" height="384" decoding="async" aria-hidden="true">`;
  const heading = (id, title, subtitle) => `<header class="hubHeading"><div class="hubSign"><h1 id="${id}">${title}</h1></div><p>${subtitle}</p></header>`;
  const screen = (type, header, content, footer) => `<div class="hubScreen hub${type}Screen">${header}<main class="shell hubContent" aria-labelledby="hub-${type.toLowerCase()}-heading"><div class="hubContainer">${content}</div></main>${footer}</div>`;
  const track = (value, maximum, label) => `<div class="hubTrack" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${maximum}" aria-valuenow="${value}"><span style="width:${Math.min(100, value / maximum * 100)}%"></span></div>`;

  function results({rows, stats, escape: e, thumbnail, header, footer}) {
    const summary = rows.length ? `<section class="hubStats" aria-label="สรุปผลการเรียน">
      <div class="hubStat"><span>ทำข้อสอบแล้ว</span><strong>${rows.length}<small> / ${stats.total} บท</small></strong></div>
      <div class="hubStat hubStatGreen"><span>บทเรียนที่ผ่าน</span><strong>${stats.done}<small> บท</small></strong></div>
      <div class="hubStat hubStatGold"><span>XP สะสม</span><strong>${stats.xp}<small> XP</small></strong></div>
    </section>` : '';
    const body = rows.length ? `<section class="hubPanel hubResults" aria-labelledby="hub-results-list-heading">
      <div class="hubPanelHeading"><div><span class="hubEyebrow">บันทึกการเรียนรู้</span><h2 id="hub-results-list-heading">ผลสอบของฉัน</h2></div><span class="hubCount">${rows.length} บทเรียน</span></div>
      <div class="hubResultList">${rows.map(r => `<article class="lessonCard hubResultCard">
        ${thumbnail(r.id, r.title)}<div class="hubResultCopy"><span class="hubGrade">มัธยมศึกษาปีที่ ${r.grade}</span><h3>${e(r.title)}</h3><div class="lessonStatus"><span class="hubStatus ${r.passed ? 'isPassed' : ''}">${r.passed ? 'ผ่านแล้ว' : 'ยังไม่ผ่าน'}</span><span>ทำข้อสอบ ${r.attempts} ครั้ง</span></div></div>
        <div class="hubBest"><strong>${r.best}<small>%</small></strong><span>คะแนนดีที่สุด</span></div>
        <button type="button" class="hubButton hubButtonBlue" data-open-result="${r.id}" aria-label="ดูผล ${e(r.title)}">ดูผล <span aria-hidden="true">→</span></button>
      </article>`).join('')}</div>
    </section>` : `<section class="hubPanel hubEmpty" aria-labelledby="hub-empty-heading"><div class="hubEmptyArt">${art('notebook')}</div><span class="hubEyebrow">เส้นทางการเรียนรู้ของคุณ</span><h2 id="hub-empty-heading">ยังไม่มีผลการเรียน</h2><p>เมื่อทำข้อสอบท้ายบทแล้ว<br>ผลการเรียนของคุณจะแสดงที่นี่</p><button type="button" class="hubButton" data-nav="lessons">ไปเลือกบทเรียน <span aria-hidden="true">→</span></button><span class="hubEmptyNote">ค่อย ๆ เรียนรู้ แล้วกลับมาดูความก้าวหน้ากัน</span></section>`;
    return screen('Results', header, heading('hub-results-heading', 'ผลการเรียน', 'ติดตามผลสอบและกลับไปทบทวนบทเรียนของคุณ') + summary + body, footer);
  }

  function missions({stats: st, header, footer}) {
    const goals = [[1, 'ผ่านอย่างน้อย 1 บท', 'ก้าวแรกของการเรียนรู้'], [5, 'ผ่าน 5 บท', 'สะสมความรู้ทีละบท'], [20, 'ผ่านครึ่งหลักสูตร', 'เป้าหมาย 20 บทเรียน'], [40, 'ครบ 40 บท', 'พิชิตทุกบทเรียนวิทยาศาสตร์']];
    const xpInLevel = st.xp % 300;
    return screen('Mission', header, heading('hub-mission-heading', 'ภารกิจของฉัน', 'เรียนรู้ทีละก้าว เก็บความสำเร็จไปด้วยกัน') + `<div class="hubMissionGrid">
      <section class="hubPanel hubGoals" aria-labelledby="hub-goals-heading"><div class="hubPanelHeading"><div><span class="hubEyebrow">เส้นทางสู่ความสำเร็จ</span><h2 id="hub-goals-heading">เป้าหมายการเรียนรู้</h2></div><div class="hubHeadingArt">${art('books')}</div></div>
        <ol class="hubGoalList">${goals.map(([target, title, subtitle], index) => {const done = st.done >= target; return `<li class="hubGoal ${done ? 'isDone' : ''}"><span class="hubGoalNumber" aria-hidden="true">${done ? '✓' : String(index + 1).padStart(2, '0')}</span><div class="hubGoalCopy"><h3>${title}</h3><p>${subtitle}</p>${track(Math.min(st.done, target), target, title)}</div><div class="hubGoalStatus"><strong>${Math.min(st.done, target)}<small>/${target}</small></strong><span>${done ? 'สำเร็จแล้ว' : 'บทเรียน'}</span></div></li>`;}).join('')}</ol>
        <p class="hubPanelNote">ผ่านข้อสอบท้ายบท เพื่อทำเป้าหมายให้สำเร็จ</p>
      </section>
      <section class="hubPanel hubExperience" aria-labelledby="hub-xp-heading"><div class="hubExperienceArt">${art('flask')}</div><span class="hubEyebrow">ทุกการเรียนรู้มีความหมาย</span><h2 id="hub-xp-heading">XP สะสม</h2><div class="hubXpTotal">${st.xp}<span>XP</span></div><span class="hubLevel">Level ${st.level}</span><div class="hubLevelProgress"><div><span>สู่ Level ${st.level + 1}</span><b>${xpInLevel} / 300 XP</b></div>${track(xpInLevel, 300, 'XP ภายในระดับปัจจุบัน')}<p>อีก ${300 - xpInLevel} XP ถึงระดับถัดไป</p></div><button type="button" class="hubButton" data-nav="lessons">ไปเรียนรู้ต่อ <span aria-hidden="true">→</span></button></section>
    </div>`, footer);
  }

  function about(root) {
    const opener = document.activeElement;
    root.innerHTML = `<dialog class="hubAboutDialog" aria-labelledby="hub-about-heading"><div class="hubAboutHeader"><img class="hubAboutLogo" src="assets/branding/33852269be64c916.png" alt="ตราโรงเรียนห้องสอนศึกษา" width="600" height="956"><div><span class="hubEyebrow">โลกของการเรียนรู้วิทยาศาสตร์</span><h2 id="hub-about-heading">เกี่ยวกับ<br><span>Science Learning Hub</span></h2></div><button type="button" class="hubClose" data-close-modal aria-label="ปิดหน้าต่างเกี่ยวกับเรา" autofocus>×</button></div>
      <div class="hubAboutBody"><div class="hubDemoNotice"><span class="hubNoticeIcon" aria-hidden="true">i</span><p><b>โหมดสาธิต</b>บัญชีที่แสดงเป็นบัญชีตัวอย่าง ความคืบหน้าเก็บเฉพาะเบราว์เซอร์นี้ ไม่ซิงก์ข้ามเครื่อง และจะหายเมื่อล้างข้อมูลเว็บไซต์</p></div>
      <section class="hubAboutIntro"><div><h3>เรียนรู้ ทดลอง และค้นพบ</h3><p>ระบบนี้ใช้โครงเนื้อหาวิทยาศาสตร์ภาคบังคับระดับมัธยมศึกษาตอนต้นของ สสวท. เป็นฐาน และออกแบบการประเมินให้ฝึกการใช้ข้อมูล การทดลอง การประยุกต์ และการวิเคราะห์ในลักษณะที่สอดคล้องกับแนวข้อสอบ O-NET</p></div>${art('flask')}</section>
      <section class="hubPrinciples"><h3>หลักสำคัญในการเรียนรู้</h3><ul><li>ไม่มีความรู้ใหม่ปรากฏครั้งแรกในข้อสอบ</li><li>เลือกกิจกรรมได้อิสระ มีลำดับแนะนำ</li><li>แบบฝึกตั้งเป้าถูก <b>100%</b> โดยไม่บังคับก่อนทำกิจกรรมอื่น</li><li>ข้อสอบท้ายบทผ่าน <b>60%</b> และทำซ้ำเพื่อ <b>100%</b> ได้</li></ul></section>
      <p class="hubAboutSources">ชุด Challenge และข้อสอบท้ายบทเป็นคำถามแต่งใหม่ ส่วนฝึกข้อสอบ O-NET จริงเปิดต้นฉบับจาก สทศ. พร้อมระบุปี ข้อ และหน้า PDF</p></div>
      <div class="hubAboutFooter"><span>Science Learning Hub · วิทยาศาสตร์ ม.1–ม.3</span><button type="button" class="hubButton" data-close-modal>ปิด</button></div></dialog>`;
    const dialog = root.querySelector('dialog');
    root.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {root.innerHTML = ''; if (opener?.isConnected) opener.focus();}, {once:true});
    dialog.showModal();
  }
  window.SLH_HUB_PAGES = Object.freeze({results, missions, about});
})();
