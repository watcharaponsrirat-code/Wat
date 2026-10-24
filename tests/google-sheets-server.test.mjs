import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {harness, responses, exam} from './helpers/google-sheets-harness.mjs';

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
  assert.deepEqual([...h.sheets.keys()], ['Students', 'Staff', 'SLH_Events', 'SLH_Sessions', 'SLH_Teachers']);
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

function createTeacher(h, admin, id, rooms = []) {
  const password = randomUUID();
  const created = h.call('adminCreateTeacher', {username: id, name: 'Fixture teacher ' + id, password}, admin.token);
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(h.call('adminUpdateTeacher', {teacherId: id, term: '2', rooms}, admin.token).ok, true);
  const login = h.call('login', {username: id, password});
  assert.equal(login.ok, true, JSON.stringify(login));
  return {...login.data, password};
}

test('room-scoped APIs deny every outside-room path and do not leak filters or scan scores for rosters', () => {
  const h = harness(), admin = h.login('watcharapon'), studentA = h.login(), studentB = h.login('fixture0002');
  const teacher = createTeacher(h, admin, 'fixture_teacher_a', [{grade: 1, room: '01'}]);
  h.call('sync', {events: [exam('a-high', h.now() - 1000, 20), exam('a-low', h.now(), 4)]}, studentA.token);
  h.call('sync', {events: [exam('b-private', h.now(), 17, 'G2U3L9')]}, studentB.token);
  const options = h.call('teacherOptions', {}, teacher.token);
  assert.deepEqual(options.data, {academicYear: '2569', term: '2', rooms: [{grade: 1, room: '01'}], isAdmin: false});
  const ledger = h.sheets.get('SLH_Events'), initialReads = ledger.reads;
  const firstPage = h.call('teacherRoster', {grade: 1, room: '01', limit: 2}, teacher.token).data;
  assert.equal(firstPage.rows.length, 2); assert(firstPage.total > 2);
  assert.deepEqual(firstPage.rows.map(row => row.id), ['fixture0001', 'fixture0016']);
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01', offset: 2, limit: 2}, teacher.token).data.rows[0].id, 'fixture0031');
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01', student: 'TURE0001'}, teacher.token).data.total, 1);
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01', student: 'student 16'}, teacher.token).data.rows[0].id, 'fixture0016');
  assert.equal(ledger.reads, initialReads, 'roster and options must not read score ledger');
  const summary = h.call('teacherSummary', {}, teacher.token).data;
  assert(summary.rows.every(row => row.grade === 1 && row.room === '01'));
  assert.deepEqual(summary.filters, {grades: [1], rooms: ['01'], lessons: ['G1U1L1']});
  assert.deepEqual(h.call('studentResults', {studentId: studentA.user.id, lessonId: 'G1U1L1'}, teacher.token).data.result.exam, {last: 20, best: 100, attempts: 2, lastAt: h.now()});
  assert.equal(h.call('examHistory', {studentId: studentA.user.id, lessonId: 'G1U1L1'}, teacher.token).data.total, 2);
  for (const [action, payload] of [
    ['teacherRoster', {grade: 2, room: '02', student: 'no-such-student'}],
    ['teacherSummary', {grade: 2, room: '02'}], ['teacherSummary', {room: '02'}],
    ['teacherSummary', {student: studentB.user.id}],
    ['studentResults', {studentId: studentB.user.id, lessonId: 'G2U3L9'}],
    ['examHistory', {studentId: studentB.user.id}]
  ]) assert.equal(h.call(action, payload, teacher.token).error.code, 'FORBIDDEN', action);
  assert.equal(h.call('teacherRoster', {room: '01'}, teacher.token).error.code, 'INVALID_REQUEST');
  assert.equal(h.call('studentResults', {studentId: studentA.user.id}, teacher.token).error.code, 'INVALID_REQUEST');
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01', limit: 201}, teacher.token).error.code, 'INVALID_REQUEST');
  assert.equal(h.call('teacherRoster', {grade: 2, room: '02'}, admin.token).ok, true);
  assert.equal(h.call('studentResults', {studentId: studentB.user.id, lessonId: 'G2U3L9'}, admin.token).data.result.exam.best, 85);
  assert.equal(h.call('teacherSummary', {}, admin.token).data.total, 907);
  assert.equal(h.call('teacherOptions', {}, admin.token).data.rooms.length, 15);
  for (const action of ['teacherOptions', 'teacherRoster', 'studentResults', 'teacherSummary', 'examHistory', 'adminTeachers', 'adminCreateTeacher', 'adminUpdateTeacher']) {
    assert.equal(h.call(action, {}, studentA.token).error.code, 'FORBIDDEN', action);
  }
  for (const action of ['adminTeachers', 'adminCreateTeacher', 'adminUpdateTeacher']) assert.equal(h.call(action, {}, teacher.token).error.code, 'FORBIDDEN', action);
});

