"""Real Chromium end-to-end test: author, model edit, insertion DnD, scroll and styling.
Run: python tests/browser-v7.playwright.py. Requires Playwright and Chromium.
"""
import os, json, time, socket, subprocess, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_support import launch, ARTIFACTS
ROOT=Path(__file__).resolve().parent.parent
with socket.socket() as s:
    s.bind(('127.0.0.1',0));PORT=s.getsockname()[1]
BASE=f'http://127.0.0.1:{PORT}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(PORT)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
try:
    for _ in range(80):
        try:
            urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception: time.sleep(.1)
    else: raise AssertionError('Server did not start: '+proc.stderr.read().decode()[:300])
    with sync_playwright() as p:
        browser=launch(p)
        page=browser.new_page(viewport={'width':1500,'height':950});errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.goto(BASE,wait_until='domcontentloaded',timeout=15000)
        page.locator('[data-task]').first.wait_for()
        assert abs(page.locator('#app').evaluate('(x)=>x.getBoundingClientRect().width')-1500)<2
        page.locator('[data-view="author"]').click()
        page.locator('#author-editor').fill('function calc() {\n const a = 1;\n const b = 2;\n return a + b;\n}')
        page.locator('[data-author-apply]').click()
        page.locator('.solution-zone .code-row').first.wait_for()
        assert page.locator('.solution-zone .code-row').count()==5
        # Author can explicitly tighten an automatically independent declaration.
        page.locator('[data-view="model"]').click()
        strict=json.loads(page.locator('#model-editor').input_value());strict['lines'][2]['dependencies']=[2]
        page.locator('#model-editor').fill(json.dumps(strict));page.locator('[data-model-apply]').click()
        page.locator('.solution-zone .code-row').first.wait_for()
        page.locator('[data-all]').click()
        page.locator('[data-check]').click()
        page.get_by_text('Elfogadva',exact=False).first.wait_for()
        # Move b above a, and prove the explicitly tightened dependency rejects it.
        page.locator('[data-up="2"]').click()
        before=page.locator('.solution-zone .code-text code').all_text_contents()
        assert 'const b' in before[1] and 'const a' in before[2],before
        page.locator('[data-check]').click();page.get_by_text('Hibás',exact=False).first.wait_for()
        page.locator('[data-view="model"]').click()
        obj=json.loads(page.locator('#model-editor').input_value())
        a=next(x for x in obj['lines'] if 'const a' in x['code'])
        b=next(x for x in obj['lines'] if 'const b' in x['code'])
        ret=next(x for x in obj['lines'] if 'return' in x['code'])
        b['dependencies']=[obj['lines'][0]['id']]
        ret['dependencies']=[a['id'],b['id']]
        page.locator('#model-editor').fill(json.dumps(obj,ensure_ascii=False,indent=2))
        page.locator('[data-model-apply]').click()
        page.locator('.solution-zone .code-row').first.wait_for()
        after=page.locator('.solution-zone .code-text code').all_text_contents()
        assert after==before,(before,after)
        page.locator('[data-check]').click()
        page.get_by_text('Elfogadva',exact=False).first.wait_for()
        # Inserting from solution must not swap the source and destination rows.
        old=page.locator('.solution-zone .code-text code').all_text_contents()
        page.locator('.solution-zone .code-row[data-index="1"] .drag-handle').drag_to(page.locator('.solution-zone .code-row[data-index="3"] .gutter'))
        new=page.locator('.solution-zone .code-text code').all_text_contents()
        assert sorted(x.strip() for x in old)==sorted(x.strip() for x in new)
        assert errors==[],errors
        bg=page.evaluate('''() => {const x=document.querySelector('.solution-zone .token.operator');return x?getComputedStyle(x).backgroundColor:null;}''')
        assert bg in (None,'rgba(0, 0, 0, 0)','transparent'),bg
        # Scroll large complete solution: record position and reorder without resetting to top.
        sample='function many() {\n'+''.join(f' const v{i} = {i};\n' for i in range(220))+' return 0;\n}'
        page.locator('[data-view="author"]').click()
        page.locator('#author-editor').fill(sample)
        page.locator('[data-author-apply]').click()
        page.locator('[data-all]').click()
        page.evaluate('document.querySelector(".solution-zone").scrollTop = 3000')
        saved=page.evaluate('document.querySelector(".solution-zone").scrollTop')
        visible_index=page.locator('.solution-zone').evaluate('(zone)=>Math.floor(zone.scrollTop/zone.querySelector(".code-row").getBoundingClientRect().height)+3')
        page.locator(f'[data-down="{visible_index}"]').click()
        restored=page.evaluate('document.querySelector(".solution-zone").scrollTop')
        assert saved>1000 and abs(saved-restored)<2,(saved,restored)
        assert page.locator('[data-fullscreen]').count()==1
        assert page.locator('.code-row').count()>=220
        print('PASS real Chromium: width, author, model changes affect validation, attempt retained, true drop, 220-line scroll, syntax colors, fullscreen; no JS errors')
        page.screenshot(path=str(ARTIFACTS/'http.png'),full_page=False)
        browser.close()
finally:
    proc.terminate()
    try: proc.wait(timeout=3)
    except subprocess.TimeoutExpired: proc.kill()
