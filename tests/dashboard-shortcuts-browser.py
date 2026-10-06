"""Check dashboard shortcuts through real mouse/keyboard controls in Chrome."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
class Server(ThreadingHTTPServer):
    request_queue_size = 128

server = Server(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
errors = []
count = 0
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width':1366, 'height':1000})
        page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.pixelBtn:hover{transform:none!important}';document.head.append(s)})")
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: errors.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 and not r.url.endswith('favicon.ico') else None)
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        page.locator('#loginUser').fill('M20105')
        page.locator('#loginPass').fill('1234')
        page.locator('[data-action="login"]').click()
        assert page.locator('button.quick').count() == 4
        for mode, stages in [('lab',['lab']), ('games',['g1','g2','g3']), ('onet',['e3'])]:
            shortcut = page.locator(f'[data-shortcut="{mode}"]')
            shortcut.focus()
            shortcut.press('Space' if mode == 'games' else 'Enter')
            for grade in [1,2,3]:
                page.locator(f'[data-activity-grade="{grade}"]').click()
                assert page.locator(f'[data-activity-grade="{grade}"]').get_attribute('aria-pressed') == 'true'
                for width in [1366,390,320]:
                    page.set_viewport_size({'width':width,'height':1000})
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (mode,grade,width)
                page.set_viewport_size({'width':1366,'height':1000})
                ids = page.locator(f'[data-activity-stage="{stages[0]}"]').evaluate_all('(buttons)=>buttons.map(b=>b.dataset.activityLesson)')
                for lesson in ids:
                    for stage in stages:
                        before = page.evaluate('id=>window.__SLH_QA__.snapshot(id)',lesson)
                        page.locator(f'[data-activity-lesson="{lesson}"][data-activity-stage="{stage}"]').click()
                        after = page.evaluate('id=>window.__SLH_QA__.snapshot(id)',lesson)
                        assert after['resume'] == stage, (lesson,stage)
                        assert after['exam']['passed'] == before['exam']['passed']
                        assert after['xp'] == before['xp']
                        assert after['lab']['done'] == before['lab']['done']
                        assert {k:v['done'] for k,v in after['games'].items()} == {k:v['done'] for k,v in before['games'].items()}
                        assert page.locator('[data-activity-grade]').count() == 0
                        page.locator('[data-action="back"]').click()
                        assert page.locator(f'[data-activity-grade="{grade}"][aria-pressed="true"]').count() == 1
                        count += 1
            page.locator('[data-action="back"]').click()
            assert page.locator('button.quick').count() == 4
            print(f'{mode}: all lessons checked',flush=True)
        page.locator('[data-shortcut="results"]').click()
        assert page.locator('h1').inner_text() == 'ผลการเรียน'
        assert page.locator('.panel').inner_text() == 'ยังไม่มีผลการเรียน'
        page.locator('[data-action="back"]').click()
        # Normal lesson selection must still resume its own last stage.
        page.locator('[data-grade="1"]').click()
        page.locator('[data-unit="0"]').click()
        page.locator('[data-lesson="G1U1L1"]').click()
        assert page.evaluate("window.__SLH_QA__.snapshot('G1U1L1').resume") == 'e3'
        page.locator('[data-action="back"]').click()
        assert page.locator('[data-lesson="G1U1L1"]').count() == 1
        page.locator('[data-action="home"]').click()
        page.set_viewport_size({'width':390,'height':844})
        page.locator('[data-shortcut="games"]').click()
        page.locator('[data-activity-stage="g2"]').first.click()
        page.locator('[data-action="back"]').click()
        (ROOT/'tmp/shortcuts').mkdir(parents=True,exist_ok=True)
        page.screenshot(path=str(ROOT/'tmp/shortcuts/mobile.png'),full_page=False)
        page.locator('[data-action="home"]').click()
        page.set_viewport_size({'width':1366,'height':1000})
        page.locator('.quickGrid').screenshot(path=str(ROOT/'tmp/shortcuts/dashboard.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print(json.dumps({'activityRoutes':count,'errors':errors}))
