"""Exercise every new final-exam item through Chrome controls in an isolated context."""
import json
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
class Server(ThreadingHTTPServer):
    request_queue_size=128
server=Server(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
errors=[]
counts={'lessons':0,'answers':0,'resultLayouts':0,'reloads':0,'reviewLinks':0}
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':1366,'height':1000})
        page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.pixelBtn:hover{transform:none!important}';document.head.append(s)})")
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:errors.append(f'HTTP {r.status}: {r.url}') if r.status>=400 and not r.url.endswith('favicon.ico') else None)
        page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
        ids=page.evaluate('window.__SLH_QA__.lessonIds')
        (ROOT/'tmp/final-exams').mkdir(parents=True,exist_ok=True)
        for number,lesson in enumerate(ids):
            page.evaluate("id=>window.__SLH_QA__.open(id,'exam')",lesson)
            attempt=page.evaluate('id=>window.__SLH_QA__.snapshot(id).exam.current',lesson)
            assert attempt['version']==2
            assert page.locator('.qFeedback').count()==0
            if lesson=='G1U1L1':
                page.set_viewport_size({'width':390,'height':844})
                page.screenshot(path=str(ROOT/'tmp/final-exams/exam-mobile.png'))
            correct_count=[11,12,20][number%3]
            for i,q in enumerate(attempt['qs']):
                page.locator(f'[data-exam-go="{i}"]').click()
                selected=q['correct'] if i<correct_count else next(o for o in q['opts'] if o!=q['correct'])
                page.locator('[data-exam-choice]').filter(has_text=re.compile(r'^[กขคง]\. '+re.escape(selected)+r'$')).click()
                counts['answers']+=1
                if lesson=='G1U1L1' and i==4:
                    before=page.evaluate('id=>JSON.stringify(window.__SLH_QA__.snapshot(id).exam.current)',lesson)
                    page.reload()
                    page.evaluate("id=>window.__SLH_QA__.open(id,'exam')",lesson)
                    assert before==page.evaluate('id=>JSON.stringify(window.__SLH_QA__.snapshot(id).exam.current)',lesson)
                    counts['reloads']+=1
            page.locator('[data-exam-submit]').click()
            state=page.evaluate('id=>window.__SLH_QA__.snapshot(id).exam',lesson)
            assert state['last']==correct_count*5,(lesson,state['last'])
            assert state['passed']==(correct_count>=12)
            assert state['history'][0]['version']==2
            assert len(state['history'][0]['responses'])==20
            heading=page.get_by_role('heading',name='เฉลยและเหตุผลทุกข้อจากครั้งล่าสุด')
            assert heading.count()==1
            assert heading.locator('..').locator('.callout').count()==20
            assert heading.locator('..').get_by_role('button').count()==20
            for width in [1366,390,320]:
                page.set_viewport_size({'width':width,'height':1000})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(lesson,width)
                counts['resultLayouts']+=1
            if lesson=='G1U1L1':
                heading.scroll_into_view_if_needed()
                page.screenshot(path=str(ROOT/'tmp/final-exams/review-mobile.png'))
            page.set_viewport_size({'width':1366,'height':1000})
            if lesson=='G3U6L1':
                heading.scroll_into_view_if_needed()
                page.screenshot(path=str(ROOT/'tmp/final-exams/review-desktop.png'))
            code=heading.locator('..').get_by_role('button').first.get_attribute('data-review-topic')
            heading.locator('..').get_by_role('button').first.click()
            assert page.locator('#reading-'+code).count()==1
            assert page.evaluate('id=>window.__SLH_QA__.snapshot(id).resume',lesson)=='content'
            counts['reviewLinks']+=1
            counts['lessons']+=1
            print('Final exam checked: '+lesson,flush=True)
        assert not errors,errors
        browser.close()
except Exception as error:
    errors.append(str(error))
    raise
finally:
    server.shutdown();server.server_close()
    report={'counts':counts,'errors':errors}
    (ROOT/'tmp/final-exam-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
