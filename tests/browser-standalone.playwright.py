"""ADR-171: the standalone demonstration page, opened from the disk.
One file: it loads nothing from anywhere, offers practice only on the shipped exercises, checks a solution in the page,
and shows the rules between the rows after a check. Run: python tests/browser-standalone.playwright.py (after
npm run build). Requires Playwright and Chromium.
"""
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_support import launch
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['node','scripts/build-standalone.mjs'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
PAGE=(ROOT/'_standalone'/'codelinesorter.html').as_uri()
cases=0
with sync_playwright() as p:
    browser=launch(p)
    for name,viewport in [('desktop',{'width':1400,'height':900}),('phone',{'width':390,'height':780})]:
        page=browser.new_page(viewport=viewport);trouble=[];elsewhere=[]
        page.on('pageerror',lambda err:trouble.append('pageerror '+str(err)))
        page.on('console',lambda message:trouble.append('console '+message.text) if message.type=='error' else None)
        page.on('request',lambda request:elsewhere.append(request.url) if not request.url.startswith(('file:','data:','blob:')) else None)
        page.goto(PAGE,wait_until='domcontentloaded',timeout=15000)
        page.locator('.code-row').first.wait_for()
        assert page.locator('[data-mode]').count()==0 and page.locator('[data-step]').count()==0,name+': practice only'
        assert page.locator('[data-edit-example]').count()==0,name
        assert page.get_by_text('Local Demo',exact=False).count()>=1,name+': the page names itself a Local Demo'
        # The reference order is accepted; one row moved against a rule is rejected with a reason.
        page.locator('[data-all]').click();page.locator('[data-check]').click()
        page.locator('.report.accepted').wait_for()
        page.locator('[data-up="3"]').click();page.locator('[data-check]').click()
        page.locator('.report.rejected').wait_for()
        assert 'előtt kell állnia' in page.locator('.report').inner_text(),name
        # After a check the rules between the rows can be opened (ADR-147).
        page.locator('[data-rule-panel-toggle]').first.click()
        page.locator('[data-try-rules]').wait_for()
        page.locator('[data-rule-line]').nth(2).click()
        page.locator('[data-rule-panel]').first.wait_for()
        assert 'kell állnia' in page.locator('[data-rule-panel]').first.inner_text(),name+': the selected row\'s rules are listed'
        assert not trouble,(name,trouble)
        assert not elsewhere,(name,'the page asked for',elsewhere)
        page.close();cases+=1
    browser.close()
print(f'browser-standalone: {cases} cases passed')
