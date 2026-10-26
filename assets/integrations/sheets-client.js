(() => {
  'use strict';
  const KEY = 'slh_sheets_outbox_v1_';
  let session = null, staffBootstrap = null, generation = 0, timer = null, busy = false, failures = 0;
  let notice = '', durable = true, authenticationExpired = false;
  const memory = new Map();
  const RESET_KEY = 'slh_reset_state_v1_';
  const resetListeners = new Set();
  let resetState = {sequence:0,all:'',lessons:{}}, resetTimer = null, resetRequest = null, resetSupported = false;
  const resetKey = user => RESET_KEY + encodeURIComponent(user);
  const validRevision = value => typeof value === 'string' && (value === '' || /^[A-Za-z0-9_.:-]{1,160}$/.test(value));
  function validResetState(state) {
    return state && Number.isSafeInteger(state.sequence) && state.sequence >= 0 && validRevision(state.all) && state.lessons && typeof state.lessons === 'object' && !Array.isArray(state.lessons) && Object.entries(state.lessons).every(([id,revision]) => /^G[1-3]U[1-9][0-9]?L[1-9][0-9]?$/.test(id) && validRevision(revision));
  }
  const revisionFor = (state,id) => state.lessons[id] || state.all || '';
  const progressVersion = id => session ? revisionFor(resetState,id) : '';
  function applyResetState(state, notify = true, persistState = true) {
    if (!session || !validResetState(state) || state.sequence < resetState.sequence) return;
    const previous = resetState;
    resetState = copy(state);
    if (persistState && state.sequence > 0) {
      try { localStorage.setItem(resetKey(session.user.id),JSON.stringify(resetState)); } catch { /* Server state remains authoritative in memory. */ }
    }
    // Remove only events from older reset generations. Never relabel queued work.
    const stale = read(session.user.id).filter(item => (item.resetVersion || '') !== progressVersion(item.lessonId));
    acknowledge(session.user.id,stale.map(item => item.id));
    const changed = previous.all !== state.all || JSON.stringify(previous.lessons) !== JSON.stringify(state.lessons);
    if (notify && changed) {
      notice = 'แอดมินรีเซ็ตผลการเรียนแล้ว เริ่มกิจกรรมในขอบเขตที่รีเซ็ตได้ใหม่';
      resetListeners.forEach(listener => listener({userId:session.user.id,previous:copy(previous),current:copy(resetState)}));
    }
    refreshStatus();
  }
  function scheduleResetCheck() {
    clearTimeout(resetTimer); resetTimer = null;
    if (session && resetSupported && !authenticationExpired) resetTimer = setTimeout(() => { resetTimer = null; void refreshResetState(); },60000);
  }
  async function refreshResetState() {
    if (!session || !resetSupported || authenticationExpired || document.hidden === true) { scheduleResetCheck(); return; }
    if (resetRequest) return resetRequest;
    const ticket = generation, owner = session.user.id, token = session.token;
    const task = (async () => {
      try {
        const data = await request('studentResetState',{},token);
        if (ticket === generation && session?.user.id === owner) applyResetState(data?.resetState);
      } catch (error) {
        if (ticket === generation && error.code === 'UNAUTHENTICATED') { authenticationExpired = true; notice = 'กรุณาออกแล้วเข้าสู่ระบบใหม่ คิวผลกิจกรรมยังเก็บไว้'; refreshStatus(); }
      } finally { if (ticket === generation) { resetRequest = null; scheduleResetCheck(); } }
    })();
    resetRequest = task;
    return task;
  }
  const enabled = () => !!window.SLH_SHEETS_CONFIG?.endpoint?.trim();
  const copy = value => JSON.parse(JSON.stringify(value));
  const uid = () => window.crypto?.randomUUID?.() || 'slh-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  const key = user => KEY + encodeURIComponent(user);
  const eventKey = (user,id) => key(user) + '/' + encodeURIComponent(id);
  function read(user) {
    const values = new Map(memory.get(user) || []), prefix = key(user) + '/';
    try {
      for (let i=0;i<localStorage.length;i++) {
        const storedKey = localStorage.key(i);
        if (storedKey?.startsWith(prefix)) {
          const value = JSON.parse(localStorage.getItem(storedKey));
          if (value?.id) values.set(value.id,value);
        }
      }
    } catch { notice = 'อ่านคิวบันทึกไม่ได้ กรุณาตรวจพื้นที่จัดเก็บของเบราว์เซอร์'; }
    return [...values.values()].sort((a,b) => a.occurredAt-b.occurredAt);
  }
  function persist(user, events) {
    const pending = memory.get(user) || new Map();
    for (const item of events) {
      try { localStorage.setItem(eventKey(user,item.id), JSON.stringify(item)); pending.delete(item.id); }
      catch { pending.set(item.id, item); notice = 'คิวใหม่อยู่ในหน่วยความจำ กรุณาเชื่อมต่อและรอส่งสำเร็จก่อนปิดหน้า'; }
    }
    memory.set(user,pending); durable = pending.size === 0;
    refreshStatus();
  }
  function acknowledge(user, ids) {
    const pending = memory.get(user) || new Map();
    for (const id of ids) {
      pending.delete(id);
      try { localStorage.removeItem(eventKey(user,id)); }
      catch { notice = 'ส่งสำเร็จแล้ว แต่ล้างคิวในเบราว์เซอร์ไม่ได้ ระบบจะตรวจรายการซ้ำให้อัตโนมัติ'; }
    }
    memory.set(user,pending); durable = pending.size === 0;
  }
  function status() {
    if (!enabled()) return '';
    const count = session ? read(session.user.id).length : 0;
    return notice || (!session ? 'Google Sheets: กรุณาเข้าสู่ระบบ' : busy ? 'Google Sheets: กำลังส่งผลกิจกรรม (' + count + ')' : count ? 'Google Sheets: รอส่ง ' + count + ' รายการ' : 'Google Sheets: ส่งผลกิจกรรมครบแล้ว');
  }
  function refreshStatus() {
    if (!enabled()) return;
    document.querySelectorAll?.('[data-sheets-status]').forEach(el => { el.textContent = status(); });
  }
  function mountStatus() {
    if (!enabled() || !document.createElement) return;
    let el = document.querySelector('[data-sheets-status]');
    if (!el) {
      const target = document.querySelector('.dashboardPage') || document.querySelector('main.shell');
      if (!target) return;
      el = document.createElement('p'); el.className = 'callout'; el.dataset.sheetsStatus = ''; el.setAttribute('role', 'status');
      target.appendChild(el);
    }
    refreshStatus();
  }
  async function request(action, payload = {}, token = session?.token || '') {
    const endpoint = window.SLH_SHEETS_CONFIG?.endpoint?.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint || '')) throw Error('กรุณาตั้งค่า URL ของ Apps Script /exec');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeout;
    const task = fetch(endpoint, {method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token,payload}),signal:controller?.signal});
    try {
      const response = await Promise.race([task, new Promise((_, reject) => { timeout = setTimeout(() => { controller?.abort(); reject(Error('เชื่อมต่อหมดเวลา ระบบจะส่งรายการเดิมอีกครั้ง')); }, 30000); })]);
      if (!response.ok) throw Error('เชื่อมต่อ Google Sheets ไม่สำเร็จ');
      const body = await response.json();
      if (!body || body.ok !== true) { const error = Error(body?.error?.message || 'บันทึกไม่สำเร็จ'); error.code = body?.error?.code; throw error; }
      return body.data;
    } finally { clearTimeout(timeout); }
  }
  function schedule(delay = 700) {
    if (!session || authenticationExpired || timer !== null) return;
    timer = setTimeout(() => { timer = null; void flush(); }, delay);
  }
  async function login(username, password) {
    const ticket = ++generation;
    clearTimeout(timer); timer = null; session = null; staffBootstrap = null; busy = false; notice = ''; failures = 0;
    clearTimeout(resetTimer); resetTimer = null; resetRequest = null; resetSupported = false; resetState = {sequence:0,all:'',lessons:{}};
    const data = await request('login', {username,password}, '');
    if (ticket !== generation) throw Error('ยกเลิกการเข้าสู่ระบบแล้ว');
    if (!data?.token || !data.user?.id || !Array.isArray(data.user.roles)) throw Error('ข้อมูลบัญชีจากเซิร์ฟเวอร์ไม่ครบ');
    authenticationExpired = false; session = copy({token:data.token,user:data.user,expiresAt:data.expiresAt});
    if (session.user.roles.includes('Student')) {
      try { applyResetState(JSON.parse(localStorage.getItem(resetKey(session.user.id))),false,false); } catch { /* First login or unavailable local storage. */ }
      resetSupported = validResetState(data.resetState);
      if (resetSupported) applyResetState(data.resetState,false);
      scheduleResetCheck();
    }
    // The authorized first page arrives with login once. Never cache it across views or sessions.
    if (session.user.roles.some(role => role === 'Teacher' || role === 'Admin') && data.staff) staffBootstrap = copy(data.staff);
    read(session.user.id); schedule(); refreshStatus(); return copy(data.user);
  }
  function logout() {
    const token = session?.token;
    generation++; clearTimeout(timer); timer = null; session = null; staffBootstrap = null; busy = false; failures = 0; notice = '';
    clearTimeout(resetTimer); resetTimer = null; resetRequest = null; resetSupported = false; resetState = {sequence:0,all:'',lessons:{}};
    if (token) void request('logout', {}, token).catch(() => {});
    refreshStatus();
  }
  function event(lessonId, kind, stage, result) { const item = {id:uid(),lessonId,kind,stage,occurredAt:Date.now(),result:copy(result)}; const version = progressVersion(lessonId); if (version) item.resetVersion = version; return item; }
  function queue(item) {
    if (!enabled() || !session) return false;
    if ((item.resetVersion || '') !== progressVersion(item.lessonId)) return false;
    const events = read(session.user.id);
    if (!events.some(value => value.id === item.id)) persist(session.user.id, [copy(item)]);
    schedule(); return true;
  }
  async function flush() {
    if (!session || busy || authenticationExpired) return;
    const owner = session.user.id, ticket = generation, token = session.token;
    const events = read(owner).slice(0, 20);
    if (!events.length) { refreshStatus(); return; }
    busy = true; refreshStatus();
    try {
      const data = await request('sync', {events:copy(events)}, token);
      if (ticket !== generation || session?.user.id !== owner) return;
      const sent = new Set(events.map(item => item.id));
      const acknowledged = new Set((data?.acknowledged || []).filter(id => sent.has(id)));
      if (!acknowledged.size) throw Error('เซิร์ฟเวอร์ยังไม่ยืนยันรายการบันทึก');
      acknowledge(owner, acknowledged);
      failures = 0; if (durable) notice = '';
      if (data?.resetState) applyResetState(data.resetState);
    } catch (error) {
      if (ticket !== generation) return;
      if (['UNAUTHENTICATED','AUTH_EXPIRED','AUTH_REQUIRED','UNAUTHORIZED','INVALID_SESSION'].includes(error.code)) authenticationExpired = true;
      failures++; notice = (authenticationExpired ? 'กรุณาออกแล้วเข้าสู่ระบบใหม่ คิวผลกิจกรรมยังเก็บไว้ • ' : '') + 'ยังส่งผลกิจกรรมไม่สำเร็จ: ' + error.message + ' • คิวเดิมจะส่งอีกครั้งหลังเชื่อมต่อ';
    } finally {
      if (ticket === generation) { busy = false; refreshStatus(); if (read(owner).length) schedule(Math.min(60000, 1000 * 2 ** Math.min(failures, 6))); }
    }
  }
  async function teacherRequest(action, payload) {
    if (!session || !session.user.roles.some(role => role === 'Teacher' || role === 'Admin')) throw Error('ต้องเข้าสู่ระบบด้วยบัญชีครู');
    const ticket = generation, token = session.token;
    const data = await request(action, payload, token);
    if (ticket !== generation) throw Error('สิ้นสุดการเข้าสู่ระบบแล้ว');
    return data;
  }
  function takeTeacherBootstrap() { const data = staffBootstrap; staffBootstrap = null; return data; }
  window.SLH_SHEETS = {enabled,login,logout,event,queue,flush,mountStatus,status,takeTeacherBootstrap,progressVersion,refreshResetState,
    onReset: listener => { resetListeners.add(listener); return () => resetListeners.delete(listener); },
    teacherOptions: payload => teacherRequest('teacherOptions', payload),
    teacherRoster: payload => teacherRequest('teacherRoster', payload),
    studentResults: payload => teacherRequest('studentResults', payload),
    teacherSummary: payload => teacherRequest('teacherSummary', payload),
    examHistory: payload => teacherRequest('examHistory', payload),
    adminTeachers: payload => adminRequest('adminTeachers', payload),
    adminCreateTeacher: payload => adminRequest('adminCreateTeacher', payload),
    adminUpdateTeacher: payload => adminRequest('adminUpdateTeacher', payload),
    adminResetStudent: payload => adminRequest('adminResetStudent', payload)};
  async function adminRequest(action, payload) {
    if (!session || !session.user.roles.includes('Admin')) throw Error('ต้องเข้าสู่ระบบด้วยบัญชีแอดมิน');
    return teacherRequest(action, payload);
  }
  window.addEventListener?.('online', () => { failures = 0; clearTimeout(timer); timer = null; void refreshResetState(); schedule(0); });
  window.addEventListener?.('focus', () => { void refreshResetState(); });
  document.addEventListener?.('visibilitychange', () => { if (!document.hidden) void refreshResetState(); });
  window.addEventListener?.('storage', e => {
    if (session && e.key === resetKey(session.user.id)) { try { applyResetState(JSON.parse(e.newValue),true,false); } catch { /* Ignore malformed cross-tab metadata. */ } }
    if (session && e.key?.startsWith(key(session.user.id) + '/')) { refreshStatus(); schedule(); }
  });
  window.addEventListener?.('beforeunload', e => { if (session && !durable && read(session.user.id).length) { e.preventDefault(); e.returnValue = ''; } });
})();
