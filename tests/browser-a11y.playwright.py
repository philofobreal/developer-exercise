"""Automated accessibility scan (ADR-096, ADR-105): axe-core over the main views, on desktop and on a touch phone, in the light and the dark theme.
It checks what a machine can (WCAG 2.x A/AA rules axe implements: contrast, names, roles, ARIA, landmarks);
it is no WCAG certification. A11Y_COLLECT=1 lists every finding of every view instead of stopping at the first. The contexts bypass the app's CSP only to inject axe; the served CSP is unchanged. Every view must report no violation; a waiver needs a rule id and a reason here."""
import json,os,socket,subprocess,sys,time,urllib.request
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch
AXE=(ROOT/'node_modules/axe-core/axe.min.js').read_text(encoding='utf-8')
TAGS=['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']
# rule id -> reason. Keep empty unless a finding is a proven false positive.
WAIVED={}
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
SOURCE='function calc(values) {\n  const total = values.length;\n  const first = values[0];\n  return [total, first];\n}'
def scan(page,name,include=None):
    """`include`: a selector the scan is limited to (an open floating bubble, ADR-141); else the whole document."""
    page.add_script_tag(content=AXE)
    result=page.evaluate("""([tags,include])=>axe.run(include?{include:[include]}:document,{runOnly:{type:'tag',values:tags},resultTypes:['violations']})""",[TAGS,include])
    found=[v for v in result['violations'] if v['id'] not in WAIVED]
    # ADR-143 (D4b): nothing to read is under 12 px, in every scanned view (the bubble, the menu, the help page too)
    small=page.evaluate("""include=>{const out=new Set(),root=include?document.querySelector(include):document.body,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
     while(node=walker.nextNode()){const e=node.parentElement;if(!node.textContent.trim()||!e||!e.checkVisibility()||e.closest('svg,script,style'))continue;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;
      const size=parseFloat(getComputedStyle(e).fontSize);if(size<12)out.add(size+'px '+e.tagName.toLowerCase()+'.'+(e.className||e.parentElement.className)+': '+node.textContent.trim().slice(0,20));}
     return [...out];}""",include)
    assert not small,f'{name}: text under 12 px: {small}'
    if found and os.environ.get('A11Y_COLLECT'):
        for v in found:print(f"FOUND {name}: {v['id']} ({v['impact']}) {[n['target'] for n in v['nodes']][:6]} :: {v['nodes'][0]['failureSummary'][:220]}",flush=True)
        return
    if found:
        (ARTIFACTS/f'a11y-{name}.json').write_text(json.dumps(found,ensure_ascii=False,indent=1),encoding='utf-8')
        summary='; '.join(f"{v['id']} ({v['impact']}, {len(v['nodes'])}×): {v['nodes'][0]['target']} – {v['nodes'][0]['failureSummary'][:160]}" for v in found)
        raise AssertionError(f'{name}: {summary}')
    print(f'PASS a11y: {name} (0 violations)',flush=True)
def author_flow(page,prefix):
    page.goto(BASE);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
    scan(page,prefix+'-author-source')
    page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(SOURCE);page.locator('[data-author-apply]').click()
    expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step');scan(page,prefix+'-author-rules')
    # ADR-124 (H3): an open ⓘ bubble, with its example and link.
    box=page.locator('details.analysis-options');box.locator(':scope > summary').click();page.locator('.toggletip[data-help="keyOrder"] > .info-button').click()
    expect(page.locator('.toggletip[data-help="keyOrder"] .help-link')).to_be_visible()
    # ADR-141: the bubble is placed on its toggle event; scan the placed state. It floats over the page while open (the
    # focus leaving it closes it), so the page under it is scanned closed (above) and the bubble itself here.
    page.wait_for_function('()=>(document.querySelector(".toggletip-panel:popover-open")?.style.top??"")!==""');scan(page,prefix+'-author-rules-help',include='.toggletip-panel:popover-open');page.keyboard.press('Escape')
    page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible();page.locator('[data-all]').click();scan(page,prefix+'-author-try')
    page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle');scan(page,prefix+'-author-try-checked')
    page.locator('[data-preview-toggle]').click();expect(page.locator('.learner-preview, #app.learner-preview')).to_have_count(1);scan(page,prefix+'-learner-preview')
    page.locator('[data-preview-toggle]').click()
    page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible();scan(page,prefix+'-practice')
    picker=page.locator('details.task-picker')
    if picker.get_attribute('open') is None:picker.locator('summary').click();expect(page.locator('[data-task]').first).to_be_visible();scan(page,prefix+'-practice-picker')
    page.locator('details.session-menu summary').click();expect(page.locator('[data-save-local]')).to_be_visible();scan(page,prefix+'-session-menu');page.keyboard.press('Escape')
    # ADR-133: the shipped page offers no view switches; the switched-off solution editor is scanned with them on.
    assert page.locator('[data-view],[data-set-code-view]').count()==0
    page.evaluate("""()=>localStorage.setItem('ngdynamic.view-switches.v1','on')""");page.reload();page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
    page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_be_visible();scan(page,prefix+'-practice-code')
    page.evaluate("""()=>localStorage.removeItem('ngdynamic.view-switches.v1')""")
    # ADR-124 (H2): the help page, whole and narrowed by the search.
    page.goto(BASE+'/help/index.html');expect(page.locator('[data-help-topic]').first).to_be_visible();scan(page,prefix+'-help')
    page.locator('[data-help-search]').fill('kulcssorrend');expect(page.locator('[data-help-count]')).to_contain_text('találat');scan(page,prefix+'-help-search')
try:
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception:time.sleep(.1)
    with sync_playwright() as p:
        browser=launch(p)
        try:
            # ADR-105: both themes, every view; the theme follows the system unless the reader chose one.
            for scheme in ['light','dark']:
                desktop=browser.new_context(viewport={'width':1440,'height':900},color_scheme=scheme,bypass_csp=True);author_flow(desktop.new_page(),scheme+'-desktop');desktop.close()
                phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,color_scheme=scheme,bypass_csp=True);author_flow(phone.new_page(),scheme+'-phone');phone.close()
            print('PASS a11y total: 0 violations on every scanned view',flush=True)
        finally:browser.close()
finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
