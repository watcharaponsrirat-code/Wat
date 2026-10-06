/* Visual enhancements only: never reads/writes storage or changes a learning handler. */
(() => {
  'use strict';
  if (typeof MutationObserver === 'undefined' || !document.createElement) return;
  const app = document.getElementById('app');
  const school = 'โรงเรียนห้องสอนศึกษา ในพระอุปถัมภ์ฯ';
  let loginLogoObserver;
  function decorate() {
    loginLogoObserver?.disconnect();
    const stage = app.querySelector('.stageDot.active')?.dataset.stage;
    document.body.dataset.scene = stage || (app.querySelector('.loginPage') ? 'login' : app.querySelector('.heroWorld') ? 'dashboard' : 'world');
    app.querySelectorAll('.brandLogo,.loginBrand>img,.heroLogoBox>img').forEach(img => { img.alt = school; });
    const loginLogo = app.querySelector('.loginBrand>img');
    if (loginLogo && typeof IntersectionObserver !== 'undefined') {
      const sticky = document.createElement('header'); sticky.className='loginStickyBrand'; sticky.hidden=true;
      const label = document.createElement('span'); label.textContent=school;
      sticky.append(loginLogo.cloneNode(),label); app.querySelector('.loginPage').append(sticky);
      loginLogoObserver = new IntersectionObserver(([entry])=>{sticky.hidden=entry.isIntersecting;});
      loginLogoObserver.observe(loginLogo);
    }
    app.querySelectorAll('.loginBrand,.heroLogoBox>div').forEach(host => {
      if (host.querySelector('.schoolName')) return;
      const name = document.createElement('p');
      name.className = 'schoolName'; name.textContent = school;
      if (host.matches('.loginBrand')) host.querySelector('img').after(name);
      else host.append(name);
    });
    [['loginUser','รหัสผู้ใช้'],['loginPass','รหัสผ่าน']].forEach(([id,label]) => {
      const input = document.getElementById(id);
      if (input) { input.setAttribute('aria-label',label); input.previousElementSibling?.setAttribute('for',id); }
    });
    const simLabel = app.querySelector('[data-shortcut="lab"] small');
    if (simLabel) simLabel.textContent = 'Simulation • ทดลองด้วยตัวเอง';
    const loginSim = app.querySelector('.loginFeature:nth-child(2) b');
    if (loginSim) loginSim.textContent = 'Simulation';
    const loginHeading = app.querySelector('.loginPanel h1');
    if (loginHeading) loginHeading.textContent = 'เข้าสู่โลกวิทยาศาสตร์';
    const readingBadge = app.querySelector('.readingPage .contentHeader .badge');
    if (readingBadge) readingBadge.textContent = readingBadge.textContent.split(' • ')[0] + ' • ภารกิจวิทยาศาสตร์';
    const examHeader = app.querySelector('.examCard .gameTitle>div');
    if (examHeader && !examHeader.querySelector('.examGuidance')) {
      const guidance = document.createElement('details'); guidance.className='examGuidance';
      const summary = document.createElement('summary'); summary.textContent='คำแนะนำก่อนทำข้อสอบ'; guidance.append(summary);
      Array.from(examHeader.children).filter(el=>el.matches('p:not([role]),.callout')).forEach(el=>guidance.append(el));
      examHeader.append(guidance);
    }
    app.querySelectorAll('[data-grade],[data-unit],[data-lesson]').forEach(card => {
      // Existing click handler remains the single source of navigation.
      if (!card.querySelector('button')) {
        card.setAttribute('role','button'); card.tabIndex = 0;
        card.addEventListener('keydown', event => {
          if (event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); }
        });
      }
    });
    app.querySelectorAll('.lessonCard').forEach(card => {
      if (card.querySelector('.lessonStatus')?.textContent.includes('ค้างล่าสุด')) card.classList.add('resumeMission');
    });
    const firstResume = app.querySelector('.lessonCard.resumeMission');
    if (firstResume && app.querySelector('.lessonList')) {
      const banner = document.createElement('aside');
      banner.className = 'checkpointBanner';
      banner.innerHTML = '<span class="checkpointIcon" aria-hidden="true">⚑</span><div><strong>เรียนต่อจากจุดล่าสุด</strong><p>แตะ “เรียนต่อ” ที่ภารกิจเพื่อกลับไปยังจุดที่บันทึกไว้</p></div>';
      app.querySelector('.lessonList').before(banner);
    }
    const result = app.querySelector('.resultHero');
    if (result) {
      const heading = result.querySelector('h1');
      const passed = heading.textContent.includes('ผ่านเกณฑ์');
      if (passed) {
        result.classList.add('is-passed');
        const title = document.createElement('span'); title.className='mission-complete'; title.textContent='MISSION COMPLETE'; heading.before(title);
      }
      if (result.querySelector('.scoreCircle strong')?.textContent === '100%') {
        const badge = document.createElement('div'); badge.className='perfectBadge'; badge.textContent='★ PERFECT SCORE • 100%'; heading.before(badge);
      }
    }
  }
  // Only full view replacement is observed, not simulation ticks or input changes.
  new MutationObserver(decorate).observe(app, {childList:true});
  decorate();
})();
