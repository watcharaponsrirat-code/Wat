/** Science Learning Hub — private Apps Script backend.
 * Source Students / Staff tabs are READ ONLY. Set Script Properties before setup():
 * SLH_SPREADSHEET_ID, optionally SLH_STUDENTS_SHEET and SLH_STAFF_SHEET.
 * Never copy account rows, passwords, tokens or scores into the static website.
 * Scores are client-reported learning records, not server-proctored assessments.
 */
var SLH = Object.freeze({
  year: '2569', students: 907, sessionMs: 12 * 60 * 60 * 1000,
  events: 'SLH_Events', sessions: 'SLH_Sessions', maxBatch: 100,
  eventHeaders: ['EventKey', 'EventId', 'UserId', 'AcademicYear', 'LessonId', 'Kind', 'Stage', 'OccurredAt', 'ReceivedAt', 'ResultJSON', 'PayloadHash'],
  sessionHeaders: ['TokenHash', 'UserId', 'CreatedAt', 'ExpiresAt', 'RevokedAt'],
  studentHeaders: ['เลขประจำตัวโรงเรียน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ระดับชั้น', 'ห้อง', 'เลขที่', 'Username', 'Password (ทดสอบ)', 'บทบาท', 'ปีการศึกษา'],
  staffHeaders: ['Username', 'Password (ทดสอบ)', 'บทบาท 1', 'บทบาท 2', 'สถานะ', 'หมายเหตุ']
});

/** Run first: validate existing accounts without writing sheets or properties. */
function inspectSetup() {
  var report = inspectSetup_(database_());
  console.log(JSON.stringify(report));
  return report;
}
function inspectSetup_(db) {
  var accounts = accounts_(db), students = Object.keys(accounts).filter(function (id) { return accounts[id].roles.indexOf('Student') >= 0; });
  if (students.length !== SLH.students) fail_('SETUP_INVALID', 'ต้องมีบัญชีนักเรียนปี 2569 จำนวน 907 บัญชี');
  var owner = accounts.watcharapon;
  if (!owner || owner.roles.indexOf('Admin') < 0 || owner.roles.indexOf('Teacher') < 0) fail_('SETUP_INVALID', 'ไม่พบบัญชีครูและผู้ดูแลที่กำหนด');
  var existing = [];
  [[SLH.events, SLH.eventHeaders], [SLH.sessions, SLH.sessionHeaders]].forEach(function (item) {
    if (db.getSheetByName(item[0])) { table_(db, item[0], item[1]); existing.push(item[0]); }
  });
  return {ok: true, academicYear: SLH.year, studentCount: students.length, accountCount: Object.keys(accounts).length, sourceTabsModified: false, existingAppTabs: existing};
}
/** Run after inspection as the owner. Creates only missing app tabs. */
function setup() {
  var report = locked_(function () {
    var db = database_(), report = inspectSetup_(db);
    [[SLH.events, SLH.eventHeaders], [SLH.sessions, SLH.sessionHeaders]].forEach(function (item) {
      if (!db.getSheetByName(item[0])) {
        var sheet = db.insertSheet(item[0]);
        sheet.getRange(1, 1, 1, item[1].length).setValues([item[1]]);
        sheet.setFrozenRows(1);
      }
    });
    PropertiesService.getScriptProperties().setProperty('SLH_READY', '1');
    return report;
  });
  console.log(JSON.stringify(report));
  return report;
}

function doGet() { return json_({ok: true, data: {service: 'Science Learning Hub', protocol: 1}}); }
function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 1048576) fail_('INVALID_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง');
    var request;
    try { request = JSON.parse(e.postData.contents); } catch (_) { fail_('INVALID_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง'); }
    if (!plain_(request) || typeof request.action !== 'string') fail_('INVALID_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง');
    if (PropertiesService.getScriptProperties().getProperty('SLH_READY') !== '1') fail_('NOT_CONFIGURED', 'ยังไม่ได้ติดตั้งระบบข้อมูล');
    var data, payload = request.payload || {};
    if (!plain_(payload)) fail_('INVALID_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง');
    if (request.action === 'login') data = locked_(function () { return login_(payload); });
    else if (request.action === 'logout') data = locked_(function () { return logout_(request.token); });
    else if (request.action === 'sync') data = locked_(function () { return sync_(request.token, payload); });
    else if (request.action === 'teacherSummary') data = summary_(request.token, payload);
    else if (request.action === 'examHistory') data = history_(request.token, payload);
    else fail_('INVALID_REQUEST', 'ไม่รองรับคำขอนี้');
    return json_({ok: true, data: data});
  } catch (error) {
    // Do not return or log caught errors: spreadsheet/provider errors can contain private data.
    return json_({ok: false, error: {code: error.slhCode || 'UNAVAILABLE', message: error.slhCode ? error.message : 'ระบบข้อมูลไม่พร้อม กรุณาลองอีกครั้ง'}});
  }
}

