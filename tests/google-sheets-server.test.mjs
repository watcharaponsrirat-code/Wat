import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../integrations/google-sheets/Code.gs', import.meta.url), 'utf8');
function harness({count = 907, setup = true} = {}) {
  class Sheet {
    constructor(name, rows = []) { this.name = name; this.rows = rows.map(row => [...row]); this.writes = 0; }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
    getDataRange() { return this.getRange(1, 1, this.rows.length || 1, this.getLastColumn() || 1); }
    setFrozenRows() {}
    getRange(row, column, height, width) {
      const sheet = this;
      return {
        getValues() { return Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => sheet.rows[row + y - 1]?.[column + x - 1] ?? '')); },
        getDisplayValues() { return this.getValues().map(r => r.map(String)); },
        setValues(rows) {
          assert.equal(rows.length, height);
          rows.forEach((values, y) => {
            assert.equal(values.length, width);
            sheet.rows[row + y - 1] ||= [];
            values.forEach((value, x) => {
              // Model Sheets' leading apostrophe text escape and reject active formulas.
              assert(!(typeof value === 'string' && /^[=+\-@\t\r\n]/.test(value)), 'write must not become a formula');
              sheet.rows[row + y - 1][column + x - 1] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
            });
          });
          sheet.writes++;
          return this;
        }
      };
    }
  }
  const propertyValues = {SLH_SPREADSHEET_ID: 'synthetic-spreadsheet-identity-only'};
  const properties = {
    getProperty(key) { return propertyValues[key] ?? null; },
    setProperty(key, value) { propertyValues[key] = String(value); },
    getProperties() { return {...propertyValues}; },
    setProperties(values) { Object.assign(propertyValues, values); },
    deleteProperty(key) { delete propertyValues[key]; }
  };
  const sheets = new Map();
  const database = {getSheetByName(name) { return sheets.get(name) || null; }, insertSheet(name) { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; }};
  let clock = Date.now(), lockAllowed = true, lockHeld = false, flushes = 0;
  const logs = [];
  class Clock extends Date { static now() { return clock; } }
  const context = vm.createContext({
    Date: Clock,
    PropertiesService: {getScriptProperties() { return properties; }},
    SpreadsheetApp: {openById(id) { assert.equal(id, propertyValues.SLH_SPREADSHEET_ID); return database; }, flush() { assert(lockHeld, 'writes must flush while lock is held'); flushes++; }},
    console: {log(text) { logs.push(String(text)); }},
    LockService: {getScriptLock() { return {tryLock() { if (!lockAllowed || lockHeld) return false; lockHeld = true; return true; }, releaseLock() { assert(lockHeld); lockHeld = false; }}; }},
    Utilities: {DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'}, getUuid: randomUUID, computeDigest(algorithm, value, encoding) { return [...createHash(algorithm).update(value, encoding).digest()]; }},
    ContentService: {MimeType: {JSON: 'application/json'}, createTextOutput(text) { return {text, setMimeType() { return this; }}; }}
  });
  vm.runInContext(source, context);
  const password = randomUUID(), staffPassword = randomUUID();
  const studentRows = Array.from({length: count}, (_, i) => [String(i + 1).padStart(5, '0'), 'Fixture ', 'Student', String(i + 1), String(i % 3 + 1), String(i % 5 + 1).padStart(2, '0'), String(i + 1), 'fixture' + String(i + 1).padStart(4, '0'), password, 'student', '2569']);
  const students = new Sheet('Students', [[...context.SLH.studentHeaders], ...studentRows]);
  const staff = new Sheet('Staff', [[...context.SLH.staffHeaders], ['watcharapon', staffPassword, 'teacher', 'admin', 'เตรียมข้อมูล', 'synthetic fixture, not real account data']]);
  sheets.set('Students', students); sheets.set('Staff', staff);
  function call(action, payload = {}, token) { return JSON.parse(context.doPost({postData: {contents: JSON.stringify({action, payload, token})}}).text); }
  function login(username = 'fixture0001') { const result = call('login', {username, password: username === 'watcharapon' ? staffPassword : password}); assert.equal(result.ok, true, JSON.stringify(result)); return result.data; }
  if (setup) context.setup();
  return {context, sheets, students, staff, properties, propertyValues, password, staffPassword, call, login, logs, getFlushes() { return flushes; }, setClock(value) { clock = value; }, now() { return clock; }, setLock(value) { lockAllowed = value; }};
}
function responses(count, score) { return Array.from({length: count}, (_, i) => ({selected: i < score ? 'a' : 'b', correct: 'a', ok: i < score})); }
function exam(id, occurredAt, score = 16, lessonId = 'G1U1L1') {
  return {id, lessonId, kind: 'exam', stage: 'exam', occurredAt, result: {pct: score * 5, score, total: 20, passed: score >= 12, started: occurredAt - 60000, responses: responses(20, score), version: 3}};
}

