"""ADR-151: the server on a public address offers practice only.
A visitor the server would refuse as an author (here: a configured token the page does not send) gets a page without
authoring: no mode switch, no «Saját feladat ebből», no author-service tool, and no refused request in the background.
The local author's page is unchanged. Run: python tests/browser-public.playwright.py. Requires Playwright and Chromium.
"""
import os, time, socket, subprocess, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_support import launch
ROOT=Path(__file__).resolve().parent.parent
def serve(extra):
    with socket.socket() as s:
        s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port),**extra},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    for _ in range(80):
        try:
            urllib.request.urlopen(base+'/api/exercises',timeout=.5);return proc,base
        except Exception: time.sleep(.1)
    proc.terminate();raise AssertionError('Server did not start: '+proc.stderr.read().decode()[:300])
def watched(browser,**options):
    page=browser.new_page(**options);trouble=[]
    page.on('pageerror',lambda err:trouble.append('pageerror '+str(err)))
    page.on('response',lambda r:trouble.append(f'{r.status} {r.url}') if r.status>=400 else None)
    return page,trouble
cases=0
public,PUBLIC=serve({'CODELINE_AUTHOR_TOKEN':'not-sent-by-the-page','CODELINE_TRUSTED_PROXIES':'1'})
local,LOCAL=serve({})
try:
    with sync_playwright() as p:
        browser=launch(p)
        for name,viewport in [('desktop',{'width':1400,'height':900}),('phone',{'width':390,'height':780})]:
            page,trouble=watched(browser,viewport=viewport)
            page.goto(PUBLIC,wait_until='domcontentloaded',timeout=15000)
            page.locator('.code-row').first.wait_for()
            assert page.locator('[data-mode]').count()==0,name+': the mode switch is not offered'
            assert page.locator('[data-step]').count()==0,name+': the page opens in practice, not in the author steps'
            assert page.locator('[data-edit-example]').count()==0,name+': no way into authoring from an exercise'
            assert page.get_by_text('Trusted Server Validation').count()>=1,name
            page.locator('[data-all]').click();page.locator('[data-check]').click()
            page.locator('.report.accepted').wait_for()
            assert not trouble,(name,trouble)
            page.close();cases+=1
        # The solution editor (switched on as its own tests do, ADR-133) keeps its tools except the author-service one.
        page,trouble=watched(browser,viewport={'width':1400,'height':900})
        page.add_init_script("localStorage.setItem('ngdynamic.view-switches.v1','on')")
        page.goto(PUBLIC,wait_until='domcontentloaded');page.locator('[data-view="edit"]').click()
        page.locator('#code-editor').wait_for()
        assert page.locator('[data-format]').count()==0 and page.locator('[data-apply]').count()==1
        assert not trouble,trouble
        page.close();cases+=1
        # A «Kipróbálom» link from the help page asks for authoring: it is told why not, and the page stays in practice.
        page,trouble=watched(browser,viewport={'width':1400,'height':900})
        page.goto(PUBLIC+'/#kiprobalom=tsDiagnostics.0',wait_until='domcontentloaded')
        page.get_by_text('A feladatkészítés ezen a szerveren nem érhető el',exact=False).first.wait_for()
        assert page.locator('[data-step]').count()==0 and page.locator('.code-row').count()>0
        assert not trouble,trouble
        page.close();cases+=1
        # The local author's page: both modes, opening in authoring, as before.
        page,trouble=watched(browser,viewport={'width':1400,'height':900})
        page.goto(LOCAL,wait_until='domcontentloaded');page.locator('[data-step="source"]').wait_for()
        assert page.locator('[data-mode]').count()==2
        page.locator('[data-mode="practice"]').click();page.locator('[data-edit-example]').wait_for()
        assert not trouble,trouble
        page.close();cases+=1
        browser.close()
finally:
    public.terminate();local.terminate()
print(f'browser-public: {cases} cases passed')
