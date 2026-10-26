import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import test from 'node:test';
import {harness, exam, responses} from './helpers/google-sheets-harness.mjs';

function ok(response) { assert.equal(response.ok, true, JSON.stringify(response)); return response.data; }
function reset(h, admin, studentId, lessonId = '', requestId = randomUUID()) {
  return ok(h.call('adminResetStudent', {requestId, studentId, lessonId, confirmStudentId: studentId}, admin.token));
}
function result(h, admin, studentId, lessonId = 'G1U1L1') { return ok(h.call('studentResults', {studentId, lessonId}, admin.token)).result; }
function history(h, admin, studentId, lessonId = '') { return ok(h.call('examHistory', {studentId, lessonId, limit: 200}, admin.token)); }
function revised(event, version) { return {...event, resetVersion: version}; }

test('reset is admin-only, confirms one exact student and explicit scope, and rechecks the session', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login();
  h.staff.rows.push(['reset_teacher', h.password, 'teacher', '', 'active', 'synthetic']);
  const teacher = ok(h.call('login', {username: 'reset_teacher', password: h.password}));
  const payload = {requestId: randomUUID(), studentId: student.user.id, lessonId: '', confirmStudentId: student.user.id};
  for (const token of [student.token, teacher.token]) assert.equal(h.call('adminResetStudent', payload, token).error.code, 'FORBIDDEN');
  assert.equal(h.call('adminResetStudent', payload, '0'.repeat(64)).error.code, 'UNAUTHENTICATED');
  for (const invalid of [
    {...payload, lessonId: undefined}, {...payload, lessonId: null}, {...payload, lessonId: '*'},
    {...payload, studentId: ''}, {...payload, confirmStudentId: 'wrong'}, {...payload, confirmStudentId: undefined},
    {...payload, requestId: '=IMPORTXML()'}, {...payload, requestId: 'short'},
    {...payload, studentIds: [student.user.id]}, {...payload, roles: ['Admin']}
  ]) assert.equal(h.call('adminResetStudent', invalid, admin.token).error.code, 'INVALID_REQUEST');
  assert.equal(h.call('adminResetStudent', {...payload, studentId: 'watcharapon', confirmStudentId: 'watcharapon'}, admin.token).error.code, 'FORBIDDEN');
  assert.equal(h.sheets.get('SLH_Resets').rows.length, 1);
  h.setLock(false);
  assert.equal(h.call('adminResetStudent', payload, admin.token).error.code, 'BUSY');
  h.setLock(true);
  ok(h.call('logout', {}, admin.token));
  assert.equal(h.call('adminResetStudent', payload, admin.token).error.code, 'UNAUTHENTICATED');
  assert.equal(h.sheets.get('SLH_Resets').rows.length, 1);
});

