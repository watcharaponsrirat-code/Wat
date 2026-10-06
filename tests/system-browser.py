"""Whole-app browser audit. Run with Playwright and installed Chrome."""
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
class AuditServer(ThreadingHTTPServer):
    # Chrome can open more connections than the default Windows listen backlog.
    request_queue_size=128
server=AuditServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
findings=[]
counts={'screens':0,'simControls':0,'readingImages':0,'examSubmissions':0}
def check(ok,message):
    if not ok: findings.append(message)
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':1366,'height':1000})
        # Decorative motion must not prevent Playwright's stable-element checks.
        page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.pixelBtn:hover{transform:none!important}';document.head.append(s)})")
        page.on('pageerror',lambda e:findings.append('JavaScript: '+str(e)))
        page.on('requestfailed',lambda r:findings.append('Request failed: '+r.url+' '+str(r.failure)))
        page.on('response',lambda r:findings.append('HTTP '+str(r.status)+' '+r.url) if r.status>=400 and not r.url.endswith('favicon.ico') else None)
        url=f'http://127.0.0.1:{server.server_port}/index.html'
        def login(user,password='1234'):
            page.locator('#loginUser').fill(user)
            page.locator('#loginPass').fill(password)
            page.locator('[data-action="login"]').click()
        for user,password in [('unknown','1234'),('M20105','wrong'),('toString','1234'),('constructor','1234'),('__proto__','1234')]:
            page.goto(url)
            login(user,password)
            check(page.locator('#loginUser').count()==1,'Invalid login accepted: '+user)
        page.goto(url)
        login('M20105')
        check(page.locator('[data-grade]').count()==3,'Student dashboard has three grades')
        page.locator('[data-grade="1"]').click()
        page.locator('[data-unit]').first.click()
        page.locator('[data-lesson]').first.click()
        check(page.locator('.readingPage').count()==1,'Lesson opens from grade/unit navigation')
        page.locator('[data-content-complete]').click()
        check(page.locator('.simPanel').count()==1,'Reading completion opens simulation')
        page.locator('[data-action="logout"]').click()
        login('teacher')
        check(page.locator('#loginUser').count()==0,'Login button works after logout')
        page.evaluate("window.__SLH_QA__.open('G1U1L1','content')")
        check(not page.evaluate("window.__SLH_QA__.snapshot('G1U1L1').contentDone"),'Teacher inherited student progress')
        page.locator('[data-action="logout"]').click()
        login('M20105')
        check(page.evaluate("window.__SLH_QA__.snapshot('G1U1L1').contentDone"),'Student progress lost on account switch')
        ids=page.evaluate('window.__SLH_QA__.lessonIds')
        for lesson in ids:
            for stage in ['content','lab','g1','g2','g3','e1','e2','e3','exam','result']:
                page.evaluate("({lesson,stage})=>window.__SLH_QA__.open(lesson,stage)",{'lesson':lesson,'stage':stage})
                for width in [1366,390,320]:
                    page.set_viewport_size({'width':width,'height':1000})
                    check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Horizontal overflow: {lesson}/{stage}/{width}')
                    counts['screens']+=1
                if stage=='content':
                    broken=page.locator('.readingPage img').evaluate_all('''async imgs=>{
                      await Promise.all(imgs.map(async img=>{img.loading='eager';try{await img.decode()}catch{}}));
                      return imgs.filter(img=>!img.naturalWidth).map(img=>img.src);
                    }''')
                    check(not broken,f'Broken reading images: {lesson}: {broken}')
                    counts['readingImages']+=page.locator('.readingPage img').count()
                    anchors=page.locator('.readingOutline a').evaluate_all('els=>els.every(a=>document.getElementById(a.hash.slice(1)))')
                    check(anchors,'Broken reading anchor: '+lesson)
                if stage=='lab':
                    controls=page.locator('[data-sim-control]').evaluate_all("els=>els.map(e=>({key:e.dataset.simControl,select:e.tagName==='SELECT',max:e.tagName==='SELECT'?e.options.length-1:Number(e.max)}))")
                    for control in controls:
                        el=page.locator(f'[data-sim-control="{control["key"]}"]')
                        if control['select']: el.select_option(str(control['max']))
                        else: el.fill(str(control['max']));el.dispatch_event('input')
                        actual=page.evaluate('({id,key})=>window.__SLH_QA__.snapshot(id).simulation[id].values[key]',{'id':lesson,'key':control['key']})
                        check(actual==control['max'],'Simulation control: '+lesson+'/'+control['key'])
                        counts['simControls']+=1
                    page.locator('[data-sim-reset]').click()
            print('Audited '+lesson,flush=True)
        page.set_viewport_size({'width':1366,'height':1000})
        # Timer is stopped on navigation and values survive reload.
        page.evaluate("window.__SLH_QA__.open('G3U3L1','lab')")
        page.locator('[data-sim-play]').click()
        page.wait_for_function("window.__SLH_QA__.snapshot('G3U3L1').simulation.G3U3L1.values.t>0")
        page.locator('[data-stage="g1"]').first.click()
        saved=page.evaluate("JSON.stringify(window.__SLH_QA__.snapshot('G3U3L1').simulation)")
        page.wait_for_timeout(1000)
        check(saved==page.evaluate("JSON.stringify(window.__SLH_QA__.snapshot('G3U3L1').simulation)"),'Simulation timer continued after navigation')
        page.reload()
        login('M20105')
        check(saved==page.evaluate("JSON.stringify(window.__SLH_QA__.snapshot('G3U3L1').simulation)"),'Simulation values lost after reload')
        # Full exam via actual answer buttons: fail, pass threshold, and mastery.
        lesson='G1U1L1'
        for score in [11,12,20]:
            page.evaluate("id=>window.__SLH_QA__.open(id,'exam')",lesson)
            qs=page.evaluate("window.__SLH_QA__.snapshot('G1U1L1').exam.current.qs")
            page.locator('[data-exam-go="19"]').click()
            page.locator('[data-exam-submit]').click()
            check(page.locator('[data-exam-submit]').count()==1,'Incomplete exam submitted')
            for i,q in enumerate(qs):
                page.locator(f'[data-exam-go="{i}"]').click()
                answer=q['correct'] if i<score else next(o for o in q['opts'] if o!=q['correct'])
                page.locator('[data-exam-choice]').filter(has_text=answer).first.click()
            page.locator('[data-exam-submit]').click()
            result=page.evaluate("window.__SLH_QA__.snapshot('G1U1L1').exam")
            check(result['last']==score*5,f'Exam score wrong: {score}')
            check(result['passed']==(score>=12),f'Exam pass threshold wrong: {score}')
            check(page.locator('[data-result-retry]').count()==1,'Results screen missing')
            counts['examSubmissions']+=1
        page.locator('[data-action="home"]').click()
        for nav in ['results','mission','about','lessons']:
            page.locator(f'[data-nav="{nav}"]').click()
            if nav=='about': page.locator('[data-close-modal]').click()
        browser.close()
except Exception as error:
    findings.append('Audit interrupted: '+str(error))
finally:
    server.shutdown();server.server_close()
report={'counts':counts,'findings':list(dict.fromkeys(findings))}
(ROOT/'tmp/system-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
if findings: raise SystemExit(1)