function database_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SLH_SPREADSHEET_ID');
  if (!id || !/^[A-Za-z0-9_-]{20,100}$/.test(id)) fail_('NOT_CONFIGURED', 'กรุณาตั้งค่า Spreadsheet ID ใน Script Properties');
  return SpreadsheetApp.openById(id);
}
function sourceRows_(db, name, required) {
  if ([SLH.events, SLH.sessions].indexOf(name) >= 0) fail_('SETUP_INVALID', 'ชื่อชีตบัญชีไม่ถูกต้อง');
  var sheet = db.getSheetByName(name);
  if (!sheet) fail_('SETUP_INVALID', 'ไม่พบชีตบัญชีที่กำหนด');
  // Display values preserve text account IDs and leading zeroes.
  var rows = sheet.getDataRange().getDisplayValues(), headers = rows.shift().map(function (v) { return String(v).trim(); });
  if (required.some(function (h) { return headers.indexOf(h) < 0; }) || new Set(headers).size !== headers.length) fail_('SETUP_INVALID', 'หัวคอลัมน์บัญชีไม่ครบหรือซ้ำ');
  return rows.filter(function (row) { return row.some(function (v) { return String(v).trim() !== ''; }); }).map(function (row) {
    var out = Object.create(null);
    headers.forEach(function (header, i) { out[header] = String(row[i] || ''); });
    return out;
  });
}
function accounts_(db) {
  var props = PropertiesService.getScriptProperties(), directory = Object.create(null);
  var studentSheet = props.getProperty('SLH_STUDENTS_SHEET') || 'Students', staffSheet = props.getProperty('SLH_STAFF_SHEET') || 'Staff';
  if (studentSheet === staffSheet) fail_('SETUP_INVALID', 'ชื่อชีตบัญชีต้องแยกกัน');
  function add(account) {
    if (!account.id || account.id.length > 120 || /[\x00-\x1f]/.test(account.id) || !account.password || Object.prototype.hasOwnProperty.call(directory, account.id)) fail_('SETUP_INVALID', 'บัญชีขาดข้อมูลหรือชื่อผู้ใช้ซ้ำ');
    directory[account.id] = account;
  }
  sourceRows_(db, studentSheet, SLH.studentHeaders).forEach(function (r) {
    if (r['ปีการศึกษา'].trim() !== SLH.year) return;
    var grade = Number(r['ระดับชั้น'].trim());
    if (![1, 2, 3].includes(grade) || !/^(student|นักเรียน)$/i.test(r['บทบาท'].trim())) fail_('SETUP_INVALID', 'ชั้นหรือบทบาทนักเรียนไม่ถูกต้อง');
    add({id: r.Username.trim(), name: (r['คำนำหน้า'] + r['ชื่อ'] + ' ' + r['นามสกุล']).trim(), grade: grade, room: r['ห้อง'].trim(), number: r['เลขที่'].trim(), roles: ['Student'], password: r['Password (ทดสอบ)']});
  });
  sourceRows_(db, staffSheet, SLH.staffHeaders).forEach(function (r) {
    // The owner's existing staff record is marked เตรียมข้อมูล; source data stays intact.
    if (!/^(active|ใช้งาน|เปิดใช้งาน|ปกติ|เตรียมข้อมูล)$/i.test(r['สถานะ'].trim())) return;
    var id = r.Username.trim(), roles = [r['บทบาท 1'], r['บทบาท 2']].map(function (role) {
      return /^(teacher|ครู)$/i.test(role.trim()) ? 'Teacher' : /^(admin|ผู้ดูแล|ผู้ดูแลระบบ)$/i.test(role.trim()) ? 'Admin' : '';
    }).filter(Boolean);
    if (id === 'watcharapon') roles = ['Teacher', 'Admin'];
    if (!roles.length) fail_('SETUP_INVALID', 'บทบาทบุคลากรไม่ถูกต้อง');
    add({id: id, name: id, grade: null, room: '', number: '', roles: Array.from(new Set(roles)), password: r['Password (ทดสอบ)']});
  });
  return directory;
}
function publicUser_(account) {
  return {id: account.id, name: account.name, grade: account.grade, room: account.room, number: account.number, roles: account.roles.slice(), teacher: account.roles.indexOf('Teacher') >= 0, admin: account.roles.indexOf('Admin') >= 0};
}
function table_(db, name, headers) {
  var sheet = db.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 1) fail_('NOT_CONFIGURED', 'กรุณารัน setup ก่อนใช้งาน');
  var actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (actual.join('\u001f') !== headers.join('\u001f') || sheet.getLastColumn() !== headers.length) fail_('SETUP_INVALID', 'โครงสร้างชีตระบบไม่ตรงกัน');
  return sheet;
}
function rows_(sheet, width) { return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues(); }
function append_(sheet, rows) {
  if (!rows.length) return;
  // Values supplied by users must never become spreadsheet formulas.
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows.map(function (row) { return row.map(cell_); }));
}
function cell_(value) { return typeof value === 'string' && /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value; }
function sha_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function equalSecret_(a, b) {
  // Compare fixed-length digests; never return a stored credential.
  a = sha_(a); b = sha_(b); var difference = 0;
  for (var i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function rateLimit_(username, now) {
  var props = PropertiesService.getScriptProperties(), values = props.getProperties();
  // Bound storage under attempts with random unknown usernames. Fail closed on storage errors.
  Object.keys(values).filter(function (key) { return key.indexOf('SLH_RATE_') === 0; }).forEach(function (key) {
    var bucket; try { bucket = JSON.parse(values[key]); } catch (_) { fail_('UNAVAILABLE', 'ระบบข้อมูลไม่พร้อม กรุณาลองอีกครั้ง'); }
    if (bucket.until <= now) props.deleteProperty(key);
  });
  var rules = [{key: 'SLH_RATE_GLOBAL', max: 1800, duration: 300000}, {key: 'SLH_RATE_' + sha_(username), max: 10, duration: 900000}];
  var pending = {};
  rules.forEach(function (rule) {
    var raw = props.getProperty(rule.key), bucket = raw ? JSON.parse(raw) : {count: 0, until: now + rule.duration};
    if (!Number.isFinite(bucket.count) || !Number.isFinite(bucket.until) || bucket.count >= rule.max) fail_('RATE_LIMITED', 'เข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่');
    bucket.count++; pending[rule.key] = JSON.stringify(bucket);
  });
  props.setProperties(pending, false);
}
function login_(payload) {
  var username = typeof payload.username === 'string' ? payload.username.trim() : '', password = payload.password;
  if (!username || username.length > 120 || typeof password !== 'string' || password.length > 256) fail_('INVALID_CREDENTIALS', 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  var now = Date.now(); rateLimit_(username, now);
  var db = database_(), account = accounts_(db)[username], credential = account ? account.password : 'unassigned-account-placeholder';
  if (!equalSecret_(password, credential) || !account) fail_('INVALID_CREDENTIALS', 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''), expiresAt = now + SLH.sessionMs;
  append_(table_(db, SLH.sessions, SLH.sessionHeaders), [[sha_(token), account.id, now, expiresAt, '']]);
  PropertiesService.getScriptProperties().deleteProperty('SLH_RATE_' + sha_(username));
  return {token: token, user: publicUser_(account), expiresAt: expiresAt};
}
function session_(token, db) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail_('UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบใหม่');
  var hash = sha_(token), rows = rows_(table_(db, SLH.sessions, SLH.sessionHeaders), SLH.sessionHeaders.length), found;
  rows.some(function (r, index) { if (r[0] === hash) { found = {row: index + 2, record: r}; return true; } return false; });
  if (!found || found.record[4] || Number(found.record[3]) <= Date.now()) fail_('UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบใหม่');
  var accounts = accounts_(db), account = accounts[String(found.record[1])];
  if (!account) fail_('UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบใหม่');
  return {account: account, accounts: accounts, row: found.row};
}
function logout_(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return {loggedOut: true};
  var db = database_(), sheet = table_(db, SLH.sessions, SLH.sessionHeaders), hash = sha_(token);
  rows_(sheet, SLH.sessionHeaders.length).some(function (r, index) {
    if (r[0] !== hash) return false;
    if (!r[4]) sheet.getRange(index + 2, 5, 1, 1).setValues([[Date.now()]]);
    return true;
  });
  return {loggedOut: true};
}
function plain_(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function canonical_(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical_).join(',') + ']';
  if (plain_(value)) return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonical_(value[key]); }).join(',') + '}';
  return JSON.stringify(value);
}
function validateTree_(value, depth, budget) {
  budget.count++;
  if (depth > 12 || budget.count > 5000) fail_('INVALID_EVENT', 'ข้อมูลกิจกรรมมีขนาดใหญ่เกินไป');
  if (typeof value === 'string' && value.length > 12000) fail_('INVALID_EVENT', 'ข้อมูลกิจกรรมมีขนาดใหญ่เกินไป');
  if (typeof value === 'number' && !Number.isFinite(value)) fail_('INVALID_EVENT', 'ข้อมูลคะแนนไม่ถูกต้อง');
  if (value && typeof value === 'object') Object.keys(value).forEach(function (key) {
    if (['__proto__', 'prototype', 'constructor'].indexOf(key) >= 0) fail_('INVALID_EVENT', 'รูปแบบกิจกรรมไม่ถูกต้อง');
    validateTree_(value[key], depth + 1, budget);
  });
}
function lesson_(value) { return typeof value === 'string' && /^G[1-3]U[1-9][0-9]?L[1-9][0-9]?$/.test(value); }
function event_(raw, now) {
  if (!plain_(raw) || typeof raw.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(raw.id) || !lesson_(raw.lessonId) || !plain_(raw.result)) fail_('INVALID_EVENT', 'รูปแบบกิจกรรมไม่ถูกต้อง');
  var stages = {game: ['g1', 'g2', 'g3'], exercise: ['e1', 'e2', 'e3'], onet: ['onet'], simulation: ['simulation'], exam: ['exam']};
  if (!Object.prototype.hasOwnProperty.call(stages, raw.kind) || stages[raw.kind].indexOf(raw.stage) < 0) fail_('INVALID_EVENT', 'ประเภทกิจกรรมไม่ถูกต้อง');
  if (!Number.isSafeInteger(raw.occurredAt) || raw.occurredAt < 0 || raw.occurredAt > now + 300000) fail_('INVALID_EVENT', 'เวลาของกิจกรรมไม่ถูกต้อง');
  validateTree_(raw.result, 0, {count: 0});
  var result = JSON.parse(JSON.stringify(raw.result));
  if (raw.kind === 'exam') {
    if (result.total !== 20 || !Number.isInteger(result.score) || result.score < 0 || result.score > 20 || result.pct !== Math.round(result.score / 20 * 100) || result.passed !== (result.pct >= 60)) fail_('INVALID_EVENT', 'ข้อมูลคะแนนสอบไม่สอดคล้องกัน');
    validateResponses_(result, 20);
    if (!Number.isSafeInteger(result.started) || result.started < 0 || result.started > raw.occurredAt) fail_('INVALID_EVENT', 'เวลาเริ่มสอบไม่ถูกต้อง');
  } else if (raw.kind === 'exercise') {
    if (result.total !== 6 || !Number.isInteger(result.score) || result.score < 0 || result.score > 6 || result.pct !== Math.round(result.score / 6 * 100) || result.passed !== (result.score === 6)) fail_('INVALID_EVENT', 'ข้อมูลคะแนนแบบฝึกไม่สอดคล้องกัน');
    validateResponses_(result, 6);
  } else if (raw.kind === 'game') {
    if (!Number.isSafeInteger(result.attempt) || result.attempt < 1 || typeof result.passed !== 'boolean' || typeof result.done !== 'boolean' || typeof result.correct !== 'boolean' || typeof result.gameType !== 'string' || !result.gameType || result.gameType.length > 80) fail_('INVALID_EVENT', 'ข้อมูลผลเกมไม่ถูกต้อง');
  } else if (raw.kind === 'onet') {
    if (typeof result.questionId !== 'string' || !result.questionId || result.questionId.length > 120 || ![1, 2, 3, 4].includes(result.answer) || ![1, 2, 3, 4].includes(result.correct) || result.total !== 1 || result.score !== (result.answer === result.correct ? 1 : 0) || result.pct !== result.score * 100 || result.passed !== (result.score === 1)) fail_('INVALID_EVENT', 'ข้อมูลผล O-NET ไม่ถูกต้อง');
  } else if (raw.kind === 'simulation') {
    if (!plain_(result.values) || !Array.isArray(result.metrics) || result.metrics.length > 100 || typeof result.summary !== 'string' || result.explored !== true) fail_('INVALID_EVENT', 'ข้อมูลผล Simulation ไม่ถูกต้อง');
  }
  result.clientReported = true;
  if (JSON.stringify(result).length > 45000) fail_('INVALID_EVENT', 'ข้อมูลกิจกรรมมีขนาดใหญ่เกินไป');
  return {id: raw.id, lessonId: raw.lessonId, kind: raw.kind, stage: raw.stage, occurredAt: raw.occurredAt, result: result};
}
function validateResponses_(result, count) {
  if (!Array.isArray(result.responses) || result.responses.length !== count) fail_('INVALID_EVENT', 'ข้อมูลคำตอบไม่ครบ');
  var correct = 0;
  result.responses.forEach(function (response) {
    if (!plain_(response) || typeof response.selected !== 'string' || typeof response.correct !== 'string' || typeof response.ok !== 'boolean' || response.ok !== (response.selected === response.correct)) fail_('INVALID_EVENT', 'ข้อมูลคำตอบไม่สอดคล้องกัน');
    if (response.ok) correct++;
  });
  if (correct !== result.score) fail_('INVALID_EVENT', 'คะแนนไม่สอดคล้องกับคำตอบที่ส่ง');
}
function sync_(token, payload) {
  var db = database_(), session = session_(token, db), actor = session.account.id;
  if (!Array.isArray(payload.events) || !payload.events.length || payload.events.length > SLH.maxBatch) fail_('INVALID_REQUEST', 'ส่งกิจกรรมได้ครั้งละ 1–100 รายการ');
  var now = Date.now(), events = payload.events.map(function (raw) { return event_(raw, now); });
  var sheet = table_(db, SLH.events, SLH.eventHeaders), existing = Object.create(null);
  rows_(sheet, SLH.eventHeaders.length).forEach(function (row) { if (String(row[2]) === actor) existing[String(row[0])] = String(row[10]); });
  var newRows = [], acknowledged = [], duplicates = 0;
  events.forEach(function (event) {
    var key = sha_(actor + '\u001f' + event.id), fingerprint = sha_(canonical_(event));
    if (existing[key]) {
      if (existing[key] !== fingerprint) fail_('EVENT_CONFLICT', 'รหัสกิจกรรมเดิมมีข้อมูลต่างกัน กรุณาติดต่อครู');
      duplicates++;
    } else {
      existing[key] = fingerprint;
      newRows.push([key, event.id, actor, SLH.year, event.lessonId, event.kind, event.stage, event.occurredAt, now, JSON.stringify(event.result), fingerprint]);
    }
    acknowledged.push(event.id);
  });
  // All records are validated and conflicts checked before a single batch append.
  append_(sheet, newRows);
  return {acknowledged: acknowledged, accepted: newRows.length, duplicates: duplicates, clientReported: true};
}
function teacher_(session) {
  if (!session.account.roles.some(function (role) { return role === 'Teacher' || role === 'Admin'; })) fail_('FORBIDDEN', 'เฉพาะครูหรือผู้ดูแลระบบ');
}
function page_(payload) {
  var offset = payload.offset === undefined ? 0 : Number(payload.offset), limit = payload.limit === undefined ? 100 : Number(payload.limit);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) fail_('INVALID_REQUEST', 'ช่วงข้อมูลไม่ถูกต้อง');
  return {offset: offset, limit: limit};
}
function eventFromRow_(r) {
  var result; try { result = JSON.parse(r[9]); } catch (_) { fail_('DATA_ERROR', 'ข้อมูลกิจกรรมไม่สมบูรณ์ กรุณาติดต่อผู้ดูแล'); }
  return {id: String(r[1]), studentId: String(r[2]), lessonId: String(r[4]), kind: String(r[5]), stage: String(r[6]), occurredAt: Number(r[7]), receivedAt: Number(r[8]), result: result, clientReported: true};
}
function summary_(token, payload) {
  var db = database_(), session = session_(token, db); teacher_(session);
  var page = page_(payload), grade = payload.grade === undefined || payload.grade === '' ? null : Number(payload.grade), room = String(payload.room || ''), student = String(payload.student || ''), lessonId = String(payload.lessonId || '');
  if ((grade !== null && ![1, 2, 3].includes(grade)) || room.length > 50 || student.length > 120 || (lessonId && !lesson_(lessonId))) fail_('INVALID_REQUEST', 'ตัวกรองไม่ถูกต้อง');
  var allStudents = Object.keys(session.accounts).map(function (id) { return session.accounts[id]; }).filter(function (account) { return account.roles.indexOf('Student') >= 0; });
  var selected = allStudents.filter(function (account) { return (grade === null || account.grade === grade) && (!room || account.room === room) && (!student || account.id === student || account.name.toLowerCase().indexOf(student.toLowerCase()) >= 0); });
  var students = Object.create(null), groups = Object.create(null), lessons = new Set();
  selected.forEach(function (account) { students[account.id] = account; });
  function group(account, id) {
    var key = account.id + '\u001f' + id;
    if (!groups[key]) groups[key] = {studentId: account.id, username: account.id, name: account.name, grade: account.grade, room: account.room, number: account.number, lessonId: id, games: {}, exercises: {}, onet: null, simulation: null, exam: {last: null, best: null, attempts: 0, lastAt: null}, clientReported: true, _times: {}};
    return groups[key];
  }
  var seenStudents = new Set();
  // Single bulk scan; no per-student or per-lesson spreadsheet calls.
  rows_(table_(db, SLH.events, SLH.eventHeaders), SLH.eventHeaders.length).forEach(function (r) {
    if (String(r[3]) !== SLH.year) return;
    lessons.add(String(r[4]));
    var account = students[String(r[2])];
    if (!account || (lessonId && String(r[4]) !== lessonId)) return;
    var event = eventFromRow_(r), row = group(account, event.lessonId), timeKey = event.occurredAt, previous = row._times[event.stage];
    seenStudents.add(account.id);
    if (event.kind === 'exam') {
      row.exam.attempts++;
      row.exam.best = row.exam.best === null ? event.result.pct : Math.max(row.exam.best, event.result.pct);
      if (row.exam.lastAt === null || timeKey > row.exam.lastAt || (timeKey === row.exam.lastAt && event.id > (row._times.examId || ''))) {
        row.exam.last = event.result.pct; row.exam.lastAt = timeKey; row._times.examId = event.id;
      }
    } else if (!previous || timeKey > previous.at || (timeKey === previous.at && event.id > previous.id)) {
      row._times[event.stage] = {at: timeKey, id: event.id};
      if (event.kind === 'game') row.games[event.stage] = event.result;
      else if (event.kind === 'exercise') row.exercises[event.stage] = event.result;
      else if (event.kind === 'simulation') row.simulation = event.result;
      else if (event.kind === 'onet') row.onet = event.result;
    }
  });
  selected.forEach(function (account) { if (!seenStudents.has(account.id)) group(account, lessonId); });
  var resultRows = Object.keys(groups).map(function (key) { var row = groups[key]; delete row._times; return row; });
  resultRows.sort(function (a, b) { return a.grade - b.grade || a.room.localeCompare(b.room, 'th', {numeric: true}) || Number(a.number) - Number(b.number) || a.username.localeCompare(b.username) || a.lessonId.localeCompare(b.lessonId); });
  return {rows: resultRows.slice(page.offset, page.offset + page.limit), total: resultRows.length, offset: page.offset, limit: page.limit, academicYear: SLH.year, clientReported: true, filters: {grades: Array.from(new Set(allStudents.map(function (a) { return a.grade; }))).sort(), rooms: Array.from(new Set(allStudents.map(function (a) { return a.room; }))).sort(function (a, b) { return a.localeCompare(b, 'th', {numeric: true}); }), lessons: Array.from(lessons).sort()}};
}
function history_(token, payload) {
  var db = database_(), session = session_(token, db); teacher_(session);
  var studentId = String(payload.studentId || ''), lessonId = String(payload.lessonId || ''), page = page_(payload), student = session.accounts[studentId];
  if (!student || student.roles.indexOf('Student') < 0 || (lessonId && !lesson_(lessonId))) fail_('INVALID_REQUEST', 'ไม่พบรายการที่ต้องการ');
  var rows = rows_(table_(db, SLH.events, SLH.eventHeaders), SLH.eventHeaders.length).filter(function (r) { return String(r[2]) === studentId && String(r[3]) === SLH.year && String(r[5]) === 'exam' && (!lessonId || String(r[4]) === lessonId); }).map(eventFromRow_);
  rows.sort(function (a, b) { return b.occurredAt - a.occurredAt || b.id.localeCompare(a.id); });
  return {rows: rows.slice(page.offset, page.offset + page.limit), total: rows.length, offset: page.offset, limit: page.limit, clientReported: true};
}
function locked_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) fail_('BUSY', 'ระบบกำลังบันทึกข้อมูล กรุณาลองอีกครั้ง');
  try { var result = callback(); SpreadsheetApp.flush(); return result; } finally { lock.releaseLock(); }
}
function fail_(code, message) { var error = new Error(message); error.slhCode = code; throw error; }
function json_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