test('one-lesson reset hides every activity and exam history while preserving other lessons, students and raw records', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login(), other = h.login('fixture0002');
  const sourceBefore = JSON.stringify([h.students.rows, h.staff.rows]);
  const lessonId = 'G1U1L1', events = [
    {id: 'game', lessonId, kind: 'game', stage: 'g1', occurredAt: h.now(), result: {attempt: 1, passed: true, done: true, correct: true, gameType: 'fixture'}},
    {id: 'exercise', lessonId, kind: 'exercise', stage: 'e1', occurredAt: h.now(), result: {score: 6, total: 6, pct: 100, passed: true, responses: responses(6, 6)}},
    {id: 'onet', lessonId, kind: 'onet', stage: 'onet', occurredAt: h.now(), result: {questionId: 'fixture', answer: 1, correct: 1, score: 1, total: 1, pct: 100, passed: true}},
    {id: 'simulation', lessonId, kind: 'simulation', stage: 'simulation', occurredAt: h.now(), result: {values: {x: 1}, metrics: [['fixture', 1]], summary: 'fixture', explored: true}},
    exam('exam-before', h.now()), exam('another-lesson', h.now(), 12, 'G1U1L2')
  ];
  ok(h.call('sync', {events}, student.token));
  ok(h.call('sync', {events: [exam('other-student', h.now(), 20)]}, other.token));
  const ledgerBefore = JSON.stringify(h.sheets.get('SLH_Events').rows), writes = h.sheets.get('SLH_Events').writes;
  const operation = reset(h, admin, student.user.id, lessonId);
  assert.deepEqual(operation.resetState, {sequence: 1, all: '', lessons: {[lessonId]: operation.resetId}});
  assert.deepEqual(result(h, admin, student.user.id).exam, {last: null, best: null, attempts: 0, lastAt: null});
  const cleared = result(h, admin, student.user.id);
  assert.deepEqual(cleared.games, {}); assert.deepEqual(cleared.exercises, {}); assert.equal(cleared.onet, null); assert.equal(cleared.simulation, null);
  assert.equal(history(h, admin, student.user.id, lessonId).total, 0);
  assert.deepEqual(history(h, admin, student.user.id).rows.map(row => row.id), ['another-lesson']);
  assert.equal(result(h, admin, student.user.id, 'G1U1L2').exam.attempts, 1);
  assert.equal(result(h, admin, other.user.id).exam.best, 100);
  const summary = ok(h.call('teacherSummary', {student: student.user.id, lessonId}, admin.token));
  assert.equal(summary.rows[0].exam.attempts, 0);
  assert.equal(JSON.stringify(h.sheets.get('SLH_Events').rows), ledgerBefore);
  assert.equal(h.sheets.get('SLH_Events').writes, writes);
  assert.equal(JSON.stringify([h.students.rows, h.staff.rows]), sourceBefore);
  assert.equal(h.students.writes + h.staff.writes, 0);
  assert.deepEqual(h.sheets.get('SLH_Resets').rows[1], [operation.resetId, student.user.id, '2569', lessonId, h.now(), 'watcharapon']);
});

test('all-lessons reset clears overrides, later lesson reset overrides only that lesson, and append order resolves equal timestamps', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login();
  const first = reset(h, admin, student.user.id, 'G1U1L1');
  ok(h.call('sync', {events: [revised(exam('first-generation', h.now()), first.resetId), exam('unreset-lesson', h.now(), 12, 'G1U1L2')]}, student.token));
  const all = reset(h, admin, student.user.id);
  assert.equal(first.resetAt, all.resetAt);
  assert.deepEqual(all.resetState, {sequence: 2, all: all.resetId, lessons: {}});
  assert.equal(history(h, admin, student.user.id).total, 0);
  ok(h.call('sync', {events: [revised(exam('all-generation-a', h.now()), all.resetId), revised(exam('all-generation-b', h.now(), 12, 'G1U1L2'), all.resetId)]}, student.token));
  const after = reset(h, admin, student.user.id, 'G1U1L1');
  assert.deepEqual(after.resetState, {sequence: 3, all: all.resetId, lessons: {G1U1L1: after.resetId}});
  assert.equal(result(h, admin, student.user.id).exam.attempts, 0);
  assert.equal(result(h, admin, student.user.id, 'G1U1L2').exam.attempts, 1);
  const current = ok(h.call('studentResetState', {}, student.token)).resetState;
  assert.deepEqual(current, after.resetState);
  assert.deepEqual(h.login().resetState, after.resetState);
  assert.equal(Object.hasOwn(h.login('watcharapon'), 'resetState'), false);
  assert.equal(h.call('studentResetState', {}, admin.token).error.code, 'FORBIDDEN');
  assert.equal(h.call('studentResetState', {studentId: 'fixture0002'}, student.token).error.code, 'INVALID_REQUEST');
  assert.deepEqual(ok(h.call('studentResetState', {}, h.login('fixture0002').token)).resetState, {sequence: 3, all: '', lessons: {}});
});