test('setup is additive, idempotent, validates 907, and never modifies the source account tabs', () => {
  const h = harness({setup: false});
  const original = JSON.stringify([h.students.rows, h.staff.rows]);
  const originalProperties = JSON.stringify(h.propertyValues);
  assert.equal(h.context.inspectSetup().studentCount, 907);
  assert.equal(h.sheets.size, 2);
  assert.equal(JSON.stringify(h.propertyValues), originalProperties);
  assert(!JSON.stringify(h.logs).includes(h.password));
  assert(!JSON.stringify(h.logs).includes(h.staffPassword));
  assert.equal(h.context.setup().studentCount, 907);
  h.context.setup();
  assert.equal(h.getFlushes(), 2);
  assert.equal(JSON.stringify([h.students.rows, h.staff.rows]), original);
  assert.equal(h.students.writes + h.staff.writes, 0);
  assert.deepEqual([...h.sheets.keys()], ['Students', 'Staff', 'SLH_Events', 'SLH_Sessions']);
  const bad = harness({count: 906, setup: false});
  assert.throws(() => bad.context.setup(), /907/);
  assert.equal(bad.sheets.size, 2, 'validation precedes app tab creation');
  h.sheets.get('SLH_Events').rows[0][0] = 'wrong';
  assert.throws(() => h.context.setup(), /โครงสร้าง/);
});

test('login keeps original IDs and display zeroes, grants roles server-side and never exposes passwords', () => {
  const h = harness(), student = h.login(), staff = h.login('watcharapon');
  assert.equal(student.user.id, 'fixture0001'); assert.equal(student.user.room, '01');
  assert.deepEqual(student.user.roles, ['Student']);
  assert.deepEqual(staff.user.roles, ['Teacher', 'Admin']); assert.equal(staff.user.teacher, true); assert.equal(staff.user.admin, true);
  assert(!JSON.stringify(student).includes(h.password)); assert(!JSON.stringify(staff).includes(h.staffPassword));
  assert(!JSON.stringify(h.sheets.get('SLH_Sessions').rows).includes(student.token), 'session stores only token hashes');
  assert.equal(h.call('teacherSummary', {roles: ['Admin'], user: {id: 'watcharapon'}}, student.token).error.code, 'FORBIDDEN');
  assert.equal(h.call('examHistory', {studentId: 'fixture0002'}, student.token).error.code, 'FORBIDDEN');
  assert.equal(h.call('sync', {events: [exam('forged', h.now())]}, 'a'.repeat(64)).error.code, 'UNAUTHENTICATED');
  assert.equal(h.call('login', {username: 'missing', password: 'invalid'}).error.code, 'INVALID_CREDENTIALS');
  assert.equal(h.call('login', {username: 'fixture0001', password: 'invalid'}).error.code, 'INVALID_CREDENTIALS');
  assert.deepEqual(Object.keys(JSON.parse(h.context.doGet().text).data).sort(), ['protocol', 'service']);
});

