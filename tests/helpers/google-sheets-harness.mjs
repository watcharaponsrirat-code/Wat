import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import vm from 'node:vm';


const source = readFileSync(new URL('../../integrations/google-sheets/Code.gs', import.meta.url), 'utf8');
export function harness({count = 907, setup = true} = {}) {
  class Sheet {
    constructor(name, rows = []) { this.name = name; this.rows = rows.map(row => [...row]); this.writes = 0; this.reads = 0; }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
    getDataRange() { return this.getRange(1, 1, this.rows.length || 1, this.getLastColumn() || 1); }
    setFrozenRows() {}
    getRange(row, column, height, width) {
      const sheet = this;
      return {
        getValues() { sheet.reads++; return Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => sheet.rows[row + y - 1]?.[column + x - 1] ?? '')); },
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
  const propertyValues = {SLH_SPREADSHEET_ID: 'synthetic-spreadsheet-identity-only', SLH_CURRENT_TERM: '2'};
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
export function responses(count, score) { return Array.from({length: count}, (_, i) => ({selected: i < score ? 'a' : 'b', correct: 'a', ok: i < score})); }
export function exam(id, occurredAt, score = 16, lessonId = 'G1U1L1') {
  return {id, lessonId, kind: 'exam', stage: 'exam', occurredAt, result: {pct: score * 5, score, total: 20, passed: score >= 12, started: occurredAt - 60000, responses: responses(20, score), version: 3}};
}