test('retrying a reset is idempotent even after fresh work and later resets; reusing its request ID for another scope conflicts', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login();
  const requestId = randomUUID(), original = reset(h, admin, student.user.id, 'G1U1L1', requestId);
  ok(h.call('sync', {events: [revised(exam('fresh-work', h.now()), requestId)]}, student.token));
  const retry = reset(h, admin, student.user.id, 'G1U1L1', requestId);
  assert.equal(retry.duplicate, true);
  assert.deepEqual({...retry, duplicate: false}, original);
  assert.equal(result(h, admin, student.user.id).exam.attempts, 1);
  reset(h, admin, student.user.id, 'G1U1L2');
  assert.deepEqual(reset(h, admin, student.user.id, 'G1U1L1', requestId).resetState, original.resetState);
  const before = h.sheets.get('SLH_Resets').rows.length;
  for (const [studentId, lessonId] of [[student.user.id, ''], ['fixture0002', 'G1U1L1']]) {
    assert.equal(h.call('adminResetStudent', {requestId, studentId, lessonId, confirmStudentId: studentId}, admin.token).error.code, 'RESET_CONFLICT');
  }
  assert.equal(h.sheets.get('SLH_Resets').rows.length, before);
  assert.equal(result(h, admin, student.user.id).exam.attempts, 1);
});

test('stale offline events and replays are acknowledged and discarded, current revisions deduplicate, and mixed invalid batches append nothing', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login();
  const old = exam('same-id', h.now());
  ok(h.call('sync', {events: [old]}, student.token));
  const operation = reset(h, admin, student.user.id, 'G1U1L1');
  const fresh = revised(exam('same-id', h.now(), 20), operation.resetId);
  const staleConflict = exam('same-id', h.now(), 1), staleUnsent = exam('offline-unsent', h.now());
  const response = ok(h.call('sync', {events: [staleConflict, fresh, staleUnsent]}, student.token));
  assert.deepEqual(response.acknowledged, ['same-id', 'same-id', 'offline-unsent']);
  assert.deepEqual(response.discarded, ['same-id', 'offline-unsent']);
  assert.equal(response.accepted, 1); assert.equal(response.duplicates, 0); assert.deepEqual(response.resetState, operation.resetState);
  assert.equal(ok(h.call('sync', {events: [fresh]}, student.token)).duplicates, 1);
  assert.equal(result(h, admin, student.user.id).exam.best, 100);
  assert.equal(history(h, admin, student.user.id).total, 1);
  const before = h.sheets.get('SLH_Events').rows.length;
  const valid = revised(exam('valid-current', h.now()), operation.resetId);
  const invalid = {...exam('invalid-stale', h.now()), result: {score: 999}};
  assert.equal(h.call('sync', {events: [valid, invalid]}, student.token).error.code, 'INVALID_EVENT');
  assert.equal(h.sheets.get('SLH_Events').rows.length, before);
  assert.equal(h.call('sync', {events: [valid, revised(exam(fresh.id, h.now(), 1), operation.resetId)]}, student.token).error.code, 'EVENT_CONFLICT');
  assert.equal(h.sheets.get('SLH_Events').rows.length, before);
  const forged = {...exam('forged-result-revision', h.now()), result: {...old.result, resetVersion: operation.resetId}};
  assert.equal(ok(h.call('sync', {events: [forged]}, student.token)).accepted, 0, 'result cannot supply the envelope revision');
  for (const resetVersion of [null, 12, {}, '=IMPORTXML()', 'x']) assert.equal(h.call('sync', {events: [{...old, resetVersion}]}, student.token).error.code, 'INVALID_EVENT');
});

test('unreset lessons retain legacy payload fingerprints and reserve revision metadata for validated envelopes', () => {
  const h = harness(), student = h.login(), event = exam('legacy-fingerprint', h.now());
  const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
  const expected = createHash('sha256').update(canonical({...event, result: {...event.result, clientReported: true}})).digest('hex');
  ok(h.call('sync', {events: [event]}, student.token));
  assert.equal(h.sheets.get('SLH_Events').rows[1][10], expected);
  assert.equal(ok(h.call('sync', {events: [{...event, resetVersion: ''}]}, student.token)).duplicates, 1);
  assert.equal(ok(h.call('sync', {events: [{...event, result: {...event.result, resetVersion: 'forged-version'}}]}, student.token)).duplicates, 1);
  assert.equal(Object.hasOwn(JSON.parse(h.sheets.get('SLH_Events').rows[1][9]), 'resetVersion'), false);
});