test('expired/revoked/disabled account sessions fail, and logout is idempotent', () => {
  const h = harness(), first = h.login(), other = h.login('fixture0002');
  assert.equal(h.call('logout', {}, first.token).ok, true);
  assert.equal(h.call('logout', {}, first.token).ok, true);
  assert.equal(h.call('sync', {events: [exam('revoked', h.now())]}, first.token).error.code, 'UNAUTHENTICATED');
  h.setClock(other.expiresAt);
  assert.equal(h.call('sync', {events: [exam('expired', h.now())]}, other.token).error.code, 'UNAUTHENTICATED');
  const staff = h.login('watcharapon');
  h.staff.rows[1][4] = 'inactive';
  assert.equal(h.call('teacherSummary', {}, staff.token).error.code, 'UNAUTHENTICATED');
});

test('persistent idempotency, batch atomic validation, actor separation and conflict rejection', () => {
  const h = harness(), student = h.login(), other = h.login('fixture0002'), event = exam('unique-attempt', h.now());
  let result = h.call('sync', {events: [event, event], studentId: 'fixture0002'}, student.token);
  assert.equal(result.data.accepted, 1); assert.equal(result.data.duplicates, 1);
  result = h.call('sync', {events: [event]}, student.token);
  assert.equal(result.data.accepted, 0); assert.equal(result.data.duplicates, 1);
  assert.equal(h.sheets.get('SLH_Events').rows[1][2], 'fixture0001');
  assert.equal(h.call('sync', {events: [event]}, other.token).data.accepted, 1, 'same event ID belongs to a separate actor');
  const before = h.sheets.get('SLH_Events').rows.length;
  const conflict = exam(event.id, h.now(), 1);
  result = h.call('sync', {events: [exam('valid-but-batch-conflicts', h.now()), conflict]}, student.token);
  assert.equal(result.error.code, 'EVENT_CONFLICT'); assert.equal(h.sheets.get('SLH_Events').rows.length, before);
  result = h.call('sync', {events: [exam('valid-but-batch-invalid', h.now()), {...exam('invalid', h.now()), result: {score: 25, pct: 125, total: 20, passed: true, responses: []}}]}, student.token);
  assert.equal(result.error.code, 'INVALID_EVENT'); assert.equal(h.sheets.get('SLH_Events').rows.length, before);
  assert.equal(h.call('sync', {events: [{...event, id: 'invalid-kind', kind: '__proto__'}]}, student.token).error.code, 'INVALID_EVENT');
  assert.equal(h.call('sync', {events: [{...event, id: 'invalid-lesson', lessonId: '=IMPORTXML()'}]}, student.token).error.code, 'INVALID_EVENT');
  const eventRecord = h.sheets.get('SLH_Events').rows[1];
  assert.equal(JSON.parse(eventRecord[9]).clientReported, true);
});

test('retains every exam and computes latest/best by occurredAt despite delayed retry', () => {
  const h = harness(), student = h.login(), staff = h.login('watcharapon');
  const initial = Array.from({length: 15}, (_, i) => exam('exam-' + i, h.now() - 1000 * (15 - i), i + 1));
  assert.equal(h.call('sync', {events: initial}, student.token).data.accepted, 15);
  const last = exam('newest-low-score', h.now(), 2);
  h.call('sync', {events: [last]}, student.token);
  h.call('sync', {events: [exam('delayed-old-best', h.now() - 30000, 20)]}, student.token);
  h.call('sync', {events: [last]}, student.token);
  const summary = h.call('teacherSummary', {grade: 1, room: '01', lessonId: 'G1U1L1', student: student.user.id}, staff.token);
  assert.equal(summary.ok, true); assert.equal(summary.data.total, 1);
  assert.deepEqual(summary.data.rows[0].exam, {last: 10, best: 100, attempts: 17, lastAt: h.now()});
  const history = h.call('examHistory', {studentId: student.user.id, lessonId: 'G1U1L1', limit: 10}, staff.token);
  assert.equal(history.data.total, 17); assert.equal(history.data.rows.length, 10); assert.equal(history.data.rows[0].id, last.id);
  const next = h.call('examHistory', {studentId: student.user.id, offset: 10, limit: 10}, staff.token);
  assert.equal(next.data.rows.length, 7); assert.equal(next.data.rows.at(-1).id, 'delayed-old-best');
  assert.equal(h.call('teacherSummary', {limit: 200}, staff.token).data.total, 907, 'students with no results are included');
  assert.equal(h.call('teacherSummary', {student: 'no-such-name'}, staff.token).data.total, 0);
});

