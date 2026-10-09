/* Login presentation only. Authentication and storage remain in bindGlobal. */
(() => {
  'use strict';
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const app = document.getElementById('app');
  if (!app || typeof app.addEventListener !== 'function') return;
  function indicateSubmission(form) {
    const button = form.querySelector('[data-action="login"]');
    if (!button || button.disabled) return;
    button.setAttribute('aria-busy', 'true');
    // The existing authentication is synchronous; never delay or replace it.
    queueMicrotask(() => {
      if (button.isConnected) button.removeAttribute('aria-busy');
    });
  }
  app.addEventListener('submit', event => {
    if (event.target.matches('.loginPage #loginForm')) indicateSubmission(event.target);
  }, true);
  app.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const page = target?.closest('.loginPage');
    if (!page) return;
    const submit = target.closest('[data-action="login"]');
    if (submit) indicateSubmission(submit.form);
    const toggle = target.closest('[data-login-password]');
    if (toggle) {
      const input = page.querySelector('#loginPass');
      const start = input.selectionStart, end = input.selectionEnd;
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(visible));
      toggle.setAttribute('aria-label', visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
      toggle.title = visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน';
      if (start !== null) input.setSelectionRange(start, end);
    }
    const support = target.closest('[data-login-support]');
    if (support) {
      const help = page.querySelector('#loginSupport');
      help.hidden = !help.hidden;
      support.setAttribute('aria-expanded', String(!help.hidden));
    }
  }, true);
})();
