"""Browser integration check. Requires Playwright and an installed Chrome."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chrome',headless=True)
        page = browser.new_page(viewport={'width':1366,'height':1000})
        errors = []
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        questions = page.evaluate('window.SLH_ONET.questions')
        checked = 0
        for lesson in dict.fromkeys(q['lesson'] for q in questions):
            page.evaluate("id=>window.__SLH_QA__.open(id,'e3')",lesson)
            for q in [q for q in questions if q['lesson']==lesson]:
                img = page.locator(f'#onet-image-{q["id"]} img')
                img.scroll_into_view_if_needed()
                img.evaluate('img=>img.decode()')
                assert img.evaluate('img=>img.naturalWidth') == q['image']['width']
                assert page.locator(f'[data-onet-check="{q["id"]}"]').is_disabled()
                for answer in [q['key']%4+1,q['key']]:
                    page.locator(f'[data-onet-id="{q["id"]}"][data-onet-answer="{answer}"]').click()
                    page.locator(f'[data-onet-check="{q["id"]}"]').click()
                    state=page.evaluate('({lesson,id})=>window.__SLH_QA__.snapshot(lesson).onetOriginals[id]',{'lesson':lesson,'id':q['id']})
                    assert state == {'answer':answer,'checked':True}
                checked += 1
        page.reload()
        lesson='G1U4L3'
        page.evaluate("id=>window.__SLH_QA__.open(id,'e3')",lesson)
        q=next(q for q in questions if q['lesson']==lesson)
        assert page.locator(f'[data-onet-id="{q["id"]}"][data-onet-answer="{q["key"]}"]').get_attribute('aria-pressed') == 'true'
        for width in [1366,390,320]:
            page.set_viewport_size({'width':width,'height':1000})
            frame=page.locator(f'#onet-image-{q["id"]}')
            zoom=page.locator(f'[data-onet-zoom="{q["id"]}"]')
            zoom.click()
            assert zoom.get_attribute('aria-expanded')=='true'
            assert frame.evaluate('el=>el.scrollWidth>el.clientWidth')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            zoom.click()
            assert zoom.get_attribute('aria-expanded')=='false'
            assert frame.evaluate('el=>el.scrollWidth<=el.clientWidth')
            page.locator('.onetPractice').scroll_into_view_if_needed()
            page.evaluate("window.scrollTo({top:scrollY+document.querySelector('.onetPractice').getBoundingClientRect().top-document.querySelector('.topbar').offsetHeight-12,behavior:'instant'})")
            (ROOT/'tmp/onet').mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(ROOT/f'tmp/onet/browser-{width}.png'))
        # Broken local image must offer a readable recovery path.
        img=page.locator('.onetQuestionImage').first
        img.evaluate("img=>img.src='assets/exercises/onet-images/missing-test-image.webp'")
        page.locator('.onetImageError').first.wait_for(state='visible')
        assert not errors, errors
        browser.close()
        print({'questions':checked,'viewports':[1366,390,320],'checks':'inline assets, wrong/correct answers, reload, zoom, no overflow, image fallback','pageErrors':errors})
finally:
    server.shutdown()
    server.server_close()