test('all games/exercises/O-NET/simulation are retained and late delivery cannot regress latest result', () => {
  const h = harness(), student = h.login(), staff = h.login('watcharapon');
  const stages = [['game', 'g1'], ['game', 'g2'], ['game', 'g3'], ['exercise', 'e1'], ['exercise', 'e2'], ['exercise', 'e3'], ['onet', 'onet'], ['simulation', 'simulation']];
  const results = {
    game: {attempt: 1, passed: true, done: true, correct: true, gameType: 'memory', label: '=DANGEROUS()'},
    exercise: {score: 6, total: 6, pct: 100, passed: true, responses: responses(6, 6)},
    onet: {questionId: 'fixture-onet', answer: 1, correct: 1, score: 1, total: 1, pct: 100, passed: true},
    simulation: {values: {temperature: 20}, metrics: [['temperature', 20]], summary: 'Synthetic result', explored: true}
  };
  const events = stages.map(([kind, stage]) => ({id: 'new-' + stage, kind, stage, lessonId: 'G2U2L1', occurredAt: h.now(), result: results[kind]}));
  assert.equal(h.call('sync', {events}, student.token).data.accepted, 8);
  const old = {...events[0], id: 'delayed-game', occurredAt: h.now() - 1000, result: {...results.game, passed: false}};
  h.call('sync', {events: [old]}, student.token);
  const summary = h.call('teacherSummary', {student: student.user.id}, staff.token).data.rows[0];
  assert.deepEqual(Object.keys(summary.games).sort(), ['g1', 'g2', 'g3']);
  assert.deepEqual(Object.keys(summary.exercises).sort(), ['e1', 'e2', 'e3']);
  assert.equal(summary.games.g1.passed, true); assert.equal(summary.simulation.explored, true); assert.equal(summary.onet.score, 1);
  assert.equal(summary.games.g1.label, '=DANGEROUS()', 'JSON content is inert, preserved text');
  assert.equal(h.context.cell_('=IMPORTXML()'), "'=IMPORTXML()");
  const invalid = [{...events[0], id: 'bad-game', result: {...results.game, attempt: -1}}, {...events[3], id: 'bad-exercise', result: {...results.exercise, score: 7}}, {...events[6], id: 'bad-onet', result: {...results.onet, answer: 5}}, {...events[7], id: 'bad-simulation', result: {...results.simulation, metrics: 'bad'}}];
  invalid.forEach(event => assert.equal(h.call('sync', {events: [event]}, student.token).error.code, 'INVALID_EVENT'));
});

test('login throttle and lock fail closed without authenticating or writing scores', () => {
  const h = harness();
  for (let i = 0; i < 10; i++) assert.equal(h.call('login', {username: 'unknown-fixture', password: 'wrong'}).error.code, 'INVALID_CREDENTIALS');
  assert.equal(h.call('login', {username: 'unknown-fixture', password: 'wrong'}).error.code, 'RATE_LIMITED');
  h.setClock(h.now() + 900001);
  assert.equal(h.call('login', {username: 'unknown-fixture', password: 'wrong'}).error.code, 'INVALID_CREDENTIALS');
  const student = h.login();
  h.setLock(false);
  assert.equal(h.call('login', {username: 'fixture0001', password: h.password}).error.code, 'BUSY');
  assert.equal(h.call('sync', {events: [exam('busy', h.now())]}, student.token).error.code, 'BUSY');
  assert.equal(h.sheets.get('SLH_Events').rows.length, 1);
  h.setLock(true);
  h.propertyValues['SLH_RATE_corrupt'] = '{';
  assert.equal(h.call('login', {username: 'fixture0001', password: h.password}).error.code, 'UNAVAILABLE');
  assert.equal(h.call('teacherSummary', {}, 'x'.repeat(64)).error.code, 'UNAUTHENTICATED');
});