test('same-token revocation, disabled accounts and current-term changes apply immediately without deleting source or scores', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login();
  h.call('sync', {events: [exam('retained-before-management', h.now(), 20)]}, student.token);
  const originals = JSON.stringify([h.students.rows, h.staff.rows, h.sheets.get('SLH_Events').rows]);
  const rooms = [{grade: 1, room: '01'}, {grade: 2, room: '02'}];
  const teacherA = createTeacher(h, admin, 'fixture_multi_a', rooms), teacherB = createTeacher(h, admin, 'fixture_multi_b', rooms);
  assert.equal(h.call('teacherOptions', {}, teacherA.token).data.rooms.length, 2);
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01'}, teacherB.token).ok, true, 'many teachers can share a room');
  h.call('adminUpdateTeacher', {teacherId: teacherA.user.id, term: '2', rooms: [{grade: 2, room: '02'}]}, admin.token);
  for (const [action, payload] of [
    ['teacherRoster', {grade: 1, room: '01'}], ['teacherSummary', {grade: 1, room: '01'}],
    ['studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}], ['examHistory', {studentId: student.user.id}]
  ]) assert.equal(h.call(action, payload, teacherA.token).error.code, 'FORBIDDEN', 'same session after revoke: ' + action);
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01'}, teacherB.token).ok, true);
  h.call('adminUpdateTeacher', {teacherId: teacherA.user.id, term: '2', enabled: false}, admin.token);
  assert.equal(h.call('teacherOptions', {}, teacherA.token).error.code, 'UNAUTHENTICATED');
  assert.equal(h.call('sync', {events: [exam('disabled-write', h.now())]}, teacherA.token).error.code, 'UNAUTHENTICATED');
  assert.equal(h.call('login', {username: teacherA.user.id, password: teacherA.password}).error.code, 'INVALID_CREDENTIALS');
  assert.equal(h.call('adminTeachers', {}, admin.token).data.rows.find(row => row.id === teacherA.user.id).enabled, false);
  h.call('adminUpdateTeacher', {teacherId: teacherA.user.id, term: '2', enabled: true}, admin.token);
  assert.equal(h.call('login', {username: teacherA.user.id, password: teacherA.password}).ok, true);
  h.properties.setProperty('SLH_CURRENT_TERM', '1');
  assert.deepEqual(h.call('teacherOptions', {}, teacherB.token).data.rooms, [], 'assignments are not inherited across terms');
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01'}, teacherB.token).error.code, 'FORBIDDEN');
  assert.equal(h.call('adminUpdateTeacher', {teacherId: teacherB.user.id, term: '2', rooms: []}, admin.token).error.code, 'STALE_TERM');
  assert.equal(h.call('studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}, admin.token).data.result.exam.best, 100, 'year 2569 scores remain visible in the selected term');
  h.properties.setProperty('SLH_CURRENT_TERM', '2');
  assert.equal(h.call('teacherOptions', {}, teacherB.token).data.rooms.length, 2);
  assert.equal(h.call('examHistory', {studentId: student.user.id}, teacherB.token).data.total, 1);
  assert.equal(JSON.stringify([h.students.rows, h.staff.rows, h.sheets.get('SLH_Events').rows]), originals);
  assert.equal(h.students.writes + h.staff.writes, 0);
});

test('admin changes are append-only and atomic on malformed requests, protect owner and never return credentials', () => {
  const h = harness(), admin = h.login('watcharapon');
  const teacher = createTeacher(h, admin, 'fixture_account_a', [{grade: 1, room: '01'}]);
  const before = JSON.stringify(h.sheets.get('SLH_Teachers').rows);
  for (const payload of [
    {teacherId: teacher.user.id, term: '2', enabled: false, rooms: [{grade: 1, room: 'missing'}]},
    {teacherId: teacher.user.id, term: '2', enabled: 'false'},
    {teacherId: teacher.user.id, term: '2', rooms: [{grade: 1, room: '01'}, {grade: 1, room: '01'}]},
    {teacherId: teacher.user.id, term: '2', roles: ['Admin']},
    {teacherId: 'fixture0001', term: '2', enabled: false}
  ]) assert.equal(h.call('adminUpdateTeacher', payload, admin.token).error.code, 'INVALID_REQUEST');
  assert.equal(h.call('adminUpdateTeacher', {teacherId: 'watcharapon', term: '2', enabled: false}, admin.token).error.code, 'PROTECTED_ACCOUNT');
  assert.equal(h.call('adminCreateTeacher', {username: 'fixture0001', name: 'Duplicate', password: randomUUID()}, admin.token).error.code, 'ACCOUNT_EXISTS');
  assert.equal(h.call('adminCreateTeacher', {username: 'FIXTURE_ACCOUNT_A', name: 'Duplicate', password: randomUUID()}, admin.token).error.code, 'ACCOUNT_EXISTS');
  for (const payload of [
    {username: 'fixture_new', name: 'Name', password: 'short'},
    {username: 'fixture_new', name: 'Name', password: randomUUID(), roles: ['Admin']},
    {username: '=FORMULA()', name: 'Name', password: randomUUID()}
  ]) assert.equal(h.call('adminCreateTeacher', payload, admin.token).error.code, 'INVALID_REQUEST');
  assert.equal(JSON.stringify(h.sheets.get('SLH_Teachers').rows), before, 'all malformed writes rejected before append');
  const row = h.sheets.get('SLH_Teachers').rows.find(row => row[0] === teacher.user.id);
  assert.match(row[2], /^[a-f0-9]{64}$/); assert.match(row[3], /^[a-f0-9]{64}$/);
  assert(!JSON.stringify(h.sheets.get('SLH_Teachers').rows).includes(teacher.password), 'new teacher plaintext password not stored');
  const created = h.call('adminCreateTeacher', {username: 'fixture_account_b', name: '=Text name', password: teacher.password}, admin.token);
  assert.equal(created.ok, true); assert.deepEqual(created.data.teacher.roles, ['Teacher']);
  const second = h.sheets.get('SLH_Teachers').rows.at(-1);
  assert.notEqual(second[2], row[2]); assert.notEqual(second[3], row[3], 'same password uses a distinct salted hash');
  const list = h.call('adminTeachers', {limit: 2}, admin.token);
  assert.equal(list.data.total, 3); assert.equal(list.data.rows.length, 2);
  const remaining = h.call('adminTeachers', {offset: 2, limit: 2}, admin.token).data.rows[0];
  assert.equal(remaining.id, 'watcharapon'); assert.equal(remaining.protected, true); assert.deepEqual(remaining.roles, ['Teacher', 'Admin']);
  for (const response of [list, created, h.call('teacherOptions', {}, teacher.token)]) {
    const serialized = JSON.stringify(response);
    for (const secret of [teacher.password, row[2], row[3], h.password, h.staffPassword]) assert(!serialized.includes(secret));
    assert(!/password|token|salt|hash/i.test(serialized));
  }
  const teacherRows = h.sheets.get('SLH_Teachers').rows.length;
  h.setLock(false);
  assert.equal(h.call('adminUpdateTeacher', {teacherId: teacher.user.id, term: '2', rooms: []}, admin.token).error.code, 'BUSY');
  assert.equal(h.sheets.get('SLH_Teachers').rows.length, teacherRows);
});

test('existing Staff can be disabled through central overlay, and missing term fails closed for staff operations only', () => {
  const h = harness(), admin = h.login('watcharapon'), staffPassword = randomUUID();
  h.staff.rows.push(['fixture_source_teacher', staffPassword, 'teacher', '', 'active', 'synthetic']);
  const source = JSON.stringify(h.staff.rows), sourceTeacher = h.call('login', {username: 'fixture_source_teacher', password: staffPassword}).data;
  assert.equal(h.call('adminUpdateTeacher', {teacherId: 'fixture_source_teacher', term: '2', rooms: [{grade: 1, room: '01'}]}, admin.token).ok, true);
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01'}, sourceTeacher.token).ok, true);
  h.call('adminUpdateTeacher', {teacherId: 'fixture_source_teacher', term: '2', enabled: false}, admin.token);
  assert.equal(h.call('teacherRoster', {grade: 1, room: '01'}, sourceTeacher.token).error.code, 'UNAUTHENTICATED');
  assert.equal(JSON.stringify(h.staff.rows), source); assert.equal(h.staff.writes, 0);
  h.properties.deleteProperty('SLH_CURRENT_TERM');
  for (const action of ['teacherOptions', 'teacherSummary', 'teacherRoster', 'studentResults', 'examHistory', 'adminTeachers', 'adminCreateTeacher', 'adminUpdateTeacher']) assert.equal(h.call(action, {}, admin.token).error.code, 'NOT_CONFIGURED');
  const student = h.login();
  assert.equal(h.call('sync', {events: [exam('student-continues', h.now())]}, student.token).ok, true);
  assert.throws(() => h.context.inspectSetup(), /SLH_CURRENT_TERM/);
});

test('missing results stay absent, genuine zero stays zero, and Simulation metric pairs are preserved without score conversion', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login();
  let result = h.call('studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}, admin.token).data.result;
  assert.deepEqual(result.games, {}); assert.deepEqual(result.exercises, {}); assert.equal(result.onet, null); assert.equal(result.simulation, null);
  assert.deepEqual(result.exam, {last: null, best: null, attempts: 0, lastAt: null});
  const simulation = {values: {temperature: 0, absent: null}, metrics: [['ค่าจริง', 0], ['พร้อมหน่วย', '0.0 m'], ['ไม่บันทึก', null]], summary: 'Fixture simulation', explored: true};
  const events = [
    {id: 'exercise-zero', kind: 'exercise', stage: 'e1', lessonId: 'G1U1L1', occurredAt: h.now(), result: {score: 0, total: 6, pct: 0, passed: false, responses: responses(6, 0)}},
    {id: 'simulation-metrics', kind: 'simulation', stage: 'simulation', lessonId: 'G1U1L1', occurredAt: h.now(), result: simulation},
    exam('exam-real-zero', h.now() - 1000, 0), exam('legacy-exam-missing', h.now(), 10)
  ];
  assert.equal(h.call('sync', {events}, student.token).ok, true);
  const legacy = h.sheets.get('SLH_Events').rows.find(row => row[1] === 'legacy-exam-missing');
  legacy[9] = JSON.stringify({score: null, total: 20, pct: null, passed: false});
  result = h.call('studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}, admin.token).data.result;
  assert.equal(result.exercises.e1.score, 0); assert.equal(result.exercises.e2, undefined);
  assert.deepEqual(result.simulation, {...simulation, clientReported: true}); assert.equal(result.simulation.score, undefined); assert.equal(result.simulation.pct, undefined);
  assert.deepEqual(result.exam, {last: null, best: 0, attempts: 2, lastAt: h.now()});
  assert.equal(h.call('examHistory', {studentId: student.user.id}, admin.token).data.rows[0].result.score, null);
  legacy[9] = JSON.stringify({total: 20});
  result = h.call('studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}, admin.token).data.result;
  assert.equal(result.exam.last, null); assert.equal(result.exam.best, 0);
  legacy[7] = ''; legacy[8] = '';
  const history = h.call('examHistory', {studentId: student.user.id}, admin.token).data.rows;
  assert.equal(history.find(row => row.id === 'legacy-exam-missing').occurredAt, null);
  assert.equal(history.find(row => row.id === 'legacy-exam-missing').receivedAt, null);
  assert.equal(history[0].id, 'exam-real-zero', 'a missing timestamp does not become a new timestamp or 1970');
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
