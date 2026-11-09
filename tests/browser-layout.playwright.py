"""Layout gate (ADR-116, M1): the practice view and the author's Try step on desktop, laptop, tablet and phone (upright and on its side),
in the light and the dark theme. It checks what a machine can measure, not taste: the page never scrolls sideways, no header control runs
off the screen, every toolbar control in view has one height, a phone on its side keeps the header and the toolbar to one row and shows the
lists on the first screen, focus gives the lists at least 40 % of the height, and a task list closed on a narrow screen is visible when the
screen widens. Screenshots of every view land in test-results/layout-*.png."""
import os,socket,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
# name, width, height, touch, phone on its side
VIEWPORTS=[('desktop',1440,900,False,False),('laptop',1280,720,False,False),('tablet',880,1100,True,False),('phone',390,844,True,False),('phone-side',780,360,True,True),('phone-side-wide',915,412,True,True)]
MEASURE="""()=>{const shown=s=>[...document.querySelectorAll(s)].filter(e=>e.offsetParent&&getComputedStyle(e).visibility!=='hidden');
 const box=e=>e.getBoundingClientRect();
 return {scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,
  header:Math.round(box(document.querySelector('.header')??document.body).height),
  offscreen:shown('.header button,.header summary').filter(b=>box(b).right>innerWidth+1).map(b=>b.getAttribute('aria-label')||b.textContent.trim()),
  tools:shown('.toolbar button').map(b=>Math.round(box(b).height)),
  toolRows:new Set(shown('.toolbar button').map(b=>Math.round(box(b).top+box(b).height/2))).size,
  zoneTop:Math.round(box(document.querySelector('.drop-zone')).top),
  zones:shown('.drop-zone').map(z=>Math.round(box(z).height)),
  // the lists side by side share their height; stacked, their heights add up
  lists:(z=>z.length?Math.round(new Set(z.map(e=>Math.round(box(e).top))).size>1?z.reduce((s,e)=>s+box(e).height,0):Math.max(...z.map(e=>box(e).height))):0)(shown('.drop-zone'))};}"""
def check(page,name,side,focused=False):
    m=page.evaluate(MEASURE)
    page.screenshot(path=str(ARTIFACTS/f'layout-{name}.png'))
    assert m['scroll']<=m['width'],f"{name}: the page scrolls sideways ({m['scroll']} > {m['width']})"
    assert not m['offscreen'],f"{name}: header controls off the screen: {m['offscreen']}"
    assert m['tools'] and max(m['tools'])-min(m['tools'])<=1,f"{name}: toolbar controls of different heights {m['tools']}"
    if side:
        assert m['toolRows']==1,f"{name}: the toolbar takes {m['toolRows']} rows on a phone on its side"
        if not focused:
            assert m['header']<=52,f"{name}: the header is {m['header']} px high on a phone on its side"
            assert m['zoneTop']<m['height']-60,f"{name}: the lists start at {m['zoneTop']} px, below the first screen ({m['height']} px)"
    if focused:assert m['lists']>=.4*m['height'],f"{name}: focus leaves the lists {m['lists']} px of {m['height']}"
    print(f"PASS layout: {name} {m['width']}x{m['height']} header {m['header']} tools {sorted(set(m['tools']))} rows {m['toolRows']} lists {m['zones']}",flush=True)
def focus(page,name,side):
    page.locator('[data-focus]').click();expect(page.locator('#app')).to_have_attribute('data-surface','focus')
    check(page,name+'-focus',side,focused=True)
    page.locator('[data-focus]').click();expect(page.locator('#app')).not_to_have_attribute('data-surface','focus')
def views(page,name,side):
    page.goto(BASE);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
    menu=page.locator('details.open-menu')
    if menu.get_attribute('open') is None:menu.locator('summary').click()
    example=page.locator('[data-start-example] option').nth(1).get_attribute('value');page.locator('[data-start-example]').select_option(example)
    page.locator('[data-author-apply]').click();expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step')
    page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible()
    check(page,name+'-author-try',side);focus(page,name+'-author-try',side)
    page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
    check(page,name+'-practice',side);focus(page,name+'-practice',side)
def sidebar(browser):
    """ADR-116: a task list closed on a narrow screen is still the sidebar when the screen widens (it was an empty column)."""
    page=browser.new_context(viewport={'width':780,'height':900}).new_page();page.goto(BASE)
    page.locator('[data-mode="practice"]').click();picker=page.locator('details.task-picker')
    expect(picker).not_to_have_attribute('open','')
    page.set_viewport_size({'width':1280,'height':900});expect(page.locator('[data-task]').first).to_be_visible()
    print('PASS layout: a task list closed on a narrow screen is visible in the wide sidebar',flush=True)
    page.context.close()
try:
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception:time.sleep(.1)
    with sync_playwright() as p:
        browser=launch(p)
        try:
            for scheme in ['light','dark']:
                for name,width,height,touch,side in VIEWPORTS:
                    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch,color_scheme=scheme)
                    views(context.new_page(),f'{scheme}-{name}',side);context.close()
            sidebar(browser)
            print('PASS layout total: every view in both themes',flush=True)
        finally:browser.close()
finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