test('real website game 1–3, exercise 1–3, simulation, O-NET and exam hooks satisfy the Apps Script contract', async () => {
  // Reuse the existing DOM harness and its complete exercise regression. The
  // events below come from actual production handlers, not hand-built payloads.
  const {harness: frontendHarness} = await import('./exercise-regression.mjs');
  const site = frontendHarness(), captured = [], backend = harness(), student = backend.login();
  const sheets = site.context.window.SLH_SHEETS;
  sheets.enabled = () => true;
  sheets.mountStatus = () => {};
  sheets.event = (lessonId, kind, stage, result) => ({id: randomUUID(), lessonId, kind, stage, occurredAt: Date.now(), result});
  sheets.queue = event => captured.push(JSON.parse(JSON.stringify(event)));
  site.qa.login();
  const id = 'G1U1L1', catalog = site.context.window.SLH_GAME_CATALOG[id];
  catalog.forEach((game, index) => {
    const stage = 'g' + (index + 1);
    site.qa.open(id, stage);
    if (game.type === 'evidence') {
      game.cards.forEach((card, i) => { if (card.correct) site.click('[data-arc-evidence="' + i + '"]'); });
      site.click('[data-arc-check]');
    } else if (game.type === 'memory') {
      const deck = site.qa.snapshot(id).games[stage].state.deck;
      const pair = deck[0].pair;
      deck.forEach((card, i) => { if (card.pair === pair) site.click('[data-arc-flip="' + i + '"]'); });
    } else if (game.type === 'mission') {
      const choices = site.qa.snapshot(id).games[stage].state.options[0];
      site.click('[data-arc-answer="' + choices.indexOf(game.items[0].answer) + '"]');
    } else assert.fail('Extend contract solver for new initial game type: ' + game.type);
  });
  for (const stage of ['e1', 'e2', 'e3']) {
    site.qa.open(id, stage);
    site.qa.snapshot(id).ex[stage].state.qs.forEach((question, i) => {
      const option = site.context.document.querySelectorAll('[data-ex-q="' + i + '"]').find(button => button.dataset.exO === question.correct);
      assert(option); option.onclick();
    });
    site.click('[data-ex-check]');
  }
  const original = site.context.window.SLH_ONET.questions[0];
  site.qa.open(original.lesson, 'e3');
  site.click('[data-onet-id="' + original.id + '"][data-onet-answer="' + original.key + '"]');
  site.click('[data-onet-check="' + original.id + '"]');
  site.qa.open(id, 'lab');
  site.click('[data-sim-reset]');
  site.context.window.SLH_SIM_ENGINE.stop();
  // Exercise the largest final-exam form against the result size validation.
  const bank = site.context.window.SLH_FINAL_EXAMS.bank;
  const examId = Object.keys(bank).sort((a, b) => JSON.stringify(bank[b]).length - JSON.stringify(bank[a]).length)[0];
  site.qa.open(examId, 'exam');
  const questions = site.qa.snapshot(examId).exam.current.qs;
  questions.forEach((question, i) => {
    const option = site.context.document.querySelectorAll('[data-exam-choice]').find(button => button.dataset.examChoice === question.correct);
    assert(option); option.onclick();
    if (i < questions.length - 1) site.click('[data-exam-next]');
  });
  site.click('[data-exam-submit]');
  assert.deepEqual([...new Set(captured.map(event => event.stage))].sort(), ['e1', 'e2', 'e3', 'exam', 'g1', 'g2', 'g3', 'onet', 'simulation']);
  const result = backend.call('sync', {events: captured}, student.token);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.accepted, captured.length);
  assert.equal(backend.call('sync', {events: captured}, student.token).data.accepted, 0, 'replaying actual payloads remains idempotent');
});