test('setup adds only the reset log for a legacy installation; missing or malformed migrated logs fail closed', () => {
  const h = harness(), student = h.login(), admin = h.login('watcharapon');
  ok(h.call('sync', {events: [exam('existing-legacy-score', h.now())]}, student.token));
  h.sheets.delete('SLH_Resets'); h.properties.deleteProperty('SLH_RESETS_READY');
  const previous = new Map([...h.sheets].map(([name, sheet]) => [name, JSON.stringify(sheet.rows)]));
  assert.deepEqual(h.login().resetState, {sequence: 0, all: '', lessons: {}});
  assert.equal(result(h, admin, student.user.id).exam.attempts, 1);
  const payload = {requestId: randomUUID(), studentId: student.user.id, lessonId: '', confirmStudentId: student.user.id};
  assert.equal(h.call('adminResetStudent', payload, admin.token).error.code, 'NOT_CONFIGURED');
  h.context.setup(); h.context.setup();
  assert.equal(h.propertyValues.SLH_RESETS_READY, '1');
  assert.equal(h.sheets.get('SLH_Resets').rows.length, 1);
  for (const [name, rows] of previous) if (name !== 'SLH_Sessions') assert.equal(JSON.stringify(h.sheets.get(name).rows), rows, name + ' preserved');
  const log = h.sheets.get('SLH_Resets');
  log.rows[0][0] = 'wrong';
  assert.equal(h.call('studentResetState', {}, student.token).error.code, 'SETUP_INVALID');
  log.rows[0][0] = 'ResetId';
  log.rows.push([randomUUID(), student.user.id, '2569', '', 'not-a-time', 'watcharapon']);
  assert.equal(h.call('sync', {events: [exam('blocked-malformed', h.now())]}, student.token).error.code, 'DATA_ERROR');
  assert.equal(h.call('studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}, admin.token).error.code, 'DATA_ERROR');
  h.sheets.delete('SLH_Resets');
  assert.throws(() => h.context.setup(), /SLH_Resets/, 'setup must not replace a lost reset log with an empty one');
  assert.equal(h.sheets.has('SLH_Resets'), false);
  assert.equal(h.call('studentResetState', {}, student.token).error.code, 'NOT_CONFIGURED');
  assert.equal(h.call('login', {username: student.user.id, password: h.password}).error.code, 'NOT_CONFIGURED');
  assert.equal(h.call('sync', {events: [exam('blocked-missing', h.now())]}, student.token).error.code, 'NOT_CONFIGURED');
  assert.equal(h.call('examHistory', {studentId: student.user.id}, admin.token).error.code, 'NOT_CONFIGURED');
});

test('reset queries scan each ledger once, leave roster independent, and do not parse other students activity records', () => {
  const h = harness(), admin = h.login('watcharapon'), student = h.login(), other = h.login('fixture0002');
  ok(h.call('sync', {events: [exam('own-event', h.now())]}, student.token));
  ok(h.call('sync', {events: [exam('unrelated-event', h.now())]}, other.token));
  for (const [action, payload] of [['studentResults', {studentId: student.user.id, lessonId: 'G1U1L1'}], ['examHistory', {studentId: student.user.id}]]) {
    const beforeEvents = h.sheets.get('SLH_Events').reads, beforeResets = h.sheets.get('SLH_Resets').reads;
    ok(h.call(action, payload, admin.token));
    assert.equal(h.sheets.get('SLH_Events').reads - beforeEvents, 1);
    assert.equal(h.sheets.get('SLH_Resets').reads - beforeResets, 1);
  }
  const beforeEvents = h.sheets.get('SLH_Events').reads, beforeResets = h.sheets.get('SLH_Resets').reads;
  ok(h.call('teacherRoster', {grade: 1, room: '01'}, admin.token));
  assert.equal(h.sheets.get('SLH_Events').reads, beforeEvents); assert.equal(h.sheets.get('SLH_Resets').reads, beforeResets);
  h.sheets.get('SLH_Events').rows.find(row => row[1] === 'unrelated-event')[9] = 'bad JSON';
  ok(h.call('sync', {events: [exam('own-second', h.now())]}, student.token));
  assert.equal(history(h, admin, student.user.id).total, 2);
  assert.equal(result(h, admin, student.user.id).exam.attempts, 2);
});
