"""Real authoring/learner workflows on Node and Pages, with keyboard and mobile QA.
ADR-022: two modes (author steps Forrás → Szabályok → Próba, practice), one active step,
explicit staleness; every transition below checks which model the next view starts from."""
import json,os,re,socket,subprocess,threading,time,urllib.request
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch,StaticServer,open_menu,analysis_options,pixel,open_task
# The generator's current rule version, read from its single definition (ADR-039).
CURRENT_POLICY=re.search(r"export const DEPENDENCY_POLICY='([^']+)'",(ROOT/'src/author/generator.mjs').read_text(encoding='utf8')).group(1)
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
def start_server():
    return subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
proc=start_server()
class Pages(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'_site'),**kwargs)
    def do_GET(self):
        if not self.path.startswith('/developer-exercise/'):self.send_error(404);return
        self.path=self.path[len('/developer-exercise'):];super().do_GET()
    def log_message(self,*args):pass
static=StaticServer(('127.0.0.1',0),Pages);threading.Thread(target=static.serve_forever,daemon=True).start()
model=json.loads((ROOT/'docs/evaluate-ordering.generated.json').read_text(encoding='utf-8'))
source='function typed() {\n const a: number = 10;\n const b: number = 20;\n return a + b;\n}'
rules_source='function f() {\n  const a = 1;\n  const b = 2;\n  const c = a + 3;\n  g(b, c);\n}'
count=0

def case(name,action):
    global count
    action();count+=1;print('PASS workbench: '+name,flush=True)
def reset(page,url):page.goto(url);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
# Every POST any context of this file sends to the Node server (it counts them per client, not per context).
posts=[];segments=[]
def watch(context):
    context.on('request',lambda request:posts.append(request.url) if request.method=='POST' and request.url.startswith(BASE) else None);return context
def current(page,step):expect(page.locator(f'[data-step="{step}"]')).to_have_attribute('aria-current','step')
def build(page,text):
    """Forrás → Modell készítése: the flow continues on the rules step."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(text);page.locator('[data-author-apply]').click();current(page,'rules')
def json_model(page,value):
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="json"]').click();expect(page.locator('[data-import-model]')).to_be_visible()
    page.locator('#model-editor').fill(json.dumps(value));expect(page.locator('[data-model-status]')).to_contain_text('Nem alkalmazott JSON');page.locator('[data-model-apply]').click();current(page,'rules')
def reanalyse(page,**settings):
    """ADR-123 (M5): the environment settings live in the Elemzés és szabályok step, on an applied model; a change shows
    the stale banner there, whose Modell újrakészítése rebuilds the model under them."""
    page.locator('[data-step="rules"]').click();current(page,'rules');analysis_options(page)
    for path,value in settings.items():page.locator(f'[data-preflight="{path}"]').select_option(value)
    rebuild=page.locator('[data-stale-notice] [data-author-apply]')
    if rebuild.count():rebuild.click();expect(page.locator('[data-stale-notice]')).to_have_count(0)
    current(page,'rules')
def build_with(page,text,**settings):
    """A model of this source, then the given environment settings (ADR-123); an up-to-date model is reused."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(text)
    apply=page.locator('[data-author-apply]')
    if apply.get_attribute('aria-disabled')!='true':apply.click();current(page,'rules')
    reanalyse(page,**settings)
def to_try(page):page.locator('[data-step="try"]').click();current(page,'try');expect(page.locator('.solution-zone')).to_be_visible()
def rules_json(page):page.locator('[data-step="rules"]').click();page.locator('[data-rules-view="json"]').click();expect(page.locator('#model-editor')).to_be_visible()
def practice(page):
    page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
    # ADR-105: on a narrow screen the task list is a folded picker above the task.
    if page.locator('details.task-picker').get_attribute('open') is None:page.locator('details.task-picker summary').click()
    expect(page.locator('[data-task]').first).to_be_visible()
def theme_choice(page):
    """ADR-105: system → light → dark → system; the choice survives a reload and is on the root before the app script runs."""
    toggle=page.locator('[data-theme-cycle]');expect(toggle).to_have_text('Rendszer');assert page.evaluate('document.documentElement.dataset.theme') is None
    toggle.click();expect(toggle).to_have_text('Világos');expect(toggle).to_be_focused();assert page.evaluate('document.documentElement.dataset.theme')=='light'
    assert page.evaluate("getComputedStyle(document.querySelector('#app')).backgroundColor")=='rgb(255, 255, 255)'
    toggle.click();expect(toggle).to_have_text('Sötét');assert page.evaluate('getComputedStyle(document.documentElement).colorScheme')=='dark'
    page.add_init_script("document.addEventListener('readystatechange',()=>{if(document.readyState==='interactive')window.__themeAtParse=document.documentElement.dataset.theme||null;},{once:true})")
    page.reload();expect(page.locator('[data-theme-cycle]')).to_have_text('Sötét');assert page.evaluate('window.__themeAtParse')=='dark'
    page.locator('[data-theme-cycle]').click();expect(page.locator('[data-theme-cycle]')).to_have_text('Rendszer')
    assert page.evaluate("localStorage.getItem('ngdynamic.theme.v1')") is None and page.evaluate('document.documentElement.dataset.theme') is None
def forced_dark(p):
    """A browser that darkens every light page (Chrome auto-dark, Android "darken websites") must not
    repaint the chosen light theme into odd dark shades: the light theme declares `only light`."""
    forced=launch(p,['--blink-settings=forceDarkModeEnabled=true,forceDarkModeInversionAlgorithm=4'])
    try:
        page=watch(forced.new_context(viewport={'width':1280,'height':800},color_scheme='dark')).new_page();reset(page,BASE)
        toggle=page.locator('[data-theme-cycle]');box=page.locator('.task-heading').bounding_box();x,y=box['x']+box['width']-4,box['y']+4
        assert pixel(page,x,y)==(17,17,19),pixel(page,x,y)
        toggle.click();expect(toggle).to_have_text('Világos');assert pixel(page,x,y)==(255,255,255),pixel(page,x,y)
        toggle.click();expect(toggle).to_have_text('Sötét');assert pixel(page,x,y)==(17,17,19),pixel(page,x,y)
    finally:forced.close()
def editor_stripes(page):
    """The editor's alternate-row stripes scroll with the text (background-attachment: local), in the
    text and in the line-number gutter: after an odd scroll offset every row still sits on its own stripe."""
    practice(page);page.locator('[data-view="edit"]').click()
    editor=page.locator('#code-editor');editor.fill('\n'.join(f'// line {i}' for i in range(60)))
    editor.evaluate('e=>{e.scrollTop=30;e.dispatchEvent(new Event("scroll"))}');page.wait_for_timeout(100)
    colors=page.evaluate("""()=>{const s=getComputedStyle(document.documentElement),probe=document.createElement('i');document.body.append(probe);const rgb=v=>{probe.style.color=v;return getComputedStyle(probe).color.match(/\\d+/g).map(Number).slice(0,3)};const out=['--n-10','--n-14','--n-14','--n-16'].map(name=>rgb(s.getPropertyValue(name)));probe.remove();return out}""")
    box=editor.bounding_box();gutter=page.locator('.editor-gutter').bounding_box()
    for j in range(2,10):
        y=box['y']+j*23-30+11
        assert list(pixel(page,box['x']+box['width']-40,y))==colors[j%2],('text stripe',j)
        assert list(pixel(page,gutter['x']+3,y))==colors[2+j%2],('gutter stripe',j)
ROW_IDS="rows=>rows.map(row=>row.dataset.lineId)"
def focus_mode(page):
    """ADR-106: Focus keeps only the code workspace, at the largest height; leaving it restores the page,
    and the arrangement is the same throughout."""
    practice(page);page.locator('[data-all]').click();before=page.locator('.solution-zone .code-row').evaluate_all(ROW_IDS)
    height=page.locator('.solution-zone').bounding_box()['height']
    page.locator('[data-focus]').click();expect(page.locator('#app')).to_have_attribute('data-surface','focus');expect(page.locator('[data-focus]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('.header')).to_be_hidden();expect(page.locator('.library')).to_be_hidden();expect(page.locator('.mode-badge')).to_be_visible();expect(page.locator('[data-check]')).to_be_visible()
    assert page.locator('.solution-zone').bounding_box()['height']>height+100
    page.locator('[data-view="edit"]').click();assert page.locator('#code-editor').bounding_box()['height']>500;page.locator('[data-view="sort"]').click()
    assert page.locator('.solution-zone .code-row').evaluate_all(ROW_IDS)==before
    page.locator('[data-focus]').click();expect(page.locator('#app')).not_to_have_attribute('data-surface','focus');expect(page.locator('.header')).to_be_visible()
    assert page.evaluate('document.fullscreenElement') is None and page.locator('.solution-zone .code-row').evaluate_all(ROW_IDS)==before
def focus_without_fullscreen_api(browser):
    """Without the Fullscreen API (iOS Safari) Focus is a fixed overlay that scrolls itself; Escape leaves it."""
    context=watch(browser.new_context(viewport={'width':1280,'height':800}));context.add_init_script('delete Element.prototype.requestFullscreen')
    try:
        page=context.new_page();reset(page,BASE);practice(page);page.locator('[data-focus]').click()
        expect(page.locator('#app')).to_have_attribute('data-surface','focus');assert page.evaluate('document.fullscreenElement') is None
        assert page.evaluate('getComputedStyle(document.querySelector("#app")).position')=='fixed'
        page.locator('h1').click();page.keyboard.press('Escape');expect(page.locator('#app')).not_to_have_attribute('data-surface','focus');expect(page.locator('.header')).to_be_visible()
    finally:context.close()
def code_views(page):
    """ADR-106: two code views, remembered across a reload; on a fine pointer the editor rows are 28 px and
    continuous, the cards 40 px tiles. (The drag suite runs in full in both views.)"""
    practice(page)
    for view,height in [('cards',40),('editor',28)]:
        page.locator(f'[data-set-code-view="{view}"]').click();expect(page.locator('#app')).to_have_attribute('data-code-view',view)
        expect(page.locator(f'[data-set-code-view="{view}"]')).to_have_attribute('aria-pressed','true');expect(page.locator(f'[data-set-code-view="{view}"]')).to_be_focused()
        row=page.locator('.source-zone .code-row').first;assert abs(row.bounding_box()['height']-height)<=2,(view,row.bounding_box())
        if view=='cards':
            page.reload();practice(page);expect(page.locator('#app')).to_have_attribute('data-code-view','cards')
def source_gate(page):
    """ADR-108 (E5a): a definite language error keeps the author on the source step, with the reason at the
    editor's line; the previous model stays; a fixed source passes the gate."""
    page.locator('[data-source-kind="code"]').click()
    page.locator('[data-author="language"]').select_option('typescript')
    page.locator('#author-editor').fill('function f() {\n  const a: number = 1;\n\n  const b: string = a;\n  return b;\n}');page.locator('[data-author-apply]').click()
    expect(page.locator('.author-status')).to_contain_text('nyelvi hibát tartalmaz');expect(page.locator('.author-status')).to_contain_text('4. sor');current(page,'source')
    expect(page.locator('[data-step="rules"]')).to_be_disabled()
    page.locator('#author-editor').fill('function f() {\n  const a: number = 1;\n\n  const b: number = a;\n  return b;\n}');page.locator('[data-author-apply]').click();current(page,'rules')
def second_gate(page):
    """ADR-108 (E6): the Try step opens through the second gate; an unapplied source change after the model
    is stale evidence: the step stays closed, the author lands on Rules with the reason and the stale notice,
    and rebuilding from there opens it again."""
    build(page,rules_source);to_try(page);expect(page.locator('.solution-zone')).to_be_visible()
    page.locator('[data-step="source"]').click();page.locator('#author-editor').fill(rules_source+'\n// változás')
    page.locator('[data-step="try"]').click();current(page,'rules')
    expect(page.locator('main')).to_contain_text('a modell készítése óta változott');expect(page.locator('.solution-zone')).to_have_count(0)
    page.locator('[data-stale-notice] [data-author-apply]').click();expect(page.locator('[data-stale-notice]')).to_have_count(0);current(page,'rules');to_try(page)
def preflight_ui(page):
    """ADR-108 (E7): grouped settings from the resolver; the conservative profile locks controls that say why
    and give the choice back; a refused source lists its findings with the certainty in words, the line as a
    button that selects it in the editor, and the step's state; an edited source marks the findings out of date."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();box=analysis_options(page)
    # The Format action is a labelled, visible button again (it had become a bare, borderless icon). A plate has no line:
    # what makes it a button to the eye is its face, the layer under the label (ADR-143, D3b).
    fmt=page.locator('[data-author-format]');expect(fmt).to_be_visible();expect(fmt).to_have_text('Formázás')
    assert fmt.evaluate("b=>!/^rgba\\(.*, 0\\)$|^transparent$/.test(getComputedStyle(b,'::after').backgroundColor)")
    # ADR-123 (M5): the Kód step holds what the source check looks for; the environment and the profile are in Elemzés és szabályok.
    expect(box.locator('legend',has_text='Forrás biztonságossága')).to_have_count(1)
    for legend in ['Elemzési környezet','Haladó profil']:expect(box.locator('legend',has_text=legend)).to_have_count(0)
    expect(page.locator('[data-preflight="jsCheck"]')).to_have_count(1);expect(page.locator('[data-preflight="tsDiagnostics"]')).to_have_count(0);expect(page.locator('[data-preflight="inputs"]')).to_have_count(0)
    summary=box.locator('[data-preflight-summary]')
    # ADR-113: the Local Demo loads the standard library, so it offers what the server offers (C16 only without it).
    expect(page.locator('[data-preflight="unknownPolicy"] option[value="block"]')).to_be_enabled();expect(page.locator('[data-server-only]')).to_have_count(0)
    page.locator('[data-preflight="unknownPolicy"]').select_option('block');expect(summary).to_contain_text('bizonytalan: tilt')
    page.locator('[data-preflight="unknownPolicy"]').select_option('warn')
    build(page,rules_source);box=analysis_options(page)
    for legend in ['Elemzési környezet','Haladó profil']:expect(box.locator('legend',has_text=legend)).to_have_count(1)
    expect(box.locator('legend',has_text='Forrás biztonságossága')).to_have_count(0);expect(page.locator('[data-preflight="objectState"]')).to_have_count(0)
    expect(page.locator('[data-preflight="inputs"] option:checked')).to_contain_text('új feladat kezdőértéke')
    summary=box.locator('[data-preflight-summary]')
    page.locator('[data-preflight="portability"]').select_option('conservative')
    inputs=page.locator('[data-preflight="inputs"]');expect(inputs).to_be_disabled();expect(inputs).to_have_value('any');expect(summary).to_contain_text('3 zárolt')
    expect(page.locator('[data-stale-notice]')).to_contain_text('beállítások a modell készítése óta változtak')
    why=page.locator('[data-lock-why="inputs"]');why.locator('summary').focus();page.keyboard.press('Enter')
    expect(why).to_have_attribute('open','');expect(why.locator('p')).to_contain_text('Feloldás');expect(why.locator('p')).to_contain_text('Érvényes egyszerű adat')
    page.locator('[data-preflight="portability"]').select_option('configured');expect(inputs).to_be_enabled();expect(inputs).to_have_value('valid');expect(summary).not_to_contain_text('zárolt')
    expect(page.locator('[data-stale-notice]')).to_have_count(0);page.locator('[data-step="source"]').click()
    page.locator('#author-editor').fill('function f() {\n  const a = b;\n  const b = 1;\n  return a;\n}');page.locator('[data-author-apply]').click();current(page,'source')
    findings=page.locator('[data-source-diagnostics]');expect(findings).to_contain_text('Biztos hiba');expect(findings).to_contain_text('BS001')
    expect(page.locator('[data-step="source"] [data-step-status]')).to_have_text('Hiba')
    findings.locator('[data-goto-line="2"]').click();expect(page.locator('#author-editor')).to_be_focused()
    assert page.evaluate("()=>{const e=document.querySelector('#author-editor');return e.value.slice(e.selectionStart,e.selectionEnd)}")=='  const a = b;'
    page.locator('#author-editor').fill('function f() {\n  const b = 1;\n  const a = b;\n  return a;\n}')
    # ADR-122: the step's word is for the text the gate checked; typing clears it at once, without a redraw.
    expect(page.locator('[data-step="source"] [data-step-status]')).to_have_text('')
    page.locator('[data-preflight="objectState"]').select_option('off');expect(page.locator('[data-diagnostics-stale]')).to_be_visible();expect(page.locator('[data-step="source"] [data-step-status]')).to_have_text('')
    page.locator('[data-author-apply]').click();current(page,'rules');page.locator('[data-step="source"]').click()
    expect(page.locator('[data-source-diagnostics]')).to_have_count(0);analysis_options(page);expect(page.locator('[data-preflight="objectState"]')).to_have_value('off')
def task_status(page):
    """ADR-122 (M3): the Rules step answers three questions in one card (a word and a colour each), gives one next step
    and names the step's state in the stepper's one vocabulary; a conservative model shows its rule kinds on request,
    the next step opens the Try step."""
    build(page,'const a = 1;\n/* egy\n   megjegyzés */\nconst b = 2;\nconsole.log(a, b);')
    card=page.locator('[data-task-status]');expect(card.locator('[data-task-answer]')).to_have_count(3)
    fair=card.locator('[data-task-answer="fair"]');expect(fair).to_have_class(re.compile('tone-warning'));expect(fair).to_contain_text('Részben');expect(fair).to_contain_text('óvatos szabály')
    expect(card.locator('[data-task-answer="checkable"]')).to_have_class(re.compile('tone-ok'));expect(card.locator('[data-task-answer="fillable"]')).to_contain_text('A referencia elfogadott; 5 sor.')
    expect(page.locator('[data-step="rules"] [data-step-status]')).to_have_text('Figyelem')
    fair.locator('[data-show-rule-kinds]').click();expect(page.locator('[data-rule-kinds]')).to_have_attribute('open','');expect(page.locator('[data-rule-kinds] > summary')).to_be_focused()
    expect(page.locator('.action-bar [data-task-next]')).to_contain_text('Következő lépés');page.locator('.action-bar [data-goto="try"]').click();current(page,'try')
    build(page,'const a = 1;\nconst b = 2;\nconsole.log(a, b);')
    card=page.locator('[data-task-status]');expect(card).to_have_class(re.compile('tone-ok'));expect(card.locator('.tone-ok')).to_have_count(3)
    expect(page.locator('[data-step="rules"] [data-step-status]')).to_have_text('Kész');expect(page.locator('[data-task-next]')).to_contain_text('Próbáld ki tanulóként.')
def help_toggletips(page):
    """ADR-124 (H1–H3): an ⓘ beside a setting opens a bubble with the help's example and a link to the help page at the
    topic in a new tab; Escape closes it and returns the focus. The help page holds every topic at its anchor, and the
    search narrows it to the topics holding every word."""
    build(page,rules_source);analysis_options(page)
    tip=page.locator('.toggletip[data-help="keyOrder"]');button=tip.locator('.info-button');panel=tip.locator('.toggletip-panel')
    button.click();expect(panel).to_be_visible();expect(button).to_have_attribute('aria-expanded','true')
    # ADR-141 (T2): the key-order example (10 lines) is the help page's: the bubble says its sentence and links there;
    # a short example (the inputs', 5 lines) stands in its bubble.
    expect(panel).to_contain_text('JSON.stringify');expect(panel.locator('.help-code')).to_have_count(0);expect(panel).to_contain_text('Példa és kipróbálás a súgóban')
    inputs=page.locator('.setting-head .toggletip[data-help="inputs"]');inputs.locator('.info-button').click()
    expect(inputs.locator('.toggletip-panel')).to_contain_text('A 2. és 3. sor cseréje');expect(inputs.locator('.toggletip-panel')).to_contain_text('elfogadva')
    page.keyboard.press('Escape');button.click();expect(panel).to_be_visible()
    link=panel.locator('a.help-link');expect(link).to_have_attribute('target','_blank');expect(link).to_have_attribute('href','./help/index.html#keyOrder')
    box=panel.bounding_box();width=page.viewport_size['width'];assert box['x']>=0 and box['x']+box['width']<=width,(box,width)
    page.keyboard.press('Escape');expect(panel).to_be_hidden();expect(button).to_be_focused();expect(button).to_have_attribute('aria-expanded','false')
    expect(page.locator('.toggletip[data-help="fillable"]')).to_have_count(1);expect(page.locator('.toggletip[data-help="qualification"]')).to_have_count(1)
    # ADR-141: the focus leaving the bubble closes it (Tab past its last link), so nothing it covers is reached under it.
    button.click();expect(panel).to_be_visible()
    for _ in range(12):
        page.keyboard.press('Tab')
        if not page.evaluate('()=>!!document.activeElement?.closest(\'.toggletip[data-help="keyOrder"]\')'):break
    expect(panel).to_be_hidden()
    with page.expect_popup() as popup:
        button.click();link.click()
    help_page=popup.value;expect(help_page.locator('#keyOrder')).to_be_visible();expect(help_page.locator('#keyOrder')).to_contain_text('Nem számít')
    help_page.locator('[data-help-search]').fill('osztálymező');expect(help_page.locator('[data-help-count]')).to_contain_text('találat')
    expect(help_page.locator('#classFields')).to_be_visible();expect(help_page.locator('#keyOrder')).to_be_hidden()
    help_page.locator('[data-help-search]').fill('');expect(help_page.locator('#keyOrder')).to_be_visible();help_page.close()
def local_demo_responsive(page):
    """ADR-125 (NY-32): on Pages the engine runs in a worker, so making the model of the 436-line TypeScript sample never
    holds the page still for a second (it held it about 2.4 s on the main thread). The server's API has no worker."""
    if page.url.startswith(BASE):return
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click()
    open_menu(page,'open');page.locator('[data-author-sample]').click();expect(page.locator('#author-editor')).to_have_value(re.compile('CopyFieldUtilityService'))
    page.evaluate("()=>{window.__long=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__long.push(entry.duration);}).observe({type:'longtask'});}")
    page.locator('[data-author-apply]').click();expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step',timeout=120000)
    longest=page.evaluate('Math.round(Math.max(0,...window.__long))');assert longest<1000,f'the main thread stood still {longest} ms while the model was made'
    print(f'INFO local demo: longest main-thread task {longest} ms while the 436-line sample was analysed',flush=True)
def inputs_override(page):
    """ADR-126 (NY-29): a new draft asks for valid inputs; a program that can change what a read does keeps the analysis
    strict, and the Rules step says so (asked → effective), why, and links the line in the source."""
    build(page,'const box = { a: 1 };\nconst p = new Proxy(box, {});\nconst a = p.a;\nconsole.log(a);')
    shown=page.locator('[data-inputs-override="hook"]');expect(shown).to_contain_text('érvényes egyszerű adat → szigorú lett');expect(shown).to_contain_text('„Proxy”')
    # ADR-141: the bubble's blocks closed the line's <p> and pushed the rest of the line out of it: all four parts stay in.
    expect(page.locator('[data-analysis-settings] > *')).to_have_count(4);expect(page.locator('[data-analysis-settings]')).to_contain_text('A modell ezzel a környezettel készült.')
    tip=shown.locator('.toggletip[data-help="inputs"]');tip.locator('.info-button').click();expect(tip.locator('.toggletip-panel')).to_be_visible();page.keyboard.press('Escape')
    shown.locator('[data-goto-line="2"]').click();current(page,'source');expect(page.locator('#author-editor')).to_be_focused()
    assert page.evaluate("()=>{const e=document.querySelector('#author-editor');return e.value.slice(e.selectionStart,e.selectionEnd)}").startswith('const p = new Proxy')
    build(page,'const a = 1;\nconsole.log(a);');expect(page.locator('[data-inputs-override]')).to_have_count(0);expect(page.locator('[data-inputs-contract]')).to_have_text('Bemenetek: érvényes egyszerű adat')
def session_settings(page):
    """ADR-108 (E8): a saved session records the analysis settings the model was made under and brings them back
    (recorded); an older version-1 file restores the model with the start values and says the origin is partial."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();analysis_options(page)
    page.locator('[data-preflight="objectState"]').select_option('off');page.locator('#author-editor').fill(rules_source);page.locator('[data-author-apply]').click();current(page,'rules')
    open_menu(page,'session');page.locator('[data-save-local]').click()
    saved=page.evaluate("()=>JSON.parse(localStorage.getItem('ngdynamic.author-session.v1'))")
    assert saved['version']==2 and saved['authorSettings']['policy']=={'objectState':'off'},saved.get('authorSettings')
    page.reload();current(page,'source');open_menu(page,'session');page.locator('[data-load-local]').click();current(page,'try')
    page.locator('[data-step="rules"]').click();expect(page.locator('[data-settings-origin="recorded"]')).to_be_visible()
    page.locator('[data-step="source"]').click();analysis_options(page);expect(page.locator('[data-preflight="objectState"]')).to_have_value('off')
    page.evaluate("()=>{const s=JSON.parse(localStorage.getItem('ngdynamic.author-session.v1'));s.version=1;delete s.authorSettings;localStorage.setItem('ngdynamic.author-session.v1',JSON.stringify(s));}")
    page.reload();current(page,'source');open_menu(page,'session');page.locator('[data-load-local]').click();current(page,'try')
    page.locator('[data-step="rules"]').click();expect(page.locator('[data-settings-origin="partial"]')).to_contain_text('hitelessége ezért részleges')
    page.locator('[data-step="source"]').click();analysis_options(page);expect(page.locator('[data-preflight="objectState"]')).to_have_value('local')
    # The author's own JSON edit keeps the author's settings (a model does not record them).
    page.locator('[data-preflight="objectState"]').select_option('off');page.locator('[data-author-apply]').click();current(page,'rules')
    rules_json(page);edited=json.loads(page.locator('#model-editor').input_value());edited['title']='JSON-ból';page.locator('#model-editor').fill(json.dumps(edited));page.locator('[data-model-apply]').click()
    expect(page.locator('h1')).to_have_text('JSON-ból');page.locator('[data-step="source"]').click();analysis_options(page);expect(page.locator('[data-preflight="objectState"]')).to_have_value('off')
def menus(page):
    """ADR-105: a header or step menu opens on its summary and closes on Escape, an outside click or an action inside."""
    menu=page.locator('details.session-menu');menu.locator('summary').click();expect(menu).to_have_attribute('open','')
    page.keyboard.press('Escape');expect(menu).not_to_have_attribute('open','');expect(menu.locator('summary')).to_be_focused()
    menu.locator('summary').click();page.locator('h1').click();expect(menu).not_to_have_attribute('open','')
    opener=page.locator('details.open-menu');opener.locator('summary').click();expect(page.locator('[data-start-example]')).to_be_visible()
    page.locator('details.analysis-options > summary').click();expect(opener).not_to_have_attribute('open','');expect(page.locator('[data-preflight="objectState"]')).to_be_visible()

def steps_locked_until_model(page):
    for step in ['rules','try']:expect(page.locator(f'[data-step="{step}"]')).to_be_disabled()
    expect(page.locator('[data-author-status]')).to_contain_text('Még nem készült modell')
    expect(page.locator('.library')).to_have_count(0);expect(page.locator('[data-task]')).to_have_count(0)
    build(page,rules_source)
    for step in ['rules','try']:expect(page.locator(f'[data-step="{step}"]')).to_be_enabled()
    expect(page.locator('[data-board-line]')).to_have_count(6);page.locator('[data-goto="try"]').click();current(page,'try');expect(page.locator('.source-zone .code-row')).to_have_count(6)
    page.locator('[data-goto="rules"]').click();current(page,'rules');page.locator('[data-goto="source"]').click();current(page,'source')
def model_first(page):
    json_model(page,model);to_try(page);expect(page.locator('.solution-zone .code-row')).to_have_count(7)
    page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
COUNT_RENDERS="()=>{window.__renders=0;new MutationObserver(()=>window.__renders++).observe(document.querySelector('#app'),{childList:true});}"
HEADER_STATE="""()=>{const h=document.querySelector('.header'),word=document.querySelector('.header .brand strong'),label=document.querySelector('.header .brand small');
 const tops=[...h.children].filter(k=>k.getClientRects().length).map(k=>k.getBoundingClientRect().top);
 return {step:h.dataset.brand,fits:h.scrollWidth<=h.clientWidth,rows:Math.max(...tops)-Math.min(...tops),word:word.getBoundingClientRect().width,label:label.getClientRects().length?label.textContent:'',page:document.documentElement.scrollWidth}}"""
def header_logo_fits(browser):
    """ADR-137: the app bar's logo keeps its wordmark wherever it fits, measured, not by a breakpoint: on every phone width
    the bar is one row that does not overflow and the wordmark is shown (only a far wider font than ours falls back to
    the mark alone); the EDITOR label stands beside it where the row has room (the desktop)."""
    for width in (320,360,390,412,430,600,1280):
        context=watch(browser.new_context(viewport={'width':width,'height':800},**({'is_mobile':True,'has_touch':True} if width<700 else {})));page=context.new_page()
        try:
            reset(page,BASE);build(page,rules_source)
            state=page.evaluate(HEADER_STATE)
            assert state['fits'] and state['page']<=width,f'{width}px: the app bar overflows {state}'
            assert state['word']>60 and state['step']!='mark',f'{width}px: the wordmark is hidden although it fits {state}'
            if width<650:assert state['rows']<12,f'{width}px: the app bar is one row {state}'
            if width>=1280:assert state['step']=='complete' and state['label']=='Editor',state
            assert 'Studio' not in page.locator('.header').inner_text()
            # A wider font (another device) still never overflows: the logo steps back as far as it must.
            page.evaluate("()=>{const sheet=[...document.styleSheets].at(-1);sheet.insertRule('.brand strong{letter-spacing:3px!important}',sheet.cssRules.length);dispatchEvent(new Event('resize'));}")
            page.locator('[data-step="source"]').click()
            state=page.evaluate(HEADER_STATE);assert state['fits'] and state['page']<=width,f'{width}px, wide font: {state}'
        finally:context.close()
def rule_icons_in_one_column(browser):
    """ADR-153 (NY-59c): in the Try lists a row's rule icons stand in one column, in a fixed row too: its tag takes the room
    the three move buttons take in the other rows. The arcs of the selected row stand before the controls of every row, so
    none runs behind an icon; that holds where a fixed row's controls are narrower too (the tag is shrunk by the test: the
    first row alone used to say where the arcs stand)."""
    measure="""()=>{const rows=[...document.querySelectorAll('.solution-zone > .code-row')],left=e=>Math.round(e.getBoundingClientRect().left*10)/10;
      return {fixed:rows.filter(row=>row.classList.contains('fixed-row')).map(row=>row.dataset.index),icons:[...new Set(rows.map(row=>left(row.querySelector('[data-rule-line]'))))],
       controls:Math.min(...rows.map(row=>left(row.querySelector('.row-actions')))),arcs:[...document.querySelectorAll('.solution-zone .zone-arcs path.arc')].map(path=>Math.round(path.getBoundingClientRect().right*10)/10)}}"""
    for shrunk in [False,True]:
        context=watch(browser.new_context(viewport={'width':1440,'height':900},bypass_csp=shrunk));page=context.new_page()
        try:
            reset(page,BASE);build(page,rules_source);pin=page.locator('.board-row[data-board-line="1"] [data-rule-pin]');pin.click();expect(pin).to_have_attribute('aria-pressed','true')
            to_try(page);page.locator('[data-all]').click();expect(page.locator('.solution-zone .fixed-tag')).to_have_count(1)
            if shrunk:page.add_style_tag(content='.solution-row .fixed-tag{min-width:0!important}')
            page.locator('.solution-zone [data-rule-line="5"]').click();expect(page.locator('.solution-zone .zone-arcs path.arc')).not_to_have_count(0)
            m=page.evaluate(measure);assert m['fixed']==['0'],m
            assert len(m['icons'])==(2 if shrunk else 1),f"the rule icons of the rows stand at {m['icons']}"
            assert max(m['arcs'])<=m['controls'],f"an arc runs behind the row controls ({'shrunk tag' if shrunk else 'as drawn'}): {m}"
        finally:context.close()
def result_bar_sticks(browser):
    """ADR-139: the result bar (Ellenőrzés) sticks to the bottom of the screen in practice and in the author's Try step, at
    every width, as a step's action bar does: with the page at its top the bar is on the screen, at the bottom or (its
    step ending sooner) at its own place."""
    for viewport,touch in (({'width':1280,'height':640},False),({'width':1440,'height':700},False),({'width':390,'height':700},True)):
        context=watch(browser.new_context(viewport=viewport,**({'is_mobile':True,'has_touch':True} if touch else {})));page=context.new_page()
        try:
            reset(page,BASE)
            def stuck(where):
                page.evaluate('window.scrollTo(0,0)')
                box=page.locator('.evaluation-bar').bounding_box();height=page.evaluate('innerHeight')
                assert page.evaluate('document.documentElement.scrollHeight')>height,f'{where}: the page is longer than the screen'
                # Stuck at the bottom, or (its step ending above the bottom) at its own place: never below the screen.
                assert box['y']>=0 and box['y']+box['height']<=height+1,f"{viewport['width']}px {where}: the result bar is off the screen ({box}, {height})"
            practice(page);page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva');stuck('practice')
            page.locator('[data-mode="author"]').click();build(page,rules_source);to_try(page);page.locator('[data-all]').click();stuck('author try')
        finally:context.close()
def background_render_keeps_menu(page):
    """ADR-136: no answer redraws the page under the author's first click: the starting policy is resolved before the
    first render (held, the page waits for it). A later background answer (a changed setting's resolution) redraws the
    page and leaves a menu the author opened meanwhile open (on a slow network it closed under the pointer: CI's
    source_file failure); a choice in the menu still closes it."""
    held=[]
    page.route('**/api/author/policy*',lambda route:held.append(route))
    try:
        page.goto(BASE)
        for _ in range(200):
            if held:break
            page.wait_for_timeout(25)
        assert held,'the starting policy is asked'
        page.wait_for_timeout(300);assert page.locator('[data-step]').count()==0,'the first render waits for the starting policy'
        route=held.pop();route.fulfill(response=route.fetch())
        expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
        page.evaluate(COUNT_RENDERS);page.wait_for_timeout(300);assert page.evaluate('window.__renders')==0,'nothing redraws the loaded page by itself'
        page.locator('[data-author="language"]').select_option('typescript')
        for _ in range(200):
            if held:break
            page.wait_for_timeout(25)
        assert held,'a changed setting asks for its policy'
        menu=open_menu(page,'open');expect(page.locator('[data-import-source]')).to_be_visible()
        page.evaluate(COUNT_RENDERS);route=held.pop();route.fulfill(response=route.fetch())
        page.wait_for_function('()=>window.__renders>0')
        expect(menu).to_have_attribute('open','');expect(page.locator('[data-import-source]')).to_be_visible()
        page.locator('[data-author-sample]').click();expect(page.locator('details.open-menu')).not_to_have_attribute('open','')
        # ADR-141: an open ⓘ bubble stays open too, through a render the reader did not cause.
        page.locator('[data-author="language"]').select_option('javascript')
        for _ in range(200):
            if held:break
            page.wait_for_timeout(25)
        assert held,'a changed setting asks for its policy'
        box=page.locator('details.analysis-options[data-settings-scope="source"]')
        if box.get_attribute('open') is None:box.locator(':scope > summary').click()
        tip=page.locator('.toggletip[data-help="jsCheck"]');tip.locator('.info-button').click();expect(tip.locator('.toggletip-panel')).to_be_visible()
        page.evaluate(COUNT_RENDERS);route=held.pop();route.fulfill(response=route.fetch())
        page.wait_for_function('()=>window.__renders>0')
        tip=page.locator('.toggletip[data-help="jsCheck"]');expect(tip.locator('.toggletip-panel')).to_be_visible();expect(tip.locator('.info-button')).to_have_attribute('aria-expanded','true')
        page.keyboard.press('Escape');expect(tip.locator('.toggletip-panel')).to_be_hidden()
    finally:page.unroute('**/api/author/policy*')
def source_file(page):
    with page.expect_file_chooser() as chooser:open_menu(page,'open');page.locator('[data-import-source]').click()
    chooser.value.set_files({'name':'typed.ts','mimeType':'text/plain','buffer':source.encode()})
    # ADR-121: a file already broken into lines keeps the author's own indentation.
    expect(page.locator('#author-editor')).to_have_value(source);expect(page.locator('[data-author="language"]')).to_have_value('typescript');expect(page.locator('.author-status')).to_contain_text('még nincs alkalmazva')
    for step in ['rules','try']:expect(page.locator(f'[data-step="{step}"]')).to_be_disabled()
    page.locator('[data-author-apply]').click();current(page,'rules');to_try(page);expect(page.locator('.source-zone .code-row')).to_have_count(5)
    page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    rules_json(page);generated=json.loads(page.locator('#model-editor').input_value());assert generated['language']=='typescript';assert '\n'.join(line['code'] for line in generated['lines'])==source
def json_file(page):
    page.locator('[data-source-kind="json"]').click()
    with page.expect_file_chooser() as chooser:page.locator('[data-import-model]').click()
    chooser.value.set_files({'name':'exercise.json','mimeType':'application/json','buffer':json.dumps(model).encode()})
    current(page,'rules');expect(page.locator('h1')).to_have_text(model['title'])
    to_try(page);expect(page.locator('.source-zone .code-row')).to_have_count(7)
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();expect(page.locator('#author-editor')).to_have_value('\n'.join(line['code'] for line in model['lines']))
def fixed_crossing(page):
    fixed_model={'schemaVersion':2,'id':'fixed-only','revision':1,'language':'javascript','title':'Fixed slots','description':'','blocks':[],'lines':[{'id':i,'code':f'const v{i} = {i};','dependencies':[],'fixed':i==3,'functionBlock':0,'scopeId':None} for i in range(1,6)]}
    json_model(page,fixed_model);to_try(page);expect(page.locator('.solution-zone .code-row')).to_have_count(5)
    page.locator('[data-all]').click();page.locator('[data-down="1"]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    assert [row.get_attribute('data-line-id') for row in page.locator('.solution-zone .code-row').all()]==['1','4','3','2','5']

def learner(page):
    model_first(page);rules_json(page);draft=page.locator('#model-editor').input_value();to_try(page);page.locator('[data-preview-toggle]').click()
    expect(page.locator('#app')).to_have_class(re.compile('learner-preview'))
    for selector in ['[data-step]','[data-mode]','[data-all]','.library','[data-save-local]','[data-board-line]']:expect(page.locator(selector)).to_have_count(0)
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva');expect(page.locator('[data-arrangement-progress]')).to_have_attribute('value','7')
    # Internal token witnesses and author dependency IDs are not learner-facing tools.
    expect(page.locator('[data-validation-witness]')).to_have_count(0);expect(page.locator('.technical-details')).to_have_count(0)
    page.screenshot(path=str(ARTIFACTS/'ux-learner.png'),full_page=True)
    page.locator('[data-preview-toggle]').click();current(page,'try');expect(page.locator('[data-preview-toggle]')).to_be_focused()
    rules_json(page);expect(page.locator('#model-editor')).to_have_value(draft)
def keyboard_draft(page):
    model_first(page);page.locator('[data-view="sort"]').focus();page.keyboard.press('ArrowRight');expect(page.locator('[data-view="edit"]')).to_be_focused();expect(page.locator('[data-view="sort"]')).to_have_attribute('aria-selected','true');page.keyboard.press('Enter')
    expect(page.locator('[data-view="edit"]')).to_have_attribute('aria-selected','true');expect(page.locator('[data-check]')).to_have_count(0);page.locator('#code-editor').fill('unfinished local draft');expect(page.locator('[data-editor-status]')).to_contain_text('Nem alkalmazott változat');expect(page.locator('[data-view="edit"] .dirty-dot')).to_have_count(1)
    page.locator('[data-step="source"]').click();page.locator('[data-step="try"]').click();page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_have_value('unfinished local draft')
    page.locator('[data-view="sort"]').click();page.locator('[data-down="2"]').click();page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_have_value('unfinished local draft');expect(page.locator('.draft-notice')).to_contain_text('rendező')
    page.screenshot(path=str(ARTIFACTS/'ux-editor.png'),full_page=True)
def continuity(page):
    model_first(page);page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.locator('.workspace-help summary').click();page.locator('[data-copy-solution]').click();expect(page.locator('.workspace-help')).to_have_attribute('open','');expect(page.locator('[data-copy-solution]')).to_be_focused()
    assert page.locator('[data-copy-solution]').count()==1 and page.locator('[data-copy-arrangement]').count()==1
    rules_json(page);page.locator('[data-dependency-table] summary').click();page.screenshot(path=str(ARTIFACTS/'ux-model.png'),full_page=True)

def reference_continuity(page):
    """One author project: practice selections never touch it; examples are starting points."""
    examples={m['id']:m for m in [json.loads(f.read_text(encoding='utf-8')) for f in (ROOT/'examples').glob('*.json')]}
    draft='function changedDraft() {\n     return 21;\n}'
    page.locator('#author-editor').fill(draft)
    practice(page);tasks=page.locator('[data-task]');second=tasks.nth(1).get_attribute('data-task');tasks.nth(1).click()
    expect(page.locator('h1')).to_have_text(examples[second]['title']);page.locator('[data-all]').click()
    page.locator('[data-mode="author"]').click();current(page,'source');expect(page.locator('#author-editor')).to_have_value(draft)
    page.locator('[data-source-kind="json"]').click();page.locator('#model-editor').fill('{unfinished JSON');page.locator('[data-source-kind="code"]').click();page.locator('[data-source-kind="json"]').click();expect(page.locator('#model-editor')).to_have_value('{unfinished JSON')
    page.locator('[data-source-kind="code"]').click();page.locator('[data-author-apply]').click();current(page,'rules');expect(page.locator('[data-board-line]')).to_have_count(3)
    to_try(page);page.locator('[data-all]').click();page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('incorrect answer draft')
    page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.locator('[data-step="try"]').click();page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_have_value('incorrect answer draft')
    page.locator('[data-editor-reload]').click();assert 'changedDraft' in page.locator('#code-editor').input_value();expect(page.locator('[data-editor-status]')).to_contain_text('rendező aktuális')
    page.locator('[data-apply]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    # The practice attempt kept its own arrangement.
    practice(page);expect(page.locator('h1')).to_have_text(examples[second]['title']);expect(page.locator('[data-arrangement-progress]')).to_have_attribute('value',str(len(examples[second]['lines'])))
    # An example loaded as a starting point makes the applied model stale until rebuilt or discarded.
    page.locator('[data-mode="author"]').click();current(page,'try');page.locator('[data-step="source"]').click()
    # M2: choosing an example loads it at once; there is no load button, and Undo brings the previous source back.
    open_menu(page,'open');expect(page.locator('[data-start-load]')).to_have_count(0);before=page.locator('#author-editor').input_value()
    page.locator('[data-start-example]').select_option(second);expect(page.locator('#author-editor')).to_have_value('\n'.join(l['code'] for l in examples[second]['lines']))
    page.locator('[data-author-undo]').click();expect(page.locator('#author-editor')).to_have_value(before);expect(page.locator('[data-author-undo]')).to_have_count(0)
    open_menu(page,'open');page.locator('[data-start-example]').select_option(second);expect(page.locator('#author-editor')).to_have_value('\n'.join(l['code'] for l in examples[second]['lines']))
    page.locator('#author-editor').press('End');page.locator('#author-editor').type(' ');expect(page.locator('[data-author-undo]')).to_be_hidden();page.locator('#author-editor').press('Backspace')
    expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott referencia');expect(page.locator('[data-step="source"] .dirty-dot')).to_have_count(1)
    page.locator('[data-step="rules"]').click();expect(page.locator('[data-stale-notice]')).to_contain_text('referenciaforrás');expect(page.locator('[data-step="try"]')).to_contain_text('Elavult')
    page.locator('[data-stale-notice] [data-author-revert]').click();expect(page.locator('[data-stale-notice]')).to_have_count(0)
    page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.screenshot(path=str(ARTIFACTS/'ux-reference-workspace.png'),full_page=True)
def stale_rebuild_updates_every_step(page):
    """Regenerating from a changed source refreshes rules, JSON and try; nothing keeps the old model."""
    build(page,rules_source);to_try(page);page.locator('[data-all]').click()
    page.locator('[data-step="source"]').click();page.locator('#author-editor').fill(rules_source.replace('  g(b, c);\n','  g(b, c);\n  h(c);\n'))
    # The second gate (ADR-108, E6) refuses Try for a stale source and lands on Rules with the stale notice.
    page.locator('[data-step="try"]').click();current(page,'rules');expect(page.locator('[data-stale-notice]')).to_contain_text('referenciaforrás');expect(page.locator('main')).to_contain_text('A Próba lépés nem nyitható meg')
    page.locator('[data-stale-notice] [data-author-apply]').click();expect(page.locator('[data-stale-notice]')).to_have_count(0)
    current(page,'rules');expect(page.locator('[data-board-line]')).to_have_count(7)
    rules_json(page);assert len(json.loads(page.locator('#model-editor').input_value())['lines'])==7
    to_try(page);expect(page.locator('.source-zone .code-row')).to_have_count(7);expect(page.locator('.solution-zone .code-row:not(.blank-row)')).to_have_count(0)
    # A JSON edit applied in the rules step is what the try step uses next.
    rules_json(page);edited=json.loads(page.locator('#model-editor').input_value());edited['title']='Átnevezett feladat';page.locator('#model-editor').fill(json.dumps(edited))
    page.locator('[data-step="try"]').click();expect(page.locator('[data-stale-notice]')).to_contain_text('JSON');page.locator('[data-open-json]').click()
    page.locator('[data-model-apply]').click();current(page,'rules');expect(page.locator('h1')).to_have_text('Átnevezett feladat');expect(page.locator('[data-stale-notice]')).to_have_count(0)
def legacy_dependency_refresh(page):
    legacy=json.loads((ROOT/'tests/fixtures/evaluate-legacy-serial.model.json').read_text(encoding='utf-8'))
    json_model(page,legacy);to_try(page);expect(page.locator('.source-zone .code-row')).to_have_count(7)
    order=[1,3,5,2,4,6,7];codes={line['id']:line['code'] for line in legacy['lines']}
    page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('\n'.join(codes[i] for i in order));page.locator('[data-apply]').click()
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Hibás')
    rules_json(page);expect(page.locator('[data-dependency-refresh]')).to_contain_text('Régebbi generált modell')
    before=json.loads(page.locator('#model-editor').input_value());assert [l['dependencies'] for l in before['lines']]==[l['dependencies'] for l in legacy['lines']]
    page.locator('[data-model-refresh]').click();expect(page.locator('[data-model-status]')).to_contain_text('Aktív modell');current(page,'rules')
    page.locator('[data-rules-view="visual"]').click();expect(page.locator('[data-insight-refresh]')).to_be_visible()
    to_try(page);expect(page.locator('.report')).to_contain_text('Elfogadva')
    assert [int(row.get_attribute('data-line-id')) for row in page.locator('.solution-zone .code-row').all()]==order
    rules_json(page);after=json.loads(page.locator('#model-editor').input_value())
    assert [l['dependencies'] for l in after['lines']]==[[],[1],[1],[2,3],[1],[4,5],[6]]
    assert [(l['id'],l['code'],l['fixed']) for l in after['lines']]==[(l['id'],l['code'],l['fixed']) for l in legacy['lines']]
    assert after['authoring']['dependencyPolicy']==CURRENT_POLICY
    page.screenshot(path=str(ARTIFACTS/('ux-legacy-dependency-refresh-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)

def stale_file_import(page):
    # Hold the actual File.text promise, before either API adapter can start admission.
    for kind in ('model','session'):
        payload=model if kind=='model' else page.evaluate('''async model => {
            const {exportSession}=await import('./app/persistence.js');
            const {createAttempt}=await import('./app/attempt.js');
            return exportSession(model,createAttempt(model),model);
        }''',model)
        page.evaluate('''() => {
            globalThis.originalFileText=File.prototype.text;
            File.prototype.text=function(){
                if(this.name==='delayed-review.json')return new Promise(resolve=>{
                    globalThis.finishReviewFile=async()=>resolve(await originalFileText.call(this));
                });
                return originalFileText.call(this);
            };
        }''')
        try:
            page.locator(f'[data-{kind}-file]').set_input_files({'name':'delayed-review.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
            page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();newer=f'const keepNewer_{kind} = 42;';page.locator('#author-editor').fill(newer)
            # The read starts when the page asks for the file's text; on a slow machine that is after the fill above.
            page.wait_for_function("()=>typeof globalThis.finishReviewFile==='function'")
            page.evaluate('''async () => {await finishReviewFile();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}''')
            expect(page.locator('#author-editor')).to_have_value(newer);current(page,'source');expect(page.locator('[data-step="rules"]')).to_be_disabled()
        finally:page.evaluate('() => {File.prototype.text=originalFileText;delete globalThis.finishReviewFile;}')

def rule_panel(page):
    """ADR-021/022: rules are read and edited on the rules step's board; learner preview shows none of them."""
    build(page,rules_source);expect(page.locator('[data-rule-hint]')).to_be_visible()
    toggle=page.locator('.board-row[data-board-line="3"] [data-rule-line]');toggle.focus();page.keyboard.press('Enter')
    panel=page.locator('[data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','3');expect(toggle).to_have_attribute('aria-pressed','true')
    expect(page.locator('.board-row[data-board-line="1"]')).to_have_class(re.compile('rule-before'));expect(page.locator('.board-row[data-board-line="5"]')).to_have_class(re.compile('rule-after'))
    expect(page.locator('[data-board-arcs] path.arc')).to_have_count(3);expect(page.locator('[data-board-arcs] path[data-arc="3-5"]')).to_have_class(re.compile('after'))
    expect(panel.locator('[data-rule-pair="1-3"] [data-rule-edit="remove"]')).to_have_count(0)
    expect(panel.locator('[data-verification-status]')).to_have_text('Elemzéssel igazolt')
    panel.locator('[data-rule-add="before"] select').select_option('2');panel.locator('[data-rule-add="before"] [data-rule-note]').fill('<img src=x onerror=alert(1)>')
    panel.locator('[data-rule-add="before"] [data-rule-edit="add"]').click()
    expect(panel.locator('[data-verification-status]')).to_have_text('Szerzői döntéssel módosított');expect(page.locator('[data-step-verification]')).to_have_text('Szerzői döntéssel módosított');expect(panel.locator('[data-rule-effect]')).to_contain_text('Szigorítás: igen')
    expect(panel.locator('[data-rule-note-text]')).to_have_text('<img src=x onerror=alert(1)>');expect(page.locator('img[src="x"]')).to_have_count(0)
    # A proven rule needs the acknowledgement the core names; cancelling keeps it.
    page.locator('.board-row[data-board-line="5"] [data-rule-line]').click();expect(panel).to_have_attribute('data-rule-panel-line','5')
    panel.locator('[data-rule-edit="remove"][data-before="3"][data-after="5"]').click();expect(panel.locator('[data-rule-confirm]')).to_contain_text('policy-override')
    panel.locator('[data-rule-cancel]').click();expect(panel.locator('[data-rule-confirm]')).to_have_count(0);expect(panel.locator('[data-rule-pair="3-5"]')).to_have_count(1)
    panel.locator('[data-rule-edit="remove"][data-before="3"][data-after="5"]').click();panel.locator('[data-rule-confirm] [data-rule-note]').fill('Didaktikai döntés')
    panel.locator('[data-rule-edit="confirm"]').click();expect(panel.locator('[data-verification-status]')).to_have_text('Nem igazolt');expect(panel.locator('[data-rule-pair="3-5"]')).to_have_count(0)
    insight=page.locator('[data-model-insight]');expect(insight.locator('[data-verification-status]')).to_have_text('Nem igazolt');expect(insight.locator('[data-insight-relaxations]')).to_contain_text('Didaktikai döntés')
    rules_json(page);edited=json.loads(page.locator('#model-editor').input_value());[relaxed]=edited['authoring']['relaxations'];removed=relaxed.pop('removed');digest=relaxed.pop('sourceDigest');assert re.fullmatch('[0-9a-f]{16}',digest),digest;assert relaxed=={'before':3,'after':5,'editability':'proven','note':'Didaktikai döntés'},relaxed;assert removed['origins']==['dependency'] and removed['reasons'],removed
    to_try(page);page.locator('[data-preview-toggle]').click()
    for selector in ['[data-rule-line]','[data-rule-panel]','[data-rule-hint]','[data-board-line]','.rule-selected,.rule-before,.rule-after']:expect(page.locator(selector)).to_have_count(0)
    page.locator('[data-preview-toggle]').click();page.locator('[data-step="rules"]').click();page.locator('[data-rules-view="visual"]').click();expect(page.locator('[data-rule-panel]')).to_have_attribute('data-rule-panel-line','5')
    page.screenshot(path=str(ARTIFACTS/('ux-rule-panel-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
def rule_connect(page):
    """Drag a line's connector onto another line (pointer) or activate both connectors (keyboard)."""
    build(page,rules_source);expect(page.locator('[data-board-arcs] path.arc')).to_have_count(0)
    page.locator('[data-board-all]').check();expect(page.locator('[data-board-arcs] path.arc')).to_have_count(3)
    source_box=page.locator('[data-rule-connect="4"]').bounding_box();target_box=page.locator('.board-row[data-board-line="3"]').bounding_box()
    page.mouse.move(source_box['x']+source_box['width']/2,source_box['y']+source_box['height']/2);page.mouse.down()
    page.mouse.move(target_box['x']+target_box['width']/2,target_box['y']+target_box['height']/2,steps=8);expect(page.locator('.board-row[data-board-line="3"]')).to_have_class(re.compile('connect-target'));page.mouse.up()
    panel=page.locator('[data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','4')
    expect(panel.locator('[data-rule-pair="3-4"] .rule-badge')).to_have_text('Szerzői');expect(page.locator('[data-board-arcs] path[data-arc="3-4"]')).to_have_count(1)
    expect(panel.locator('[data-rule-effect]')).to_contain_text('Szigorítás: igen')
    page.locator('[data-rule-connect="2"]').focus();page.keyboard.press('Enter');expect(page.locator('.board-connecting')).to_contain_text('#2')
    page.keyboard.press('Escape');expect(page.locator('.board-connecting')).to_have_count(0)
    page.locator('[data-rule-connect="2"]').focus();page.keyboard.press('Enter');page.locator('[data-rule-connect="3"]').focus();page.keyboard.press('Enter')
    expect(panel).to_have_attribute('data-rule-panel-line','2');expect(panel.locator('[data-rule-pair="2-3"] .rule-badge')).to_have_text('Szerzői')
    to_try(page);page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('\n'.join(rules_source.split('\n')[i] for i in [0,2,1,3,4,5]).replace('  ',''));page.locator('[data-apply]').click()
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Hibás')
def pending_reference_survives_rule_edit(page):
    build(page,'function f() {\n  const a = 1;\n  return a;\n}')
    page.locator('[data-step="source"]').click();page.locator('[data-author="language"]').select_option('typescript')
    page.locator('[data-step="rules"]').click();analysis_options(page);expect(page.locator('[data-preflight="importEmit"]')).to_have_value('verbatim');page.locator('[data-step="source"]').click()
    unapplied='function f() {\n  const unapplied = 1;\n}'
    page.locator('#author-editor').fill(unapplied);page.locator('[data-step="rules"]').click();expect(page.locator('[data-stale-notice]')).to_be_visible()
    # ADR-120: one draft at a time. With an unapplied reference the rule editor waits and says why; the draft is kept.
    page.locator('.board-row').first.locator('[data-rule-line]').click();fixed=page.locator('[data-rule-edit="fixed"]')
    expect(fixed).to_have_attribute('aria-disabled','true');fixed.click(force=True);expect(page.locator('.disabled-hint')).to_contain_text('forrás vagy az elemzési beállítás')
    expect(page.locator('[data-edit-paused]')).to_be_visible();expect(page.locator('[data-stale-notice]')).to_be_visible()
    page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_have_value(unapplied);expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott')
    # Discarding the draft lets the editor work again.
    page.locator('[data-step="rules"]').click();page.locator('[data-stale-notice] [data-author-revert]').click();expect(page.locator('[data-edit-paused]')).to_have_count(0)
    page.locator('.board-row').first.locator('[data-rule-line]').click() if not page.locator('[data-rule-edit="fixed"]').count() else None
    page.locator('[data-rule-edit="fixed"]').click();expect(page.locator('[data-rule-panel] .rule-status')).to_contain_text('érvényes')
    # An unapplied JSON draft is never overwritten by a rule edit: the editor waits for it.
    rules_json(page);page.locator('#model-editor').fill('{unapplied JSON');page.locator('[data-rules-view="visual"]').click()
    expect(page.locator('[data-rule-edit="fixed"]')).to_have_attribute('aria-disabled','true');page.locator('[data-rule-edit="fixed"]').click(force=True)
    expect(page.locator('.disabled-hint')).to_contain_text('CodeLine JSON')
    page.locator('[data-rules-view="json"]').click();expect(page.locator('#model-editor')).to_have_value('{unapplied JSON')

def input_contract(page):
    """ADR-050: the author picks the input contract; the model records it and frees the input reads.
    ADR-106: a new draft starts from valid inputs, ignored key order and standard class fields, and the
    folded summary follows every change."""
    build(page,'function measure(grid) {\n  const rows = grid.length;\n  const cols = grid[0].length;\n  return rows * cols;\n}')
    # ADR-123 (M5): the environment is set in Elemzés és szabályok, where the rules it frees are seen.
    summary=page.locator('details.analysis-options > summary');expect(summary).to_contain_text('érvényes adat · kulcssorrend nem számít · szabványos mezők')
    analysis_options(page);expect(page.locator('[data-preflight="inputs"]')).to_have_value('valid');expect(page.locator('[data-preflight="keyOrder"]')).to_have_value('ignored');expect(page.locator('[data-preflight="classFields"]')).to_have_value('define')
    page.locator('[data-preflight="inputs"]').focus();page.locator('[data-preflight="inputs"]').select_option('any');expect(summary).to_contain_text('szigorú bemenet');expect(page.locator('[data-preflight="inputs"]')).to_be_focused()
    expect(page.locator('[data-stale-notice]')).to_be_visible()
    page.locator('[data-preflight="inputs"]').select_option('valid');expect(summary).to_contain_text('érvényes adat');expect(page.locator('[data-stale-notice]')).to_have_count(0)
    rules_json(page);generated=json.loads(page.locator('#model-editor').input_value())
    assert generated['authoring']['evidence']['environment']['inputs']=='valid';assert 2 not in generated['lines'][2]['dependencies']
    page.locator('[data-step="source"]').click();expect(page.locator('[data-author-status]')).to_contain_text('ebből a forrásból')

# ADR-090: rows never scroll on their own; a list scrolls sideways as one, and its row controls stay
# inside the list's visible area at both ends of that scroll.
ROW_SCROLLERS="""()=>[...document.querySelectorAll('.drop-zone .code-row *, .board-row *')].filter(e=>{const s=getComputedStyle(e);return (s.overflowX==='auto'||s.overflowX==='scroll')&&e.scrollWidth>e.clientWidth;}).length"""
CONTROLS_OUTSIDE="""()=>[...document.querySelectorAll('.drop-zone[data-zone],[data-board-list]')].flatMap(z=>{const r=z.getBoundingClientRect();return [...z.querySelectorAll('.row-actions')].filter(a=>a.children.length).filter(a=>{const b=a.getBoundingClientRect();return b.right>r.right+1||b.left<r.left-1;});}).length"""
def single_horizontal_scroll(page):
    page.set_viewport_size({'width':900,'height':1000})
    try:
        json_model(page,json.loads((ROOT/'examples/class-inventory-ts.json').read_text(encoding='utf-8')))
        assert page.evaluate(ROW_SCROLLERS)==0 and page.evaluate(CONTROLS_OUTSIDE)==0
        to_try(page);page.locator('[data-all]').click();expect(page.locator('.source-zone .code-row')).to_have_count(0)
        zone=page.locator('.solution-zone');assert zone.evaluate('z=>z.scrollWidth>z.clientWidth'),'the long rows make the list itself scroll'
        assert zone.evaluate("z=>new Set([...z.querySelectorAll(':scope > .code-row')].map(row=>row.offsetWidth)).size")==1,'every row is as wide as the widest'
        for left in [0,100000]:
            zone.evaluate(f'z=>{{z.scrollLeft={left};}}');page.wait_for_timeout(100)
            assert page.evaluate(ROW_SCROLLERS)==0,left
            assert page.evaluate(CONTROLS_OUTSIDE)==0,left
    finally:page.set_viewport_size({'width':1500,'height':1000})

# ADR-095: tap to pick, tap to place (touch). A tap on a handle picks the row, a tap on an empty slot
# fills it, a tap on a row splits it at its midpoint, a tap on the pool takes a solution row back, a tap
# on the picked handle again cancels; on a small touch screen the up/down buttons give way to it.
def tap_to_place(browser):
    mobile=watch(browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True));page=mobile.new_page()
    try:
        page.goto(BASE);practice(page)
        first=page.locator('.source-zone .code-row').first;text=first.locator('.code-text').inner_text()
        # ADR-152, ADR-155: the page is scrolled past the height it has with the task list folded; the render after the tap keeps
        # it there (the folded list is opened again before the new page is measured)
        before=page.evaluate("()=>{scrollTo(0,document.querySelector('.source-zone .code-row .drag-handle').getBoundingClientRect().top+scrollY-90);return scrollY}")
        folded=page.evaluate("()=>{const picker=document.querySelector('.task-picker');return document.documentElement.scrollHeight-(picker.offsetHeight-picker.querySelector('summary').offsetHeight)-innerHeight}");assert before>folded+100,(before,folded)
        assert page.evaluate("()=>{const handle=document.querySelector('.source-zone .code-row .drag-handle'),box=handle.getBoundingClientRect();return handle.contains(document.elementFromPoint(box.left+box.width/2,box.top+box.height/2))}"),'the handle is on the screen, under nothing'
        first.locator('.drag-handle').tap();expect(first).to_have_class(re.compile('picked'));expect(page.locator('[data-move-status]')).to_contain_text('Sor kijelölve')
        assert page.evaluate('scrollY')==before,(before,page.evaluate('scrollY'))
        first.locator('.drag-handle').tap();expect(page.locator('.code-row.picked')).to_have_count(0);expect(page.locator('[data-move-status]')).to_contain_text('megszüntetve')
        page.locator('.source-zone .code-row').first.locator('.drag-handle').tap()
        slot=page.locator('.solution-zone .code-row.blank-row').nth(1);index=slot.get_attribute('data-index');slot.tap()
        placed=page.locator(f'.solution-zone .code-row[data-index="{index}"]');expect(placed.locator('.code-text')).to_have_text(text)
        expect(page.locator('[data-move-status]')).to_contain_text(f'{int(index)+1}. pozíció');expect(page.locator('.code-row.picked')).to_have_count(0)
        placed.locator('.drag-handle').tap();page.locator('.source-zone').tap()
        expect(page.locator(f'.solution-zone .code-row[data-index="{index}"]')).to_have_class(re.compile('blank-row'))
        assert text in [row.inner_text() for row in page.locator('.source-zone .code-row .code-text').all()]
        assert page.locator('.solution-zone .row-actions [data-up]').count()==0 or not page.locator('.solution-zone .row-actions [data-up]').first.is_visible()
        assert page.evaluate('document.documentElement.scrollWidth')<=390
    finally:mobile.close()

# ADR-118 (M1b): on a touch screen a sorter row carries no controls over its code. A tap on the code picks the row as the
# handle does; the picked row's actions (insert, up, down, back, its rules, done) show in the action bar, a move keeps the
# pick on the same row, and the rule panel is a bottom sheet that leaves the toolbar in view.
def pick_actions(browser):
    mobile=watch(browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True));page=mobile.new_page()
    try:
        page.goto(BASE);practice(page)
        page.locator('details.task-picker summary').click() if page.locator('details.task-picker').get_attribute('open') is not None else None
        assert not page.locator('.source-zone .row-actions [data-move]').first.is_visible(),'no row control over the code on a touch screen'
        first=page.locator('.source-zone .code-row').first;text=first.locator('.code-text').inner_text()
        first.locator('.code-text').tap();expect(page.locator('.pick-bar')).to_be_visible();expect(page.locator('[data-check]')).to_have_count(0)
        expect(page.locator('.pick-bar .pick-status')).to_contain_text('Felhasználható sor')
        # NY-27: the bar shows the picked row whole, wrapped inside the screen.
        expect(page.locator('.pick-bar [data-pick-code]')).to_have_text(text.strip())
        assert page.locator('.pick-bar [data-pick-code]').evaluate('e=>e.scrollWidth<=e.clientWidth&&e.getBoundingClientRect().right<=innerWidth'),'the picked row wraps inside the screen'
        page.locator('.pick-bar [data-move]').tap()
        expect(page.locator('.pick-bar')).to_have_count(0);expect(page.locator('[data-check]')).to_be_visible()
        placed=page.locator('.solution-zone .code-row:not(.blank-row)').first;expect(placed.locator('.code-text')).to_have_text(text);start=int(placed.get_attribute('data-index'))
        placed.locator('.code-text').tap();expect(page.locator('.pick-bar .pick-status')).to_contain_text(f'A megoldás {start+1}. sora')
        page.locator('.pick-bar [data-down]').tap()
        moved=page.locator('.solution-zone .code-row.picked');expect(moved).to_have_count(1);expect(moved.locator('.code-text')).to_have_text(text)
        assert int(moved.get_attribute('data-index'))>start,'down moves the picked row and keeps the pick on it'
        page.locator('.pick-bar [data-remove]').tap();expect(page.locator('.pick-bar')).to_have_count(0)
        assert text in [row.inner_text() for row in page.locator('.source-zone .code-row .code-text').all()]
        page.locator('.source-zone .code-row').first.locator('.code-text').tap();page.locator('.pick-bar [data-unpick]').tap()
        expect(page.locator('.code-row.picked')).to_have_count(0);expect(page.locator('.pick-bar')).to_have_count(0)
        assert page.evaluate('document.documentElement.scrollWidth')<=390
        # the author's Try: the row's rules open as a bottom sheet; the toolbar above it stays in view
        page.locator('[data-mode="author"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(rules_source)
        page.locator('[data-author-apply]').click();current(page,'rules');to_try(page)
        # the row's connections are in the bar too (the board's circle): mark them, hide them
        page.locator('.source-zone .code-row').nth(1).locator('.code-text').tap();connect=page.locator('.pick-bar [data-rule-connect]')
        expect(connect).to_have_attribute('aria-pressed','false');connect.tap();expect(page.locator('.pick-bar [data-rule-connect]')).to_have_attribute('aria-pressed','true')
        expect(page.locator('.board-connecting, .code-row.connect-source').first).to_be_visible()
        page.locator('.pick-bar [data-rule-connect]').tap();expect(page.locator('.pick-bar [data-rule-connect]')).to_have_attribute('aria-pressed','false');page.locator('.pick-bar [data-unpick]').tap()
        page.locator('.source-zone .code-row').nth(1).locator('.code-text').tap();page.locator('.pick-bar [data-rule-line]').tap()
        sheet=page.locator('.rule-inspector');expect(sheet).to_be_visible();expect(page.locator('#rule-panel-title')).to_be_visible()
        box=sheet.bounding_box();assert box['y']>844*.2,f'the rule sheet leaves the top in view ({box["y"]})'
        close=page.locator('.inspector-head [data-rule-panel-toggle]');expect(close).to_be_visible();close.tap();expect(sheet).to_have_count(0)
    finally:mobile.close()

# ADR-120 (U3): a control that cannot act now is disabled with its reason (still focusable); activating it runs nothing and
# shows the reason beside it. One draft at a time: an unapplied JSON pauses the visual rule editor.
def availability_rules(page):
    page.locator('[data-mode="author"]').click();page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill('')
    page.locator('#author-editor').dispatch_event('input');page.locator('[data-step="source"]').click()
    build=page.locator('[data-author-apply]');expect(build).to_have_attribute('aria-disabled','true');expect(build).to_have_attribute('data-disabled-reason',re.compile('Nincs forrás'))
    build.click(force=True);expect(page.locator('.disabled-hint')).to_be_visible();expect(page.locator('.disabled-hint')).to_contain_text('Nincs forrás');current(page,'source')
    # a source no model was built from yet (earlier cases on this page built rules_source itself, which is up to date)
    page.locator('#author-editor').fill(rules_source+'\n// U3');page.locator('#author-editor').dispatch_event('input')
    expect(page.locator('[data-author-apply]')).not_to_have_attribute('aria-disabled','true');page.locator('[data-author-apply]').click();current(page,'rules')
    page.locator('[data-step="source"]').click();expect(page.locator('[data-author-apply]')).to_have_attribute('data-disabled-reason',re.compile('naprakész'))
    rules_json(page);editor=page.locator('#model-editor');original=editor.input_value();editor.fill(original+' ');page.locator('[data-rules-view="visual"]').click()
    expect(page.locator('[data-edit-paused]')).to_contain_text('CodeLine JSON');pin=page.locator('.pin-toggle').first
    expect(pin).to_have_attribute('aria-disabled','true');pin.click(force=True);expect(page.locator('.disabled-hint')).to_contain_text('CodeLine JSON')
    expect(page.locator('.board-row.fixed-row')).to_have_count(0)
    rules_json(page);editor.fill(original);page.locator('[data-rules-view="visual"]').click();expect(page.locator('[data-edit-paused]')).to_have_count(0)

# ADR-121 (M4): one code editor. Typing keeps the indentation (5 spaces, a closing brace steps back), the highlighted layer
# shows exactly the text; a loaded source arrives formatted and one Undo brings back the previous draft; the learner's code
# editor is highlighted too, and rule snippets are highlighted like the sorter.
def code_editor(page):
    page.locator('[data-mode="author"]').click();page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click()
    editor=page.locator('#author-editor');editor.fill('function g(x) {');editor.press('End');editor.press('Enter');editor.type('return x;');editor.press('Enter');editor.type('}')
    typed='function g(x) {\n     return x;\n}';expect(editor).to_have_value(typed)
    layer=page.locator('.editor-frame:has(#author-editor) .editor-highlight code');expect(layer.locator('.token.keyword').first).to_be_visible()
    assert layer.text_content().rstrip('\n')==typed,'the highlighted layer shows exactly the text'
    page.locator('[data-source-file]').set_input_files({'name':'one-line.js','mimeType':'text/plain','buffer':b'function h(y){const z=y+1;return z;}'})
    expect(page.locator('.author-status')).to_contain_text('automatikusan formáztuk');assert len(editor.input_value().split('\n'))>=4,'a one-line file is laid out'
    page.locator('[data-author-undo]').click();expect(editor).to_have_value(typed)
    editor.fill(rules_source+'\n// M4');editor.dispatch_event('input');page.locator('[data-author-apply]').click();current(page,'rules')
    page.locator('.board-row').nth(1).locator('[data-rule-line]').click();expect(page.locator('[data-rule-panel] code .token').first).to_be_attached()
    practice(page);page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('const a = 1;')
    expect(page.locator('.editor-frame:has(#code-editor) .editor-highlight code .token').first).to_be_attached();page.locator('[data-editor-reload]').click()

# ADR-101: the author chooses the level; the model carries it. ADR-123 (M5): the title, description and level are the
# learner's text, set in Próba és kiadás; they change the applied model in place, with no reanalysis and no stale step.
def author_level(page):
    build(page,rules_source);to_try(page);data=page.locator('details.learner-data')
    if data.get_attribute('open') is None:data.locator('summary').click()
    page.locator('[data-learner="level"]').select_option('intermediate');page.locator('[data-learner="title"]').fill('Tanulói cím');page.locator('[data-learner="title"]').press('Tab')
    expect(page.locator('h1')).to_have_text('Tanulói cím');expect(page.locator('[data-stale-notice]')).to_have_count(0);expect(page.locator('.solution-zone')).to_be_visible()
    rules_json(page);model_json=json.loads(page.locator('#model-editor').input_value());assert model_json.get('level')=='intermediate' and model_json['title']=='Tanulói cím',model_json.get('title')
    expect(page.locator('[data-step="try"]')).to_be_enabled();to_try(page);expect(page.locator('[data-learner="level"]')).to_have_value('intermediate')

def open_rules(page):
    """ADR-107: the rule inspector opens from its toolbar button only."""
    toggle=page.locator('.inspector-toggle')
    if toggle.get_attribute('aria-pressed')!='true':toggle.click()
    expect(page.locator('.rule-inspector')).to_be_visible()
def indentation_single_owner(page):
    """ADR-112: the source, the rules board and the sorter (in the reference order) show the same indentation:
    a declaration's continuation lines and a returned object literal's properties included."""
    raw='function summarize(n) {\nlet r = 0,\nt = Infinity,\ni = -Infinity;\nconst u = n.length;\nreturn {\ncount: u,\nrange: i - t\n}\n}'
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(raw)
    page.locator('[data-author-format]').click();expect(page.locator('.author-status')).to_contain_text('Formázva')
    source=page.locator('#author-editor').input_value().rstrip('\n').split('\n')
    assert source[2]=='          t = Infinity,' and source[6]=='          count: u,',source
    page.locator('[data-author-apply]').click();current(page,'rules')
    board=[text.rstrip() for text in page.locator('.board-row .code-text').all_inner_texts()]
    assert board==source,board
    to_try(page);page.locator('[data-all]').click()
    sorter=[text.rstrip() for text in page.locator('.solution-zone .code-row .code-text').all_inner_texts()]
    assert sorter==source,sorter
def authorKeyOrder(page):
    """The key-order setting of the Elemzés step's control, unfolding the analysis options."""
    page.locator('[data-step="rules"]').click();analysis_options(page);return page.locator('[data-preflight="keyOrder"]').input_value()
# ADR-141: where every control and answer of the page stands (an open ⓘ bubble floats over the page and moves none of it);
# the sticky bars stand where the screen is, not on the page.
# Only what is painted: the content of a closed details has boxes in Chromium although it is not shown, and a newer
# Chromium (the CI runner's) gave one a box during the opening (CI: "lengths 32 → 33", nothing moved).
PAGE_LAYOUT='''()=>[...document.querySelectorAll('#workbench-main :is(button,select,input,textarea,a[href],summary,.task-verdict,.task-text,.inline-hint)')].filter(el=>!el.closest('.toggletip-panel,.action-bar,.evaluation-bar')&&el.checkVisibility()&&!el.closest('details:not([open]) > :not(summary)')).map(el=>{const r=el.getBoundingClientRect();return (el.className||el.tagName)+'@'+[Math.round(r.left+scrollX),Math.round(r.top+scrollY)].join(',')})'''
# ADR-141: what is wrong with the open bubble's place: outside the screen's 16 px margin, cut by its bottom, widening the page.
BUBBLE_MISPLACED='''()=>{const panel=document.querySelector('.toggletip-panel:popover-open');if(!panel)return ['no open bubble'];
 const r=panel.getBoundingClientRect(),width=document.documentElement.clientWidth,wrong=[];
 if(r.left<16||r.right>width-16)wrong.push(`x ${Math.round(r.left)}..${Math.round(r.right)} of ${width}`);
 if(r.top<0||r.bottom>innerHeight)wrong.push(`y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight}`);
 if(document.documentElement.scrollWidth>width)wrong.push(`page ${document.documentElement.scrollWidth} wide`);
 return wrong;}'''
def help_trial(page,url):
    """ADR-135 (NY-31): „Kipróbálom a Kód lépésben” beside an outcome of a help example loads the example under that
    outcome's settings in the Kód step, and the workbench then reproduces what the help says: strict inputs, rows 2 and 3
    swapped are rejected. (A new draft asks for valid inputs, under which they are accepted: the rejection shows the trial's
    setting replaced it.) The help page's own „Kipróbálom” opens the workbench the same way; its code is highlighted."""
    def inputs():
        page.locator('[data-step="rules"]').click();analysis_options(page);return page.locator('[data-preflight="inputs"]').input_value()
    build(page,rules_source);assert inputs()=='valid','a new draft asks for valid inputs'
    tip=page.locator('.setting-head .toggletip[data-help="inputs"]');tip.locator('.info-button').click()
    expect(tip.locator('.help-code .token.keyword').first).to_be_visible();expect(tip.locator('.help-try-note')).to_contain_text('visszavonható')
    tip.locator('[data-help-try="inputs"][data-help-outcome="0"]').click()
    current(page,'source');expect(page.locator('#author-editor')).to_have_value(re.compile(r'^function measure\(grid\) \{'))
    expect(page.locator('.author-status')).to_contain_text('Súgópélda betöltve');expect(page.locator('.author-status')).to_contain_text('elutasítva')
    expect(page.locator('.author-status')).to_contain_text('cseréld fel a 2. és 3. sort')
    page.locator('[data-author-apply]').click();current(page,'rules');assert inputs()=='any';to_try(page)
    # `data-down` names the slot (from 0): slot 1 is row 2, which moves below row 3.
    page.locator('[data-all]').click();page.locator('[data-down="1"]').click()
    assert page.locator('.solution-zone .code-row').evaluate_all('rows=>rows.map(row=>row.dataset.lineId)')[:5]==['1','3','2','4','5']
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Hibás')
    page.goto(url.rstrip('/')+'/help/index.html');expect(page.locator('#objectState .help-code .token.keyword').first).to_be_visible()
    page.locator('#objectState a.help-try').nth(1).click()
    current(page,'source');expect(page.locator('#author-editor')).to_have_value('const user = null;\nconsole.log(user.name);')
    assert page.evaluate('location.hash')=='','the trial address is cleared'
    page.locator('[data-author-check]').click();expect(page.locator('[data-source-diagnostics]')).to_contain_text('OS001')
def source_check(page):
    """ADR-113: the Source step checks the reference under the chosen settings without making a model: findings
    with their line, the step's state, and a clean result in words; no model, so Rules stays locked."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click()
    page.locator('#author-editor').fill('function f() {\n  const a = b;\n  const b = 1;\n  return a;\n}')
    page.locator('[data-author-check]').click()
    findings=page.locator('[data-source-diagnostics]');expect(findings).to_contain_text('BS001');expect(findings).to_contain_text('Biztos hiba')
    expect(page.locator('[data-step="source"] [data-step-status]')).to_have_text('Hiba');expect(page.locator('[data-step="rules"]')).to_be_disabled()
    page.locator('#author-editor').fill('function f() {\n  const b = 1;\n  const a = b;\n  return a;\n}');page.locator('[data-author-check]').click()
    expect(page.locator('.author-status')).to_contain_text('nem találtam hibát');expect(page.locator('[data-source-diagnostics]')).to_have_count(0)
    expect(page.locator('[data-step="source"] [data-step-status]')).to_have_text('Kész');expect(page.locator('[data-step="rules"]')).to_be_disabled()
def focus_bar_and_full_screen_return(page):
    """ADR-110: Focus has a slim bar with the logo; entered from the full-screen page it returns there (the
    browser's full screen stays), entered from the page it leaves the full screen it opened."""
    practice(page);state="()=>({surface:document.querySelector('#app').dataset.surface??null,native:document.fullscreenElement===document.querySelector('#app')})"
    # Entering and leaving the browser's full screen is asynchronous: every step waits for the settled state.
    settled="([surface,native])=>{const app=document.querySelector('#app');return (app.dataset.surface??null)===surface&&(document.fullscreenElement===app)===native;}"
    page.locator('[data-fullscreen]').click();page.wait_for_function("()=>document.querySelector('#app').dataset.surface==='app'")
    # Whether this browser grants the native full screen at all (a headless runner may refuse it: then the overlay).
    try:page.wait_for_function("()=>document.fullscreenElement===document.querySelector('#app')",timeout=3000);native=True
    except Exception:native=False
    page.wait_for_function(settled,arg=['app',native])
    expect(page.locator('.focus-bar')).to_be_hidden();expect(page.locator('.header')).to_be_visible()
    page.locator('[data-focus]').click();page.wait_for_function("()=>document.querySelector('#app').dataset.surface==='focus'")
    bar=page.locator('.focus-bar');expect(bar).to_be_visible();expect(bar).to_contain_text('CodeLineSorter');expect(page.locator('.header')).to_be_hidden()
    assert bar.bounding_box()['height']<=34,bar.bounding_box()
    page.locator('[data-focus]').click();page.wait_for_function(settled,arg=['app',native])
    assert page.evaluate(state)=={'surface':'app','native':native},'leaving focus returns to the full-screen page, its full screen kept'
    expect(page.locator('.header')).to_be_visible();expect(page.locator('.focus-bar')).to_be_hidden()
    page.locator('[data-fullscreen]').click();page.wait_for_function(settled,arg=[None,False])
    # From the page: focus opens the full screen it later leaves.
    page.locator('[data-focus]').click();page.wait_for_function(settled,arg=['focus',native]);expect(page.locator('.focus-bar')).to_be_visible()
    page.locator('[data-focus]').click();page.wait_for_function(settled,arg=[None,False])
    # A quick double toggle: leaving before the browser finished entering leaves no full screen behind. The entry is
    # delayed as on a slow machine (the CI run that left the page in full screen), so the race is deterministic.
    page.evaluate("()=>{const enter=Element.prototype.requestFullscreen;Element.prototype.requestFullscreen=function(...args){return new Promise(resolve=>setTimeout(resolve,300)).then(()=>enter.apply(this,args));};}")
    page.locator('[data-focus]').click();page.locator('[data-focus]').click();page.wait_for_timeout(900);page.wait_for_function(settled,arg=[None,False])
    assert page.evaluate(state)=={'surface':None,'native':False}
def technology_filter(browser,url):
    """ADR-152 (G2): the technology labels of the practice list. Every exercise shows its labels as chips where the
    language's name stood (the square before the title names the language). Above the list every label stands with the
    number of exercises under it: the summary of what the list is made of, and its filter. A label pressed narrows the
    list to it and keeps the focus; pressed again it lets go; „és a korábbi verziók” takes the older versions of the same
    technology too. The open exercise stays open. Under a title: from which versions the exercise runs, and for a
    TypeScript exercise the compiler that checked it. The choice lasts for the page's life."""
    context=watch(browser.new_context(viewport={'width':1440,'height':900}));page=context.new_page();failures=[];page.on('pageerror',lambda error:failures.append(str(error)))
    facets="()=>[...document.querySelectorAll('[data-technology]')].map(b=>b.dataset.technology+' '+b.querySelector('b').textContent+' '+b.getAttribute('aria-pressed'))"
    tasks=lambda:page.locator('.task[data-task]').count();groups="()=>[...document.querySelectorAll('[data-branch]')].map(b=>b.querySelector('.branch-title').textContent+' '+b.querySelector('.branch-count').firstChild.textContent)"
    try:
        reset(page,url);practice(page);opened=page.locator('.task.selected').get_attribute('data-task')
        assert page.evaluate(facets)==['ecmascript 5 1 false','ecmascript 2015 13 false','ecmascript 2018 1 false','ecmascript 2020 1 false','typescript 1.0 1 false','typescript 2.0 3 false'],page.evaluate(facets)
        # ADR-154: the list is the curriculum's tree; only the open exercise's branch is drawn, so every branch is opened to see all
        assert tasks()==5 and page.evaluate(groups)==['JavaScript 12','Alapok 5','Gyűjtemények 5','Algoritmusok 2','TypeScript 4'],page.evaluate(groups)
        open_task(page,'no-such-task');assert tasks()==16 and page.evaluate(groups)==['JavaScript 12','Alapok 5','Gyűjtemények 5','Algoritmusok 2','TypeScript 4','Ráhangoló 4'],page.evaluate(groups)
        expect(page.locator('.task-picker nav > .tech-filter')).to_have_attribute('role','group');expect(page.get_by_role('group',name='JavaScript (ECMAScript)').get_by_role('button',name='ES2015 13 feladat',exact=True)).to_have_attribute('data-technology','ecmascript 2015')
        graded=page.locator('.task[data-task="grade-ts"]');expect(graded.locator('.tech-chip')).to_have_text(['TS 1.0','ES5']);expect(graded.locator('.task-file')).to_have_attribute('aria-label','TypeScript')
        assert 'TypeScript' not in graded.locator('small').inner_text() and 'JavaScript' not in page.locator('.task[data-task="celsius-js"] small').inner_text(),'the chips stand where the language name stood'
        # ADR-154, NY-60: in the tree an item names its level after its labels. On a desktop it fits beside two labels with a few
        # pixels to spare; another machine's fonts can take them, so beside two labels a second line is allowed
        heights=page.evaluate("()=>[...document.querySelectorAll('.task[data-task]')].map(item=>[item.dataset.task,item.querySelectorAll('.tech-chip').length,Math.round(item.getBoundingClientRect().height)])")
        assert len(heights)==16 and all(chips>=1 and height<=(72 if chips==1 else 90) for _,chips,height in heights),('every item is labelled; no taller than two lines of title and one of labels, or two beside two labels',heights)
        earlier=page.locator('[data-technology-earlier]');expect(earlier).to_be_disabled()
        # a label pressed: the list narrows, the counts of the branches follow, the focus stays on the label
        chip=page.locator('[data-technology="typescript 2.0"]');chip.click();expect(chip).to_have_attribute('aria-pressed','true');expect(chip).to_be_focused()
        assert tasks()==3 and page.evaluate(groups)==['TypeScript 3','Ráhangoló 3'],page.evaluate(groups)
        assert page.locator('[data-technology][aria-pressed="true"]').count()==1
        # the exercise that was open stays open, though the list no longer shows it
        assert page.locator('.task.selected').count()==0 and page.locator(f'.task[data-task="{opened}"]').count()==0;expect(page.locator('.task-heading h1')).to_be_visible();expect(page.locator('[data-check]')).to_be_visible()
        # the older versions too
        expect(earlier).to_be_enabled();earlier.check();expect(earlier).to_be_focused();assert tasks()==4 and page.evaluate(groups)==['TypeScript 4','Ráhangoló 4'],page.evaluate(groups)
        # choosing one of them keeps the filter; its title says from which versions it runs and what checked it
        page.locator('.task[data-task="class-inventory-ts"]').click();expect(page.locator('.task[data-task="class-inventory-ts"]')).to_have_class('task selected')
        expect(page.locator('.tech-note')).to_have_text(re.compile(r'^TypeScript 2\.0-tól · ES2018-tól · ellenőrizve: TypeScript \d+\.\d+$'))
        expect(chip).to_have_attribute('aria-pressed','true');expect(earlier).to_be_checked();assert tasks()==4
        # another label takes over, keeping the choice of older versions; by keyboard the chosen one lets go
        other=page.locator('[data-technology="ecmascript 2015"]');other.click();expect(other).to_have_attribute('aria-pressed','true');expect(chip).to_have_attribute('aria-pressed','false');expect(earlier).to_be_checked();assert tasks()==14,tasks()
        other.focus();page.keyboard.press('Space');expect(other).to_have_attribute('aria-pressed','false');expect(other).to_be_focused();expect(earlier).to_be_disabled();expect(earlier).not_to_be_checked()
        # without a filter the tree is as the reader left it: the JavaScript topic, never pressed, no longer holds the open exercise
        assert tasks()==4 and page.evaluate(groups)==['JavaScript 12','TypeScript 4','Ráhangoló 4'],page.evaluate(groups)
        # a JavaScript exercise names no compiler
        open_task(page,'word-count-js').click();expect(page.locator('.tech-note')).to_have_text('ES2020-tól')
        # the author's own draft is measured too, and nothing checked it for publication
        page.locator('[data-mode="author"]').click();build(page,'function total(prices) {\n  const fees = prices.map(price => price * 2);\n  return fees.at(-1) ?? 0;\n}')
        expect(page.locator('.tech-note')).to_have_text('ES2022-től')
        # the choice lasts for the page's life: a reload starts without one
        practice(page);chip=page.locator('[data-technology="typescript 2.0"]');chip.click();assert tasks()==3
        page.reload();expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step');practice(page);assert page.locator('[data-technology][aria-pressed="true"]').count()==0
        # ADR-154: and with the tree as it opens, the branches the reader opened forgotten too
        assert tasks()==5 and page.evaluate(groups)==['JavaScript 12','Alapok 5','Gyűjtemények 5','Algoritmusok 2','TypeScript 4'],page.evaluate(groups)
        assert not failures,failures
    finally:context.close()
def curriculum_tree(browser,url):
    """ADR-154 (G3): the practice list is the curriculum's tree. A topic and its modules are buttons that open and close
    (aria-expanded), each with the number of exercises under it; a closed branch draws none of them. Left alone, a branch
    is open when it holds the open exercise; pressed, it stays as the reader left it, and the focus stays on it. An item
    names its level. The catalog sends the manifest beside the list. A reload forgets the reader's choices. On a phone
    the tree stands in the folded task list."""
    branches="()=>[...document.querySelectorAll('[data-branch]')].map(b=>b.dataset.branch+' '+b.querySelector('.branch-count').firstChild.textContent+' '+b.getAttribute('aria-expanded'))"
    drawn="()=>[...document.querySelectorAll('.task[data-task]')].map(item=>item.dataset.task)"
    start=['javascript 12 true','javascript/alapok 5 true','javascript/gyujtemenyek 5 false','javascript/algoritmusok 2 false','typescript 4 false']
    context=watch(browser.new_context(viewport={'width':1440,'height':900}));page=context.new_page();failures=[];page.on('pageerror',lambda error:failures.append(str(error)))
    try:
        reset(page,url);practice(page)
        manifest=page.evaluate("async()=>{const api=await import('./app/api.js');return api.getCurriculum()}")
        assert [topic['id'] for topic in manifest['topics']]==['javascript','typescript'] and manifest['topics'][0]['modules'][0]['exercises'][0]=='celsius-js',manifest
        # as it opens: the open exercise's topic and module are open, the rest are closed and draw nothing
        assert page.evaluate(branches)==start,page.evaluate(branches)
        assert page.evaluate(drawn)==['celsius-js','greeting-js','rectangle-js','even-odd-js','vowels-js'],page.evaluate(drawn)
        expect(page.locator('.task.selected')).to_have_attribute('data-task','celsius-js');expect(page.locator('.side-title')).to_have_count(0)
        # a topic is a heading of the list, its module one under it; the button says what the number counts
        expect(page.locator('nav[aria-label="Feladatok"] h3').get_by_role('button',name='JavaScript 12 feladat',exact=True)).to_have_attribute('aria-expanded','true')
        expect(page.locator('nav[aria-label="Feladatok"] h4').get_by_role('button',name='Gyűjtemények 5 feladat',exact=True)).to_have_attribute('aria-expanded','false')
        assert page.evaluate("()=>[...document.querySelectorAll('[data-branch]')].every(b=>b.getAttribute('aria-expanded')==='true'?document.getElementById(b.getAttribute('aria-controls'))?.previousElementSibling===b.parentElement:!b.hasAttribute('aria-controls'))"),'an open branch names the body under its heading; a closed one names none'
        # an item names its level after its labels
        expect(page.locator('.task[data-task="celsius-js"] small')).to_have_text(re.compile(r'^ES2015\s*· Kezdő$'))
        # NY-60: the open exercise's arrow stands beside its title, out of the flow: the label line is as wide in the open item as
        # in the others, and an exercise stands 14 px in under its module (with more the level did not fit beside two labels)
        lines=page.evaluate("()=>[...document.querySelectorAll('.task[data-task]')].map(item=>[item.classList.contains('selected'),getComputedStyle(item).paddingLeft,item.querySelector('.icon')?getComputedStyle(item.querySelector('.icon')).position:''])")
        assert lines[0]==[True,'14px','absolute'] and all(line==[False,'14px',''] for line in lines[1:]),lines
        assert page.evaluate("()=>{const item=document.querySelector('.task.selected'),arrow=item.querySelector('.icon').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(item.querySelector('strong'));return [...range.getClientRects()].every(box=>box.right<=arrow.left||box.bottom<=arrow.top||box.top>=arrow.bottom)}"),'the open exercise\'s title keeps clear of its arrow'
        assert page.evaluate("()=>{const [open,other]=[...document.querySelectorAll('.task[data-task]')].map(item=>item.querySelector('small'));const room=small=>small.parentElement.parentElement.getBoundingClientRect().right-small.getBoundingClientRect().left;return Math.abs(room(open)-room(other))<1}"),'the label line starts and may end at the same place in the open item and in another'
        # pressed, a module opens and keeps the focus; pressed again it closes
        module=page.locator('[data-branch="javascript/gyujtemenyek"]');module.click();expect(module).to_have_attribute('aria-expanded','true');expect(module).to_be_focused()
        assert page.evaluate(drawn)[5:]==['stats-js','stats-reduce-js','profiles-js','word-count-js','fib-memo-js'],page.evaluate(drawn)
        page.keyboard.press('Enter');expect(module).to_have_attribute('aria-expanded','false');expect(module).to_be_focused();assert len(page.evaluate(drawn))==5
        page.keyboard.press('Space');expect(module).to_have_attribute('aria-expanded','true');expect(module).to_be_focused()
        # an exercise of it chosen: the module the reader never pressed no longer holds the open exercise and closes
        page.locator('.task[data-task="word-count-js"]').click();expect(page.locator('.task[data-task="word-count-js"]')).to_have_class('task selected');expect(page.locator('.task-heading h1')).to_have_text('Szógyakoriság Map-pel')
        assert page.evaluate(branches)==['javascript 12 true','javascript/alapok 5 false','javascript/gyujtemenyek 5 true','javascript/algoritmusok 2 false','typescript 4 false'],page.evaluate(branches)
        # the topic closed by hand stays closed though it holds the open exercise, which stays open; another topic opens beside it
        topic=page.locator('[data-branch="javascript"]');topic.click();expect(topic).to_have_attribute('aria-expanded','false');expect(topic).to_be_focused()
        assert page.evaluate(branches)==['javascript 12 false','typescript 4 false'] and page.evaluate(drawn)==[],page.evaluate(branches)
        expect(page.locator('.task-heading h1')).to_have_text('Szógyakoriság Map-pel');expect(page.locator('[data-check]')).to_be_visible()
        page.locator('[data-branch="typescript"]').click();page.locator('[data-branch="typescript/rahangolo"]').click()
        assert page.evaluate(drawn)==['grade-ts','stack-ts','class-inventory-ts','class-accounts-ts'],page.evaluate(drawn)
        page.locator('.task[data-task="stack-ts"]').click();expect(page.locator('.task[data-task="stack-ts"]')).to_have_class('task selected')
        assert page.evaluate(branches)==['javascript 12 false','typescript 4 true','typescript/rahangolo 4 true'],page.evaluate(branches)
        topic.click();assert page.evaluate(branches)==['javascript 12 true','javascript/alapok 5 false','javascript/gyujtemenyek 5 true','javascript/algoritmusok 2 false','typescript 4 true','typescript/rahangolo 4 true'],'reopened, the topic shows its modules as they were left'
        # a reload forgets the reader's choices
        page.reload();expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step');practice(page);assert page.evaluate(branches)==start,page.evaluate(branches)
        assert not failures,failures
    finally:context.close()
    # on a phone the tree stands in the task list's own scrolling box; a branch opens by a tap, and choosing an exercise folds the list
    phone=watch(browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True));page=phone.new_page()
    try:
        reset(page,url);practice(page);assert page.evaluate(branches)==start,page.evaluate(branches)
        page.locator('[data-branch="typescript"]').tap();page.locator('[data-branch="typescript/rahangolo"]').tap();expect(page.locator('.task[data-task="grade-ts"]')).to_be_visible()
        assert page.evaluate("()=>{const nav=document.querySelector('.task-picker nav');return nav.scrollHeight>nav.clientHeight&&nav.clientHeight<=innerHeight*.6+1&&document.documentElement.scrollWidth<=innerWidth}"),'the tree scrolls inside the list, and the page does not scroll sideways'
        assert page.evaluate("()=>[...document.querySelectorAll('[data-branch]')].every(b=>b.getBoundingClientRect().height>=44)"),'a branch is a touch target'
        page.locator('.task[data-task="grade-ts"]').tap();expect(page.locator('.task-heading h1')).to_have_text('Osztályzat pontszámból');expect(page.locator('details.task-picker')).not_to_have_attribute('open','')
    finally:phone.close()
def learner_rules(browser,url,pages):
    """ADR-147: the learner's look at an exercise's rules. Nothing of it stands on the page, or comes with the listing,
    before a first check; the first check brings the tool and a rule button per row, says so, and opens nothing. The
    panel is read-only: what must stand before and after the picked line, by its code, with no number, reason or author
    control. It is kept for the exercise through Újrakezdés and a task change, and forgotten by a reload. The author
    sets it per exercise: a new draft has it off, the learner's view of a draft follows the choice without re-analysis,
    and the author's own rule panel stays the editor it was."""
    context=watch(browser.new_context(viewport={'width':1440,'height':900}));page=context.new_page();failures=[];page.on('pageerror',lambda error:failures.append(str(error)))
    answers=[];page.on('response',lambda response:answers.append(response) if '/api/' in response.url and response.request.method in ('GET','POST') and ('evaluate' in response.url or response.url.endswith('/api/exercises')) else None)
    seen="()=>({tool:document.querySelectorAll('.inspector-toggle').length,rows:document.querySelectorAll('.code-row [data-rule-line]').length,lines:[...document.querySelectorAll('.code-row')].filter(row=>/^\\d+$/.test(row.dataset.lineId??'')).length,connect:document.querySelectorAll('[data-rule-connect]').length,panel:document.querySelectorAll('.rule-inspector').length})"
    try:
        reset(page,url);practice(page);first=page.locator('[data-task]').first.get_attribute('data-task')
        assert page.evaluate(seen)|{'lines':0}=={'tool':0,'rows':0,'lines':0,'connect':0,'panel':0},('nothing of the rules before a check',page.evaluate(seen))
        if not pages:
            listing=[answer for answer in answers if answer.url.endswith('/api/exercises')];assert listing and not re.search(r'"before"|"after"|"rules"|"learnerFeedback"',listing[-1].text()),'the listing carries no rule'
        # a partial, wrong check is a check: the tool and the row buttons come, the panel does not
        page.locator('.source-zone [data-move]').nth(1).click();page.locator('.source-zone [data-move]').first.click()
        page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle')
        expect(page.locator('.inspector-toggle')).to_have_count(1);state=page.evaluate(seen)
        assert state['rows']==state['lines']>0 and state['connect']==0 and state['panel']==0,('after the first check: a rule button on every line, nothing opened',state)
        expect(page.locator('.note')).to_contain_text('Mostantól megnézheted a sorok szabályait');expect(page.locator('.inspector-toggle')).to_have_attribute('aria-pressed','false')
        if not pages:
            answer=[item for item in answers if 'evaluate' in item.url][-1].json();assert answer['rules']['constraints'] and all(sorted(rule)==['after','before','structural'] for rule in answer['rules']['constraints']),answer.get('rules')
        # the learner opens it: a hint, then the picked line's rules; nothing to edit
        page.locator('.inspector-toggle').click();panel=page.locator('.rule-inspector');expect(panel).to_be_visible();expect(panel.locator('[data-rule-hint]')).to_contain_text('Jelölj ki egy sort')
        opener=page.locator('.solution-zone .code-row [data-rule-line]').first;expect(opener).to_have_attribute('aria-label',re.compile(r'^A sor szabályai: \S'));opener.click()
        expect(page.locator('.solution-zone .code-row.rule-selected')).to_have_count(1);expect(panel.locator('[data-rule-panel]')).to_be_visible()
        expect(panel.locator('.rule-column h4')).to_have_text([re.compile(r'^Előtte kell állnia · \d+$'),re.compile(r'^Utána kell állnia · \d+$')])
        marked=page.locator('.code-row.rule-before,.code-row.rule-after').count();listed=panel.locator('.rule-item').count();assert marked==listed>0,('every listed rule marks its line',marked,listed)
        assert panel.locator('[data-rule-edit],[data-rule-form],select,[data-rule-note],input:not([data-board-all])').count()==0,'the learner\'s panel edits nothing'
        text=panel.inner_text();assert not re.search(r'#\d|SZERZŐI|Eltávolítás|referencia|Rögzítés',text),('no number and no author wording',text[:300])
        assert page.locator('svg.zone-arcs path.arc').count()>=0 and not page.locator('[data-rule-connect]').count()
        # a rule leads to its other line; Escape closes the panel and returns the focus to the tool
        other=panel.locator('.rule-jump').first;target=other.get_attribute('data-rule-line');other.click();expect(panel.locator('[data-rule-panel]')).to_have_attribute('data-rule-panel-line',target);expect(page.locator('#rule-panel-title')).to_be_focused()
        page.keyboard.press('Escape');expect(panel).to_have_count(0);expect(page.locator('.inspector-toggle')).to_be_focused()
        # kept for the exercise: through Újrakezdés and a visit to another task, which has nothing before its own check
        page.locator('[data-reset]').click();expect(page.locator('.inspector-toggle')).to_have_count(1)
        page.locator('[data-task]').nth(1).click();expect(page.locator('[data-task]').nth(1)).to_have_attribute('aria-current','page');expect(page.locator('.inspector-toggle')).to_have_count(0);assert page.evaluate(seen)['rows']==0
        page.locator(f'[data-task="{first}"]').click();expect(page.locator('.inspector-toggle')).to_have_count(1)
        # a right answer is an answer too, on the other task; and a reload forgets everything
        page.locator('[data-task]').nth(1).click();page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_have_class(re.compile('accepted|ok|success'));expect(page.locator('.inspector-toggle')).to_have_count(1)
        page.reload();practice(page);expect(page.locator('[data-check]')).to_be_visible();assert page.evaluate(seen)['tool']==0 and page.evaluate(seen)['rows']==0,'a reload forgets the rules'
        # the author: a new draft has the panel off for the learner; the choice needs no re-analysis
        page.locator('[data-mode="author"]').click();build(page,rules_source);to_try(page);page.locator('[data-all]').click()
        def level():
            data=page.locator('details.learner-data')
            if data.get_attribute('open') is None:data.locator('summary').click()
            return page.locator('[data-learner="learnerFeedback"]')
        expect(level()).to_have_value('positions');assert level().locator('option').count()==3
        page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle')
        expect(page.locator('.inspector-toggle')).to_have_count(1);page.locator('.inspector-toggle').click();expect(page.locator('.rule-inspector')).to_be_visible();assert page.locator('[data-rule-connect]').count()>0,'the author\'s own rule tools are there'
        page.locator('[data-preview-toggle]').click();expect(page.locator('#app.learner-preview')).to_have_count(1)
        page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle');expect(page.locator('.inspector-toggle')).to_have_count(0)
        page.locator('[data-preview-toggle]').click();expect(page.locator('#app.learner-preview')).to_have_count(0)
        level().select_option('graph');expect(level()).to_have_value('graph');current(page,'try');expect(page.locator('[data-stale-notice]')).to_have_count(0)
        expect(page.locator('.rule-inspector')).to_be_visible();assert page.locator('.rule-inspector [data-board-all]').count()==1,'the author\'s panel is still open and still the author\'s'
        page.locator('[data-preview-toggle]').click();expect(page.locator('#app.learner-preview')).to_have_count(1);expect(page.locator('.inspector-toggle')).to_have_count(0)
        page.locator('[data-check]').click();expect(page.locator('.inspector-toggle')).to_have_count(1);expect(page.locator('.rule-inspector')).to_have_count(0);assert page.locator('[data-rule-connect]').count()==0
        page.locator('.inspector-toggle').click();page.locator('.solution-zone .code-row [data-rule-line]').nth(3).click();panel=page.locator('.rule-inspector')
        expect(panel.locator('.rule-item').first).to_be_visible();assert panel.locator('[data-rule-edit],[data-rule-form],select').count()==0 and not re.search(r'#\d|SZERZŐI',panel.inner_text())
        # back in the author's view the panel is the editor again
        page.locator('[data-preview-toggle]').click();expect(page.locator('#app.learner-preview')).to_have_count(0)
        if not page.locator('.rule-inspector').count():page.locator('.inspector-toggle').click()
        expect(page.locator('.rule-inspector')).to_be_visible()
        if not page.locator('.rule-inspector [data-rule-panel]').count():page.locator('.solution-zone .code-row [data-rule-line]').nth(3).click()
        expect(page.locator('.rule-inspector [data-rule-panel]')).to_contain_text('SZERZŐI SZABÁLYOK');assert page.locator('.rule-inspector [data-rule-form]').count()>0 and page.locator('[data-rule-connect]').count()>0
        # the level survives a rule edit (it travels with the author's requests)
        page.locator('.rule-inspector [data-rule-edit="fixed"]').click();expect(page.locator('.rule-inspector [data-rule-edit="fixed"]')).to_have_attribute('aria-pressed','true')
        expect(level()).to_have_value('graph')
        # also a choice made just before the edit, which no preview has carried yet
        level().select_option('rules');page.locator('.rule-inspector [data-rule-edit="fixed"]').click();expect(page.locator('.rule-inspector [data-rule-edit="fixed"]')).to_have_attribute('aria-pressed','false');expect(level()).to_have_value('rules')
        assert not failures,failures
    finally:context.close()
    # a touch screen has no row buttons: the picked row's bar leads to its rules, and offers the learner no author tool
    context=watch(browser.new_context(viewport={'width':390,'height':820},is_mobile=True,has_touch=True));page=context.new_page();page.on('pageerror',lambda error:failures.append(str(error)))
    try:
        reset(page,url);page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
        page.locator('[data-all]').click();page.locator('.solution-zone .code-row .code-text').nth(1).tap();bar=page.locator('.pick-bar');expect(bar).to_be_visible()
        assert bar.locator('[data-rule-line],[data-rule-connect]').count()==0,'before a check the picked row has no rule tool'
        bar.locator('[data-unpick]').tap();page.locator('[data-check]').click();expect(page.locator('.inspector-toggle')).to_have_count(1)
        page.locator('.solution-zone .code-row .code-text').nth(1).tap();expect(bar.locator('[data-rule-line]')).to_have_text('Sor szabályai');assert bar.locator('[data-rule-connect]').count()==0,'the learner gets no connecting tool'
        bar.locator('[data-rule-line]').tap();sheet=page.locator('.rule-inspector');expect(sheet.locator('[data-rule-panel]')).to_be_visible();expect(sheet.locator('.rule-column h4').first).to_contain_text('Előtte kell állnia')
        box=sheet.bounding_box();assert box['height']>=200 and box['y']+box['height']<=821 and page.evaluate('document.documentElement.scrollWidth')<=390,box
        assert not failures,failures
    finally:context.close()
def rules_split(browser,url):
    """ADR-146: the tools and the panels are one frame, and the rule panel docks in it behind a separator of its own.
    The separator moves by pointer and by keyboard the way it moves on the screen (left widens the panel), within
    20-50 % of the lists and the panel together, is remembered apart from the lists' split, and leaves that alone.
    Docked, the panel is as high as the lists and scrolls in itself: opening it does not change the frame's height. On a
    narrower screen it is the sheet it was, without a separator."""
    context=watch(browser.new_context(viewport={'width':1440,'height':900}));page=context.new_page();failures=[];page.on('pageerror',lambda error:failures.append(str(error)))
    boxes="()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {frame:b('.workspace'),bar:b('.toolbar'),body:b('.try-body'),lists:b('.panes'),rules:b('.rule-inspector'),pool:b('#pool-pane')}}"
    try:
        reset(page,url);build(page,rules_source);to_try(page);page.locator('[data-all]').click()
        # the tools: what changes the attempt on the left, what changes the view on the right, all inside the frame
        tools=page.evaluate("()=>[...document.querySelectorAll('.workspace-actions>button')].map(b=>({name:[...b.attributes].find(a=>a.name.startsWith('data-')).name.slice(5),left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right}))")
        assert [tool['name'] for tool in tools]==['reset','all','rule-panel-toggle','focus'],tools
        closed=page.evaluate(boxes);assert tools[2]['left']-tools[1]['right']>100 and closed['frame']['right']-tools[3]['right']<24,('the view tools stand at the frame\'s right end',tools,closed['frame'])
        assert closed['rules'] is None and page.locator('[data-pane-split="rules"]').count()==0
        page.locator('.inspector-toggle').click();panel=page.locator('.rule-inspector');expect(panel).to_be_visible()
        split=page.locator('[data-pane-split="rules"]');lists=page.locator('[data-pane-split="lists"]')
        for name,value in [('role','separator'),('aria-valuemin','20'),('aria-valuemax','50'),('aria-valuenow','28'),('aria-controls','try-rule-panel'),('aria-orientation','vertical')]:expect(split).to_have_attribute(name,value)
        expect(lists).to_have_attribute('aria-valuenow','40')
        opened=page.evaluate(boxes);share=lambda b:b['rules']['width']/b['body']['width']*100
        assert abs(share(opened)-28)<1,('the panel takes its share',share(opened))
        assert abs(opened['frame']['height']-closed['frame']['height'])<=1,('opening the panel leaves the frame as high as it was',closed['frame'],opened['frame'])
        assert abs(opened['rules']['top']-opened['lists']['top'])<=1 and abs(opened['rules']['bottom']-opened['lists']['bottom'])<=1,('the panel is as high as the lists',opened)
        # a line's rules are longer than the panel: it scrolls in itself, the frame does not grow
        page.locator('.solution-zone [data-rule-line]').nth(3).click();expect(page.locator('.rule-inspector .rule-panel')).to_be_visible()
        assert page.evaluate("()=>{const p=document.querySelector('.rule-inspector');return p.scrollHeight>p.clientHeight+20}"),'the rules of a line are longer than the panel'
        # NY-47: at its first width the panel holds what stands before and after the line one under the other
        columns="()=>getComputedStyle(document.querySelector('.rule-inspector .rule-columns')).gridTemplateColumns.split(' ').length"
        assert page.evaluate(columns)==1,'one column in a narrow panel'
        assert abs(page.evaluate(boxes)['frame']['height']-closed['frame']['height'])<=1,'the panel\'s content does not size the frame'
        # by pointer: 180 px to the left widens the panel by that much; the lists' split stays
        box=split.bounding_box();page.mouse.move(box['x']+6,box['y']+80);page.mouse.down();page.mouse.move(box['x']-174,box['y']+80,steps=6);page.mouse.up()
        value=int(split.get_attribute('aria-valuenow'));dragged=page.evaluate(boxes)
        assert 38<=value<=44 and abs(share(dragged)-value)<1 and abs(dragged['rules']['width']-opened['rules']['width']-180)<16,(value,opened['rules'],dragged['rules'])
        expect(lists).to_have_attribute('aria-valuenow','40');assert abs(dragged['pool']['width']/dragged['lists']['width']*100-40)<1.5,dragged
        # by keyboard: the separator goes where the arrow points
        split.focus();page.keyboard.press('ArrowLeft');expect(split).to_have_attribute('aria-valuenow',str(value+2));left=page.evaluate(boxes)['rules']['left'];assert left<dragged['rules']['left'],(left,dragged['rules'])
        page.keyboard.press('ArrowRight');expect(split).to_have_attribute('aria-valuenow',str(value));page.keyboard.press('Home');expect(split).to_have_attribute('aria-valuenow','50')
        assert abs(share(page.evaluate(boxes))-50)<1
        # NY-47: made wide, it breaks into two columns, as on the Elemzés és szabályok step; the panel's own width decides
        sides=page.evaluate("()=>[...document.querySelectorAll('.rule-inspector .rule-columns>*')].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width)]})")
        assert page.evaluate(columns)==2 and len(sides)==2 and sides[0][1]==sides[1][1] and sides[1][0]>sides[0][0]+sides[0][2]-1 and min(sides[0][2],sides[1][2])>=250,('two columns side by side in a wide panel',sides)
        page.keyboard.press('End');expect(split).to_have_attribute('aria-valuenow','20')
        narrowest=page.evaluate(boxes);assert narrowest['rules']['width']>=280,('the panel keeps a width its rows can be read in',narrowest['rules'])
        page.keyboard.press('ArrowLeft');page.keyboard.press('ArrowLeft');page.keyboard.press('ArrowLeft');expect(split).to_have_attribute('aria-valuenow','26')
        # remembered apart from the lists' split
        lists.focus();page.keyboard.press('ArrowRight');expect(lists).to_have_attribute('aria-valuenow','42');expect(split).to_have_attribute('aria-valuenow','26')
        page.reload();current(page,'source');build(page,rules_source);to_try(page);page.locator('.inspector-toggle').click()
        expect(page.locator('[data-pane-split="rules"]')).to_have_attribute('aria-valuenow','26');expect(page.locator('[data-pane-split="lists"]')).to_have_attribute('aria-valuenow','42')
        assert abs(share(page.evaluate(boxes))-26)<1
        page.locator('[data-rule-line]').nth(3).click();expect(page.locator('.rule-inspector .rule-columns')).to_be_visible()
        # a narrower screen: the sheet over the page, as high as the screen, and no separator for it
        page.set_viewport_size({'width':1024,'height':768});expect(page.locator('.rule-inspector')).to_be_visible()
        assert page.evaluate("getComputedStyle(document.querySelector('[data-pane-split=\"rules\"]')).display")=='none','beside the sheet the separator is gone, for the keyboard too'
        sheet=page.evaluate(boxes)['rules'];assert sheet['height']>=760 and abs(sheet['right']-1024)<=1,sheet
        assert page.evaluate(columns)==1,'the sheet is narrow: one column'
        page.set_viewport_size({'width':390,'height':800});sheet=page.evaluate(boxes)['rules'];assert sheet['height']>=120 and sheet['bottom']<=801,('a phone: the sheet has its own height',sheet)
        assert not failures,failures
    finally:context.close()
def split_and_full_screen_focus(page):
    """ADR-107: the separator moves the split by pointer and keyboard and is remembered; Focus fills the
    screen with no page or workspace scroll, also with the inspector and the feedback open."""
    build(page,rules_source);to_try(page);page.locator('[data-all]').click()
    split=page.locator('[data-pane-split="lists"]');pool=page.locator('#pool-pane');expect(split).to_have_attribute('aria-valuenow','40')
    box=split.bounding_box();page.mouse.move(box['x']+6,box['y']+60);page.mouse.down();page.mouse.move(box['x']+206,box['y']+60,steps=6);page.mouse.up()
    value=int(split.get_attribute('aria-valuenow'));assert 50<value<80,value
    split.focus();page.keyboard.press('ArrowLeft');expect(split).to_have_attribute('aria-valuenow',str(value-2));page.keyboard.press('Home');expect(split).to_have_attribute('aria-valuenow','20')
    width=pool.bounding_box()['width'];page.reload();current(page,'source');build(page,rules_source);to_try(page);expect(page.locator('[data-pane-split="lists"]')).to_have_attribute('aria-valuenow','20');assert abs(page.locator('#pool-pane').bounding_box()['width']-width)<3
    page.locator('[data-pane-split="lists"]').focus();page.keyboard.press('End')
    for _ in range(20):page.keyboard.press('ArrowLeft')
    expect(page.locator('[data-pane-split="lists"]')).to_have_attribute('aria-valuenow','40')
    no_scroll='()=>({page:document.documentElement.scrollHeight-innerHeight,app:document.querySelector("#app").scrollHeight-document.querySelector("#app").clientHeight})'
    page.locator('[data-all]').click();page.locator('[data-focus]').click();expect(page.locator('#app')).to_have_attribute('data-surface','focus')
    open_rules(page);page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class(re.compile('idle'))
    page.locator('.technical-details summary').click();assert page.evaluate(no_scroll)=={'page':0,'app':0},page.evaluate(no_scroll)
    page.locator('[data-view="edit"]').click();assert page.evaluate(no_scroll)=={'page':0,'app':0},page.evaluate(no_scroll)
    page.locator('[data-view="sort"]').click();page.locator('[data-focus]').click()
def try_rules(page):
    """ADR-022: the try sorter shows and edits rules while arranging; learners and practice never see them."""
    build(page,rules_source);to_try(page);expect(page.locator('[data-try-rules]')).to_be_visible()
    expect(page.locator('.source-zone .code-row[data-line-id="3"] [data-rule-line]')).to_have_count(1)
    page.locator('[data-all]').click()
    # ADR-107: the row link selects (marks and arcs) and never opens the inspector; its toolbar button does.
    page.locator('.solution-zone .code-row[data-line-id="4"] [data-rule-line]').click();expect(page.locator('.rule-inspector')).to_have_count(0)
    expect(page.locator('.solution-zone .code-row[data-line-id="2"]')).to_have_class(re.compile('rule-before'))
    open_rules(page);panel=page.locator('.try-rule-panel [data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','4')
    expect(page.locator('.inspector-head [data-rule-panel-toggle]')).to_be_focused()
    page.keyboard.press('Escape');expect(page.locator('.rule-inspector')).to_have_count(0);expect(page.locator('.inspector-toggle')).to_be_focused();expect(page.locator('.inspector-toggle')).to_have_attribute('aria-pressed','false')
    open_rules(page);expect(panel).to_have_attribute('data-rule-panel-line','4');expect(page.locator('.solution-zone .code-row[data-line-id="5"]')).to_have_class(re.compile('rule-after'))
    arcs=page.locator('.solution-zone .zone-arcs path.arc');expect(arcs).to_have_count(4);expect(page.locator('.solution-zone .zone-arcs path[data-arc="2-4"]')).to_have_class(re.compile('before'))
    # Arranging keeps the rules visible: a move redraws the arcs at the new row positions.
    before=page.locator('.solution-zone .zone-arcs path[data-arc="2-4"]').get_attribute('d')
    page.locator('[data-down="2"]').click();expect(arcs).to_have_count(4);expect(page.locator('.solution-zone .zone-arcs path[data-arc="2-4"]')).not_to_have_attribute('d',before)
    expect(panel).to_have_attribute('data-rule-panel-line','4')
    order=[row.get_attribute('data-line-id') for row in page.locator('.solution-zone .code-row').all()];assert order==['1','2','4','3','5','6'],order
    # Dragging a connector adds a rule and never moves a row.
    start=page.locator('.solution-zone [data-rule-connect="3"]').bounding_box();end=page.locator('.solution-zone .code-row[data-line-id="2"] .code-text').bounding_box()
    page.mouse.move(start['x']+start['width']/2,start['y']+start['height']/2);page.mouse.down()
    page.mouse.move(end['x']+20,end['y']+end['height']/2,steps=8);expect(page.locator('.solution-zone .code-row[data-line-id="2"]')).to_have_class(re.compile('connect-target'));page.mouse.up()
    expect(panel).to_have_attribute('data-rule-panel-line','3');expect(panel.locator('[data-rule-pair="2-3"] .rule-badge')).to_have_text('Szerzői')
    assert [row.get_attribute('data-line-id') for row in page.locator('.solution-zone .code-row').all()]==order
    expect(page.locator('.report')).to_contain_text('Elfogadva')
    # Keyboard: two connectors. The new rule 3 → 4 contradicts the arrangement, which is re-evaluated at once.
    page.locator('.solution-zone [data-rule-connect="4"]').focus();page.keyboard.press('Enter');expect(page.locator('.board-connecting')).to_contain_text('#4')
    page.locator('.solution-zone [data-rule-connect="3"]').focus();page.keyboard.press('Enter')
    expect(panel).to_have_attribute('data-rule-panel-line','4');expect(panel.locator('[data-rule-pair="3-4"] .rule-badge')).to_have_text('Szerzői');expect(page.locator('.report')).to_contain_text('Hibás')
    page.screenshot(path=str(ARTIFACTS/('ux-try-rules-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
    page.locator('[data-preview-toggle]').click()
    for selector in ['[data-rule-line]','[data-rule-connect]','[data-try-rules]','[data-rule-panel]','.zone-arcs path','.rule-selected,.rule-before,.rule-after']:expect(page.locator(selector)).to_have_count(0)
    page.locator('[data-preview-toggle]').click();expect(page.locator('.solution-zone .zone-arcs path.arc')).not_to_have_count(0)
    practice(page);page.locator('[data-all]').click()
    for selector in ['[data-rule-line]','[data-rule-connect]','[data-try-rules]','.zone-arcs']:expect(page.locator(selector)).to_have_count(0)
def rule_cause_lifts(page):
    """ADR-054: a rejected author attempt names the violated rule's reason and its lifting step;
    the button opens that rule, a confirmed policy override accepts the order; the learner sees none of it."""
    source='\n'.join(['class Box {','  constructor() {','    this.a = 1;','    this.b = 2;','  }','}','function evaluate() {',"  const list = Object['ke' + 'ys'];",'  return list(new Box());','}'])
    # The rule under test exists only while key order is observed (ADR-055); since ADR-106 a new draft ignores it.
    build_with(page,source,inputs='valid',keyOrder='observed')
    expect(page.locator('[data-ordering-policy]').first).not_to_contain_text('nem alkalmazható')
    to_try(page);page.locator('[data-all]').click();page.locator('[data-down="2"]').click();page.locator('[data-check]').click()
    expect(page.locator('.report')).to_contain_text('Hibás');cause=page.locator('.report [data-rule-cause="3-4"]')
    expect(cause).to_contain_text('a kulcsok létrehozási sorrendje');expect(cause).to_contain_text('„Nem számít” beállítás feloldja');expect(cause).to_contain_text('Policy-felülírás megerősítése')
    page.locator('[data-preview-toggle]').click();expect(page.locator('[data-rule-cause]')).to_have_count(0);page.locator('[data-preview-toggle]').click()
    page.locator('[data-check]').click();cause.locator('[data-rule-line="4"]').click()
    panel=page.locator('.try-rule-panel [data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','4')
    expect(panel.locator('[data-rule-pair="3-4"] .rule-meaning')).to_contain_text('felsorolhatja őket')
    panel.locator('[data-rule-pair="3-4"] [data-rule-edit="remove"]').click();confirm=page.locator('[data-rule-confirm]')
    confirm.locator('[data-rule-note]').fill('A kulcsok sorrendje itt nem számít.');confirm.locator('[data-rule-edit="confirm"]').click()
    expect(page.locator('.rule-status')).to_contain_text('újraminősítve');page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.screenshot(path=str(ARTIFACTS/('ux-rule-cause-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
def key_order_and_rule_kinds(page):
    """ADR-055: with key order declared not to count, the swapped key writes are accepted without any
    rule edit and the model stays analysis-verified. ADR-056: with key order counting, lifting the
    rule kind in one confirmed step accepts it too, and the qualification honestly drops."""
    source='\n'.join(['class Box {','  constructor() {','    this.a = 1;','    this.b = 2;','  }','}','function evaluate() {',"  const list = Object['ke' + 'ys'];",'  return list(new Box());','}'])
    def make(key_order):build_with(page,source,keyOrder=key_order)
    def swapped_verdict():
        to_try(page)
        if page.locator('[data-all]').count():page.locator('[data-all]').click()
        if page.locator('.solution-zone .code-row code').nth(2).text_content().strip()=='this.a = 1;':page.locator('[data-down="2"]').click()
        page.locator('[data-check]').click();return page.locator('.report')
    make('ignored');expect(page.locator('[data-analysis-settings]')).to_contain_text('nem számít');expect(page.locator('[data-step-verification]')).to_have_text('Elemzéssel igazolt')
    expect(swapped_verdict()).to_contain_text('Elfogadva')
    make('observed');expect(page.locator('[data-analysis-settings]')).to_contain_text('számít')
    kinds=page.locator('[data-rule-kinds]');kinds.locator(':scope > summary').click();kinds.locator('[data-rule-kind="key-creation-order"]').click()
    kinds.locator('[data-rule-kind-note]').fill('A kulcsok sorrendje itt nem számít.');kinds.locator('[data-rule-kind-confirm]').click()
    expect(kinds.locator('.rule-status')).to_contain_text('1 szabály feloldva');expect(page.locator('[data-step-verification]')).to_have_text('Nem igazolt')
    expect(swapped_verdict()).to_contain_text('Elfogadva')
    page.screenshot(path=str(ARTIFACTS/('ux-key-order-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
def class_fields_setting(page):
    """ADR-075: with both class-field modes (default) a base setter of the field name keeps the two fields
    in order; with standard [[Define]] fields only, the swap is accepted without any rule edit, the model
    stays analysis-verified and the rules step names the setting."""
    source='\n'.join(['class B {','  set f5(value) {',"    record('set', this.g);",'  }','}','class A extends B {','  f5 = 6;','  g = 7;','}','function evaluate() {','  const a = new A();','  return [a.g, a.f5];','}'])
    def make(class_fields):build_with(page,source,classFields=class_fields)
    def swapped_verdict():
        to_try(page)
        if page.locator('[data-all]').count():page.locator('[data-all]').click()
        if page.locator('.solution-zone .code-row code').nth(6).text_content().strip()=='f5 = 6;':page.locator('[data-down="6"]').click()
        expect(page.locator('.solution-zone .code-row code').nth(7)).to_have_text('f5 = 6;')
        page.locator('[data-check]').click();return page.locator('.report')
    make('either');expect(page.locator('[data-analysis-settings]')).to_contain_text('mindkét mód')
    expect(swapped_verdict()).to_contain_text('Hibás')
    make('define');expect(page.locator('[data-analysis-settings]')).to_contain_text('csak szabványos');expect(page.locator('[data-step-verification]')).to_have_text('Elemzéssel igazolt')
    expect(swapped_verdict()).to_contain_text('Elfogadva')
    page.locator('[data-step="rules"]').click();analysis_options(page);expect(page.locator('[data-preflight="classFields"]')).to_have_value('define')
def rule_edit_keeps_scroll(page):
    """A rule edit yields a new draft id, but it is the same project: the sorter keeps its scroll like after a drag."""
    source='\n'.join(['function f() {',*[f'  const v{i} = {i};' for i in range(38)],'  g(v0, v37);','}'])
    build(page,source);to_try(page);page.locator('[data-all]').click()
    zone=page.locator('.solution-zone');zone.evaluate('z=>{z.scrollTop=z.scrollHeight}');top=zone.evaluate('z=>z.scrollTop');assert top>200,top
    open_rules(page);page.locator('.solution-zone .code-row[data-line-id="40"] [data-rule-line]').click()
    panel=page.locator('.try-rule-panel [data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','40')
    draft=page.locator('.solution-zone').evaluate('()=>document.querySelector("#app").dataset.renderedExercise')
    panel.locator('[data-rule-add="before"] select').select_option('30');panel.locator('[data-rule-add="before"] [data-rule-edit="add"]').click()
    expect(panel.locator('[data-rule-pair="30-40"] .rule-badge')).to_have_text('Szerzői');expect(page.locator('.report')).to_contain_text('Elfogadva')
    assert page.evaluate('document.querySelector("#app").dataset.renderedExercise')!=draft,'the edit installs a new draft'
    assert abs(zone.evaluate('z=>z.scrollTop')-top)<=1,(zone.evaluate('z=>z.scrollTop'),top)
    panel.locator('[data-rule-edit="remove"][data-before="30"][data-after="40"]').click();expect(panel.locator('[data-rule-pair="30-40"]')).to_have_count(0)
    expect(page.locator('.report')).to_contain_text('Elfogadva');assert abs(zone.evaluate('z=>z.scrollTop')-top)<=1
    # Practice exercises keep their own scroll identity.
    practice(page);page.locator('[data-all]').click();assert page.locator('.solution-zone').evaluate('z=>z.scrollTop')==0
def link_toggle(page):
    """ADR-024: the circle is a link toggle on the board and on both sorter zones. The anchor's links
    show as checks in their colour; a check removes the link, an empty circle adds it, and the same
    clicks restore a removed generated link exactly (status and badge included)."""
    build(page,rules_source);panel=page.locator('[data-rule-panel]');status=page.locator('[data-model-insight] [data-verification-status]')
    toggle=lambda line:page.locator(f'.board-row[data-board-line="{line}"] [data-rule-connect]')
    expect(status).to_have_text('Elemzéssel igazolt')
    toggle(4).click();expect(toggle(4)).to_have_attribute('data-link','anchor');expect(page.locator('.board-connecting')).to_contain_text('#4')
    for line,kind,pressed in [(1,'before','true'),(2,'before','true'),(5,'after','true'),(6,'after','true'),(3,'none','false')]:
        expect(toggle(line)).to_have_attribute('data-link',kind);expect(toggle(line)).to_have_attribute('aria-pressed',pressed)
    expect(toggle(1)).to_have_class(re.compile('link-locked'));expect(toggle(2)).to_have_attribute('aria-label',re.compile('megszünteted'))
    page.locator('.rule-board').screenshot(path=str(ARTIFACTS/('ux-link-toggle-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')))
    # A structural link stays and says why; the checks disappear after any choice.
    toggle(1).click();expect(panel.locator('.rule-status')).to_contain_text('szerkezeti kapcsolat');expect(page.locator('[data-link]')).to_have_count(0)
    # An empty circle adds an author link; the same two clicks remove it, and again restore it.
    toggle(4).click();toggle(3).click();expect(panel).to_have_attribute('data-rule-panel-line','4');expect(panel.locator('[data-rule-pair="3-4"] .rule-badge')).to_have_text('Szerzői')
    expect(page.locator('[data-link]')).to_have_count(0)
    toggle(4).click();expect(toggle(3)).to_have_attribute('data-link','before');toggle(3).click();expect(panel.locator('[data-rule-pair="3-4"]')).to_have_count(0);expect(status).to_have_text('Elemzéssel igazolt')
    # A proven link asks for the acknowledgement the core names; the same clicks bring it back as it was.
    toggle(4).focus();page.keyboard.press('Enter');toggle(2).focus();page.keyboard.press('Enter')
    expect(panel.locator('[data-rule-confirm]')).to_contain_text('policy-override');panel.locator('[data-rule-edit="confirm"]').click()
    expect(panel.locator('[data-rule-pair="2-4"]')).to_have_count(0);expect(status).to_have_text('Nem igazolt')
    toggle(4).click();expect(toggle(2)).to_have_attribute('data-link','none');toggle(2).click()
    expect(panel.locator('[data-rule-pair="2-4"] .rule-badge')).to_have_text('Bizonyított');expect(status).to_have_text('Elemzéssel igazolt')
    rules_json(page);assert 'relaxations' not in json.loads(page.locator('#model-editor').input_value()).get('authoring',{})
    # The sorter: the same toggle on the solution rows; a drag onto a linked row removes, onto an unlinked one adds.
    to_try(page);page.locator('[data-all]').click()
    row=lambda line:page.locator(f'.solution-zone .code-row[data-line-id="{line}"]')
    row(4).locator('[data-rule-connect]').click();expect(row(2).locator('[data-rule-connect]')).to_have_attribute('data-link','before');expect(row(5).locator('[data-rule-connect]')).to_have_attribute('data-link','after')
    page.keyboard.press('Escape');expect(page.locator('[data-link]')).to_have_count(0)
    def drag(source,target):
        start=row(source).locator('[data-rule-connect]').bounding_box();end=row(target).locator('.code-text').bounding_box()
        page.mouse.move(start['x']+start['width']/2,start['y']+start['height']/2);page.mouse.down()
        page.mouse.move(end['x']+20,end['y']+end['height']/2,steps=8);page.mouse.up()
    order=[item.get_attribute('data-line-id') for item in page.locator('.solution-zone .code-row').all()]
    open_rules(page);drag(3,4);expect(page.locator('.try-rule-panel [data-rule-panel] [data-rule-pair="3-4"] .rule-badge')).to_have_text('Szerzői')
    # The edit re-evaluates the arrangement and renders once more; wait for it before the next drag.
    expect(page.locator('.report')).to_contain_text('Elfogadva')
    drag(3,4);expect(page.locator('.try-rule-panel [data-rule-panel] [data-rule-pair="3-4"]')).to_have_count(0)
    assert [item.get_attribute('data-line-id') for item in page.locator('.solution-zone .code-row').all()]==order,'a link drag never moves a row'
    expect(page.locator('.report')).to_contain_text('Elfogadva')
def pin_lines(page):
    """A board row's pin fixes the line at its reference place and releases it, by pointer and keyboard,
    with a live status; the focus and the (closed) panel stay as they were."""
    build(page,rules_source);pin=lambda line:page.locator(f'.board-row[data-board-line="{line}"] [data-rule-pin]')
    expect(pin(3)).to_have_attribute('aria-pressed','false');expect(pin(3)).to_have_attribute('aria-label',re.compile('rögzítése a 3. helyen'))
    pin(3).click();expect(pin(3)).to_have_attribute('aria-pressed','true');expect(page.locator('.board-row[data-board-line="3"]')).to_have_class(re.compile('fixed-row'))
    expect(page.locator('[data-board-status]')).to_contain_text('#3 sor rögzítve a 3. helyen');expect(pin(3)).to_be_focused();expect(page.locator('[data-rule-panel]')).to_have_count(0)
    page.locator('.rule-board').screenshot(path=str(ARTIFACTS/('ux-pin-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')))
    rules_json(page);assert json.loads(page.locator('#model-editor').input_value())['lines'][2]['fixed'] is True
    page.locator('[data-rules-view="visual"]').click()
    to_try(page);expect(page.locator('.solution-zone .code-row.fixed-row[data-line-id="3"]')).to_have_count(1)
    page.locator('[data-step="rules"]').click()
    pin(3).focus();page.keyboard.press('Enter');expect(pin(3)).to_have_attribute('aria-pressed','false');expect(page.locator('[data-board-status]')).to_contain_text('feloldva')
    expect(page.locator('.board-row[data-board-line="3"]')).not_to_have_class(re.compile('fixed-row'));expect(pin(3)).to_be_focused()
def learner_feedback(page):
    """ADR-026 (F1): the author preview explains a rejection and marks the graded rows; the detail
    list moves focus to them; any move invalidates the diagnosis; the learner view shows only what
    a learner may see."""
    build(page,rules_source);to_try(page);page.locator('[data-all]').click()
    page.locator('[data-up="3"]').click();page.locator('[data-up="2"]').click()
    order=[row.get_attribute('data-line-id') for row in page.locator('.solution-zone .code-row').all()];assert order==['1','4','2','3','5','6'],order
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Hibás')
    expect(page.locator('.report')).to_contain_text('előtt kell állnia')
    marked=page.locator('.solution-zone .code-row.diag-error');expect(marked).to_have_count(2)
    expect(marked.first).to_have_attribute('aria-describedby',re.compile('feedback-0'))
    details=page.locator('[data-feedback]');details.locator('summary').click()
    expect(details.locator('.feedback-item').first).to_contain_text('Bizonyíték');expect(details.locator('.feedback-fix').first).to_contain_text('Ellenőrzött javítás')
    details.locator('[data-feedback-goto="0"]').click();expect(page.locator('.solution-zone .code-row.diag-focus')).to_have_count(2)
    assert page.evaluate("document.activeElement.closest('.code-row')?.classList.contains('diag-focus')"),'focus moves to a named row'
    page.screenshot(path=str(ARTIFACTS/('ux-feedback-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
    # The learner view: no evidence, no rule, the cause withheld; the author's own data stays in the author view.
    page.locator('[data-preview-toggle]').click();expect(page.locator('.report')).to_contain_text('Hibás')
    expect(page.locator('.feedback-evidence')).to_have_count(0);expect(page.locator('.solution-zone .code-row.diag-error')).to_have_count(0)
    expect(page.locator('.feedback-withheld')).to_contain_text('nem jelenik meg')
    page.locator('[data-preview-toggle]').click();expect(page.locator('.solution-zone .code-row.diag-error')).to_have_count(2)
    # Any move invalidates the diagnosis at once.
    page.locator('[data-down="1"]').click();expect(page.locator('.solution-zone .code-row.diag-error,.solution-zone .code-row.diag-possible')).to_have_count(0);expect(page.locator('[data-feedback]')).to_have_count(0)
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
def stale_author_admission(page):
    pending=[]
    def intercept(route):pending.append(route)
    page.route('**/api/author/compile',intercept)
    try:
        for edit_kind in ['source','model']:
            page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill('const submitted = 1;');page.locator('[data-author-apply]').click();expect(page.locator('[data-author-apply]')).to_be_disabled()
            newer='const newer = 2;'
            if edit_kind=='source':page.locator('#author-editor').fill(newer)
            else:page.locator('[data-source-kind="json"]').click();page.locator('#model-editor').fill('{new unfinished JSON')
            route=pending.pop();route.fulfill(response=route.fetch())
            current(page,'source');expect(page.locator('[data-step="rules"]')).to_be_disabled()
            if edit_kind=='source':expect(page.locator('[data-author-apply]')).to_be_enabled();expect(page.locator('#author-editor')).to_have_value(newer)
            else:
                expect(page.locator('#model-editor')).to_have_value('{new unfinished JSON')
                page.locator('[data-source-kind="code"]').click();expect(page.locator('#author-editor')).to_have_value('const submitted = 1;');expect(page.locator('[data-author-apply]')).to_be_enabled()
    finally:page.unroute('**/api/author/compile',intercept)

def stale_source_sample(page):
    pending=[]
    def intercept(route):pending.append(route)
    page.route('**/samples/copy-field-utility.service.ts',intercept)
    try:
        open_menu(page,'open');page.locator('[data-author-sample]').click();expect(page.locator('[data-author-sample]')).to_be_disabled()
        newer='const keepThisDraft = 2;';page.locator('#author-editor').fill(newer)
        route=pending.pop();route.fulfill(body='const obsoleteSample: number = 1;')
        expect(page.locator('[data-author-sample]')).to_be_enabled();expect(page.locator('#author-editor')).to_have_value(newer)
        expect(page.locator('[data-author="language"]')).to_have_value('javascript')
    finally:page.unroute('**/samples/copy-field-utility.service.ts',intercept)
def busy(page):
    model_first(page);pending=[]
    def intercept(route):pending.append(route)
    page.route('**/api/author/preview',intercept)
    try:
        page.locator('[data-check]').click();expect(page.locator('[data-check]')).to_be_disabled();expect(page.locator('[data-check]')).to_have_attribute('aria-busy','true');page.keyboard.press('Control+Enter');assert len(pending)==1
        route=pending.pop();route.fulfill(response=route.fetch());expect(page.locator('.report')).to_contain_text('Elfogadva');expect(page.locator('[data-check]')).to_be_enabled();expect(page.locator('[data-check]')).to_be_focused()
    finally:page.unroute('**/api/author/preview',intercept)
RECORD_ACTIVITY="""()=>{window.__activity=[];new MutationObserver(records=>{for(const record of records){const phase=record.target.dataset?.phase;if(record.attributeName==='data-phase'&&phase&&window.__activity.at(-1)!==phase)window.__activity.push(phase);}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-phase']});}"""
def activity_indicator(browser):
    """ADR-127 (P1): work a user waits for shows one indicator: after 400 ms a chip above the sticky action bar names it,
    a screen reader hears it once, the button's icon turns into a spinner; when the work ends the line fills and the chip
    fades, and nothing stays behind. On a phone the chip stands above the stuck action bar and inside the screen."""
    for width,height in [(1280,800),(390,600)]:
        context=watch(browser.new_context(viewport={'width':width,'height':height},**({'is_mobile':True,'has_touch':True} if width<500 else {})));page=context.new_page()
        try:
            reset(page,BASE);page.locator('[data-source-kind="code"]').click()
            page.locator('#author-editor').fill('function long() {\n'+''.join(f'  const v{i} = {i};\n' for i in range(60))+'  return v0;\n}')
            page.evaluate('window.scrollTo(0,0)');page.evaluate(RECORD_ACTIVITY);held=[]
            page.route('**/api/author/compile',lambda route:held.append(route))
            try:
                bar=page.locator('.step-panel .action-bar');apply=page.locator('[data-author-apply]')
                apply.click();expect(apply).to_have_attribute('aria-busy','true')
                chip=page.locator('[data-activity]');expect(chip).to_be_visible();expect(chip).to_have_attribute('data-phase','running')
                expect(chip).to_contain_text('Modell készítése…');expect(page.locator('[data-activity-live]')).to_have_text('Modell készítése folyamatban.')
                expect(apply).to_have_attribute('data-busy-shown','');expect(apply).to_contain_text('Modell készítése')
                assert chip.get_attribute('aria-hidden') is None and chip.locator('.activity-text').get_attribute('aria-hidden')=='true','the live line speaks; the chip text does not repeat it (ADR-132: only its Megszakítás button is for everyone)'
                expect(chip.locator('[data-activity-abort]')).to_be_hidden()
                box,stuck=chip.bounding_box(),bar.bounding_box()
                assert stuck['y']+stuck['height']>=height-2,f'{width}px: the action bar is stuck at the bottom ({stuck})'
                assert box['y']+box['height']<=stuck['y']+1,f'{width}px: the chip covers the action bar ({box} over {stuck})'
                assert box['x']>=15 and box['x']+box['width']<=width-15,f'{width}px: the chip leaves the screen ({box})'
                assert page.evaluate('document.documentElement.scrollWidth')<=width
                expect(chip).to_contain_text('3 s',timeout=5000)
                route=held.pop();route.fulfill(response=route.fetch())
                current(page,'rules');expect(chip).to_be_hidden(timeout=3000)
                assert page.evaluate('window.__activity')==['running','settling','leaving','hidden'],page.evaluate('window.__activity')
                assert page.locator('[data-busy-shown]').count()==0 and page.locator('[data-activity-live]').text_content()==''
            finally:page.unroute('**/api/author/compile')
        finally:context.close()
def lazy_compiler(page,url):
    """ADR-127 (P1): on the Local Demo the TypeScript compiler (9 MB) loads with the first action that reads source, not
    with the page: a learner who only practises never downloads it."""
    requests=[];listen=lambda request:requests.append(request.url)
    page.on('request',listen)
    try:
        reset(page,url);practice(page);page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class(re.compile(r'\bidle\b'))
        assert not [u for u in requests if u.endswith('/vendor/typescript.mjs')],'the compiler loaded without an author action'
        page.locator('[data-mode="author"]').click();build(page,rules_source)
        assert len([u for u in requests if u.endswith('/vendor/typescript.mjs')])==1,'the first author action loads the compiler once'
    finally:page.remove_listener('request',listen)
def activity_abort(browser,url,pages):
    """ADR-132 (P2): work that lasts names its stage (the Local Demo's compiler download) and after 10 s the chip offers
    Megszakítás, said on the status line. Stopping ends the wait with its own message, the indicator winds down, and
    the page works on: the next build succeeds and a shipped exercise is still checked (the Local Demo's fresh worker
    reloads them)."""
    context=watch(browser.new_context(viewport={'width':1280,'height':800}));page=context.new_page()
    held=[];target='**/vendor/typescript.mjs' if pages else '**/api/author/compile'
    context.route(target,lambda route:held.append(route))
    try:
        reset(page,url);page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(rules_source)
        apply=page.locator('[data-author-apply]');apply.click()
        chip=page.locator('[data-activity]');stop=chip.locator('[data-activity-abort]');live=page.locator('[data-activity-live]')
        expect(chip).to_have_attribute('data-phase','running')
        if pages:
            expect(chip).to_contain_text('a TypeScript-fordító betöltése');expect(live).to_have_text('Modell készítése folyamatban. a TypeScript-fordító betöltése.')
        expect(stop).to_be_hidden();expect(chip).to_contain_text('9 s',timeout=12000);expect(stop).to_be_hidden()
        expect(stop).to_be_visible(timeout=3000);expect(stop).to_have_text('Megszakítás')
        expect(live).to_contain_text('Sokáig tart; a Megszakítás gombbal leállítható.')
        stop.click();expect(chip).to_be_hidden(timeout=3000)
        expect(page.get_by_text(re.compile('^A műveletet megszakítottad'))).to_be_visible()
        current(page,'source');expect(apply).to_be_enabled()
        # The held request belongs to the stopped wait (an aborted fetch, a terminated worker): it is answered with a
        # failure that nobody hears any more.
        for route in held:
            try:route.abort()
            except Exception:pass
        context.unroute_all(behavior='ignoreErrors')
        apply.click();current(page,'rules')
        practice(page);page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class(re.compile(r'\bidle\b'))
        expect(page.locator('.report')).not_to_contain_text('nem érhető el')
    finally:context.close()
SWITCHES_ON="""try{localStorage.setItem('ngdynamic.view-switches.v1','on')}catch(e){}"""
def view_switches_off(browser):
    """ADR-133: the page offers neither Rendező | Megoldáskód nor Szerkesztő | Kártyák. The workspace is the sorter
    without a tab list, in practice and in the author's Try step; the pointer decides the code view whatever an earlier
    choice stored. The key turns the four buttons back on, and they work."""
    for touch,stored,drawn in [(False,'cards','editor'),(True,'editor','cards')]:
        context=watch(browser.new_context(viewport={'width':390,'height':844} if touch else {'width':1280,'height':800},**({'is_mobile':True,'has_touch':True} if touch else {})))
        context.add_init_script("try{localStorage.setItem('ngdynamic.code-view.v1','%s')}catch(e){}" % stored)
        try:
            page=context.new_page();reset(page,BASE)
            def none_offered():
                assert page.locator('[data-view],[data-set-code-view],[role="tablist"]').count()==0,'a view switch is offered'
                assert page.locator('#panel-try').get_attribute('role') is None
                expect(page.locator('.solution-zone')).to_be_visible();expect(page.locator('#app')).to_have_attribute('data-code-view',drawn)
            practice(page);none_offered()
            page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
            page.locator('[data-mode="author"]').click();build(page,rules_source);to_try(page);none_offered()
            assert page.evaluate('document.documentElement.scrollWidth')<=(390 if touch else 1280)
            page.evaluate("""()=>localStorage.setItem('ngdynamic.view-switches.v1','on')""");page.reload();practice(page)
            expect(page.locator('#app')).to_have_attribute('data-code-view',stored)
            expect(page.locator('[data-set-code-view]')).to_have_count(2);page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_be_visible()
        finally:context.close()
def stale_format(page,author):
    if author:selector='#author-editor';action='[data-author-format]'
    else:
        practice(page);page.locator('[data-all]').click();page.locator('[data-view="edit"]').click();selector='#code-editor';action='[data-format]'
    pending=[]
    def intercept(route):pending.append(route)
    page.route('**/api/author/format',intercept)
    try:
        page.locator(action).click();expect(page.locator(action)).to_be_disabled()
        edited='function newer() { return 42; }';page.locator(selector).fill(edited)
        route=pending.pop();route.fulfill(json={'code':'function outdated() { return 0; }','formatter':'delayed-test','indentSize':5})
        expect(page.locator(action)).to_be_enabled();expect(page.locator(selector)).to_have_value(edited)
        if not author:
            page.locator('[data-view="sort"]').click();page.locator('[data-view="edit"]').click();expect(page.locator(selector)).to_have_value(edited)
    finally:page.unroute('**/api/author/format',intercept)

def stale_check_failure(page):
    practice(page);page.locator('[data-all]').click();pending=[]
    def intercept(route):pending.append(route)
    page.route('**/api/evaluate',intercept)
    try:
        page.locator('[data-check]').click();expect(page.locator('[data-check]')).to_be_disabled()
        page.locator('[data-down="1"]').click();route=pending.pop();route.fulfill(status=503,json={'error':'delayed failure'})
        expect(page.locator('[data-check]')).to_be_enabled();expect(page.locator('.report')).not_to_contain_text('Nem eldönthető')
    finally:page.unroute('**/api/evaluate',intercept)


# ADR-141 (T3): every ⓘ on the workbench, opened as the author meets it, on a desktop and a phone, in both themes.
TIP_CHECK='''(tip)=>{
 const button=tip.querySelector(':scope > .info-button'),panel=tip.querySelector(':scope > .toggletip-panel'),wrong=[];
 if(button.hasAttribute('title'))wrong.push('a native title bubble beside ours');
 // The text before the ⓘ in its own line (its label), and the focus ring around the button: they may not touch.
 const range=document.createRange();range.setStart(tip.parentElement,0);range.setEndBefore(tip);
 const text=[...range.getClientRects()].filter(r=>r.width>0&&Math.abs(r.top+r.height/2-(button.getBoundingClientRect().top+button.getBoundingClientRect().height/2))<14);
 const cs=getComputedStyle(button),ring=parseFloat(cs.outlineWidth)+parseFloat(cs.outlineOffset),b=button.getBoundingClientRect();
 const label=text.length?text.reduce((a,r)=>r.right>a.right?r:a):null;
 if(label&&b.left-ring<label.right-0.5)wrong.push(`the focus ring reaches the label (${Math.round(b.left-ring)} < ${Math.round(label.right)})`);
 if(matchMedia('(pointer:coarse)').matches){
  // A 44 px target around the button's centre, and not over the label's last letter.
  const x=b.left+b.width/2,y=b.top+b.height/2;
  for(const [dx,dy] of [[-21,0],[21,0],[0,-21],[0,21]]){const hit=document.elementFromPoint(x+dx,y+dy);if(hit!==button&&!button.contains(hit))wrong.push(`no target at ${dx},${dy}: ${hit?.className||hit?.tagName}`);}
  if(label){const hit=document.elementFromPoint(label.right-2,label.top+label.height/2);if(hit===button||button.contains(hit))wrong.push('the target covers the label');}
  // Nor over another control: a tap on the select under it reaches the select.
  const box={left:x-22,right:x+22,top:y-22,bottom:y+22};
  for(const other of document.querySelectorAll('button,select,input,textarea,a[href],summary')){
   if(tip.contains(other)||!other.checkVisibility()||other.closest('details:not([open]) > :not(summary)'))continue;const r=other.getBoundingClientRect();
   if(r.left<box.right&&r.right>box.left&&r.top<box.bottom&&r.bottom>box.top)wrong.push(`the target overlaps ${other.tagName.toLowerCase()}.${other.className}`);
  }
 }
 return wrong;}'''
# ADR-141 (T3): the position of an opening bubble in the first frame it is painted (it flashed at the top left corner
# when it was placed on the browser's later toggle event).
FIRST_FRAME='''()=>{if(window.__tipFrames)return;window.__tipFrames=[];document.addEventListener('beforetoggle',event=>{const panel=event.target;
 if(!(panel instanceof Element)||!panel.matches('.toggletip-panel')||event.newState!=='open')return;let frames=0;
 const tick=()=>{if(panel.matches(':popover-open')){const style=getComputedStyle(panel);if(style.visibility!=='hidden'&&style.display!=='none'){const r=panel.getBoundingClientRect();window.__tipFrames.push([Math.round(r.left),Math.round(r.top)]);return;}}if(++frames<30)requestAnimationFrame(tick);};
 requestAnimationFrame(tick);},true);}'''
# ADR-141 (T3): how many times the workbench has been drawn (a render replaces #app's children). An answer arriving in
# the background redraws the page (ADR-136); the gate measures between renders, never across one.
RENDERS="()=>{if(!window.__drawn){window.__drawn={n:0};new MutationObserver(()=>window.__drawn.n++).observe(document.querySelector('#app'),{childList:true});}return window.__drawn.n;}"
def settle(page):
    """Waits for a quiet page: no request in flight, the fonts loaded and no render for 300 ms (a slow runner answers
    later; a late font reflows the text)."""
    page.wait_for_load_state('networkidle');page.evaluate('()=>document.fonts.ready.then(()=>true)');drawn=page.evaluate(RENDERS)
    for _ in range(30):
        page.wait_for_timeout(300);now=page.evaluate(RENDERS)
        if now==drawn:return
        drawn=now
def button_states(page):
    """ADR-140 (D1), ADR-143 (D3b): the plate's states. A plate is one flat tone: no gradient, no shadow, no line. A disabled
    one is a hollow plate (a line, no face, a muted label) whether it is :disabled or aria-disabled with its reason; a busy
    one is not disabled to the eye; a pressed one has another face and a line, and no mark on the face (ADR-153); the main action, the check and the
    removing action each have a face of their own that their label reads on."""
    state=page.evaluate("""()=>{const look=b=>{const s=getComputedStyle(b),f=getComputedStyle(b,'::after'),l=getComputedStyle(b,'::before');
      return {opacity:s.opacity,cursor:s.cursor,color:s.color,shadow:s.boxShadow,ground:s.backgroundColor+' '+s.backgroundImage,face:f.backgroundColor,image:f.backgroundImage,mark:f.backgroundSize,line:l.content!=='none'&&!/, 0\\)$/.test(l.backgroundColor)&&!b.hasAttribute('data-busy-shown')};};
     const host=document.querySelector('.toolbar')||document.querySelector('#workbench-main'),make=(attributes)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='x';for(const [k,v] of Object.entries(attributes))b.setAttribute(k,v);host.append(b);return b;};
     const plain=make({}),off=make({disabled:''}),reason=make({'aria-disabled':'true','data-disabled-reason':'ok'}),busy=make({disabled:'','aria-busy':'true'}),on=make({'aria-pressed':'true'});
     const rgb=c=>c.match(/[\\d.]+/g).slice(0,3).map(Number),light=c=>{const [r,g,b]=rgb(c).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
     const reads=cls=>{const b=make({});b.className='btn '+cls;const a=light(getComputedStyle(b).color),f=light(getComputedStyle(b,'::after').backgroundColor),face=getComputedStyle(b,'::after').backgroundColor;b.remove();return [cls,(Math.max(a,f)+.05)/(Math.min(a,f)+.05),face];};
     const result={plain:look(plain),off:look(off),reason:look(reason),busy:look(busy),on:look(on),roles:['primary','primary check','danger'].map(reads)};
     for(const b of [plain,off,reason,busy,on])b.remove();return result;}""")
    clear=lambda colour:colour.replace(' ','') in ('rgba(0,0,0,0)','transparent')
    plain=state['plain']
    assert not clear(plain['face']) and plain['image']=='none' and plain['shadow']=='none' and not plain['line'],('a plate is one flat tone',plain)
    assert clear(plain['ground'].split(' none')[0]),('the face is the layer under the label, not the button',plain)
    for name in ('off','reason'):
        assert state[name]['opacity']=='1' and state[name]['cursor']=='not-allowed',(name,state[name])
        assert clear(state[name]['face']) and state[name]['line'] and state[name]['color']!=plain['color'],(name,'a hollow plate with a muted label',state[name],plain)
    assert all(state['off'][k]==state['reason'][k] for k in ('face','line','color')),'the two kinds of disabled look the same'
    assert state['busy']['cursor']=='progress' and state['busy']['opacity']=='1' and state['busy']['face']==plain['face'] and not state['busy']['line'],state['busy']
    # ADR-153: a pressed plate has its own face and a line around it; nothing is drawn on the face (no mark under the label)
    assert state['on']['face']!=plain['face'] and state['on']['line'] and state['on']['image']=='none',state['on']
    # the roles (the main action, the learner's check, an action that removes): each has its own face, and its label reads on it
    faces=[face for _,_,face in state['roles']]
    assert len(set(faces+[plain['face']]))==4,('every role has its own face',state['roles'],plain['face'])
    assert all(ratio>=4.5 for _,ratio,_ in state['roles']),('a role label under 4.5 to 1 on its face',state['roles'])
def header_menu(browser,url):
    """ADR-145 (D5): on a narrow screen the header's session menu and theme button are one menu behind one icon (a menu's
    button is never a word); the full screen button stays beside it. The menu's rows carry an icon and the whole label;
    the theme is a choice of three that keeps the menu open and the focus on the chosen part; Escape closes it and
    returns the focus, and so does a row that did its work; a wide screen has the controls apart, and crossing the
    width draws the header again; the learner's preview has no session and so no menu."""
    controls="()=>[...document.querySelectorAll('.header-actions>*')].map(e=>e.matches('details.app-menu')?'menu':e.matches('details.session-menu')?'session':e.matches('.theme-toggle')?'theme':e.matches('.fullscreen-toggle')?'full':e.matches('.preview-toggle')?'preview':e.className)"
    context=watch(browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True));page=context.new_page();failures=[];page.on('pageerror',lambda error:failures.append(str(error)))
    try:
        reset(page,url);page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
        assert page.evaluate(controls)==['menu','full'],('a phone: the menu and the full screen button',page.evaluate(controls))
        menu=page.locator('details.app-menu');button=menu.locator(':scope > summary');expect(button).to_have_attribute('aria-label','Menü: munkamenet és megjelenés')
        assert button.inner_text().strip()=='' and button.locator('svg').count()==1,('a menu button is its icon',button.inner_text())
        assert button.bounding_box()['width']>=34 and button.bounding_box()['height']>=34
        button.click();panel=menu.locator('.menu-panel');expect(panel).to_be_visible()
        # every row says what it does: an icon and a visible label, at least 44 px high, inside the screen
        rows=panel.locator('button.btn');assert rows.count()==4 and panel.locator('[data-fullscreen]').count()==0,rows.count()
        for index in range(rows.count()):
            row=rows.nth(index);box=row.bounding_box();label=row.locator('span').first
            assert box['height']>=44 and label.bounding_box()['width']>20 and row.locator('svg').count()==1,(index,box)
        box=panel.bounding_box();assert box['x']>=0 and box['x']+box['width']<=390,box
        expect(panel.locator('.menu-heading')).to_have_text(['Munkamenet','Megjelenés'])
        # the theme: one of three is chosen; choosing sets it, keeps the menu open and the focus on the choice
        parts=panel.locator('[data-theme-set]');expect(parts).to_have_text(['Rendszer','Világos','Sötét']);expect(panel.locator('[data-theme-set][aria-pressed="true"]')).to_have_text('Rendszer')
        panel.locator('[data-theme-set="dark"]').click();expect(page.locator('html')).to_have_attribute('data-theme','dark')
        expect(menu).to_have_attribute('open','');expect(page.locator('[data-theme-set="dark"]')).to_be_focused();expect(page.locator('[data-theme-set][aria-pressed="true"]')).to_have_text('Sötét')
        page.locator('[data-theme-set="system"]').click();expect(page.locator('html')).not_to_have_attribute('data-theme','dark');expect(menu).to_have_attribute('open','')
        page.keyboard.press('Escape');expect(menu).not_to_have_attribute('open','');expect(button).to_be_focused()
        # the full screen button stands outside the menu and keeps the focus through its own render
        full=page.locator('.header-actions>[data-fullscreen]');full.click();expect(page.locator('#app')).to_have_attribute('data-surface','app')
        expect(full).to_be_focused();expect(full).to_have_attribute('aria-pressed','true');full.click();expect(page.locator('#app')).not_to_have_attribute('data-surface','app')
        # a session row does its work from here; the render closes the menu and its button takes the focus the row had
        button.click();panel.locator('[data-save-local]').click();expect(page.locator('.report, .note').first).to_be_visible()
        expect(menu).not_to_have_attribute('open','');expect(button).to_be_focused()
        # a wide screen has the three controls apart, and crossing the width draws the header the other way
        page.locator('[data-mode="author"]').click();page.set_viewport_size({'width':900,'height':844});page.wait_for_function("()=>!document.querySelector('.header-actions details.app-menu')")
        assert page.evaluate(controls)==['session','theme','full'],('three controls apart on a wide screen',page.evaluate(controls))
        page.set_viewport_size({'width':390,'height':844});page.wait_for_function("()=>document.querySelector('.header-actions details.app-menu')")
        assert page.evaluate(controls)==['menu','full'],page.evaluate(controls)
        # the learner's preview has no session: the theme button and the full screen button, no menu
        opener=page.locator('details.open-menu')
        if opener.get_attribute('open') is None:opener.locator('summary').click()
        page.locator('[data-start-example]').select_option(page.locator('[data-start-example] option').nth(1).get_attribute('value'))
        page.locator('[data-author-apply]').click();current(page,'rules');page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible()
        assert page.evaluate(controls)==['preview','menu','full'],page.evaluate(controls)
        page.locator('[data-preview-toggle]').click();expect(page.locator('#app.learner-preview')).to_have_count(1)
        assert page.evaluate(controls)==['preview','theme','full'],('the learner preview has no menu',page.evaluate(controls))
        assert not failures,failures
    finally:context.close()
    # a small phone on its side (568×320) is narrow and low at once: the mode tabs keep their whole labels (the logo
    # steps back instead), and the open menu ends inside the screen, its last part reached by scrolling the menu
    context=watch(browser.new_context(viewport={'width':568,'height':320},is_mobile=True,has_touch=True));page=context.new_page();page.on('pageerror',lambda error:failures.append(str(error)))
    try:
        reset(page,url);page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
        tabs=page.evaluate("()=>[...document.querySelectorAll('.mode-tabs button')].map(b=>{const r=b.getBoundingClientRect(),t=b.querySelector('span:not(.icon)').getBoundingClientRect();return {left:r.left,right:r.right,text:[t.left,t.right]}})")
        assert all(tab['left']<=tab['text'][0] and tab['text'][1]<=tab['right'] for tab in tabs) and tabs[0]['right']<=tabs[1]['left'],('a mode tab holds its whole label',tabs)
        assert page.evaluate("document.querySelector('.header').scrollWidth<=document.querySelector('.header').clientWidth")
        assert page.evaluate(controls)==['menu','full'],page.evaluate(controls)
        page.locator('details.app-menu>summary').click();panel=page.locator('.app-menu .menu-panel');expect(panel).to_be_visible()
        box=panel.bounding_box();assert box['y']>=0 and box['y']+box['height']<=320,('the menu ends inside the screen',box)
        last=panel.locator('[data-theme-set="dark"]');page.evaluate("()=>{const panel=document.querySelector('.app-menu .menu-panel');panel.scrollTop=panel.scrollHeight;}")
        box=last.bounding_box();assert box['y']>=0 and box['y']+box['height']<=320 and page.evaluate('scrollY')==0,('the last choice is reached by scrolling the menu, not the page',box,page.evaluate('scrollY'))
        last.click();expect(page.locator('html')).to_have_attribute('data-theme','dark');expect(page.locator('details.app-menu')).to_have_attribute('open','')
        assert not failures,failures
    finally:context.close()
TOOLBAR="""()=>{const group=document.querySelector('.workspace-actions'),bar=group.parentElement,name=e=>e.matches('details')?'menu':[...e.attributes].find(a=>a.name.startsWith('data-')&&a.name!=='data-label-rank').name.slice(5);
 const read=()=>({overflow:bar.scrollWidth-bar.clientWidth,rows:new Set([...group.children].map(e=>Math.round(e.getBoundingClientRect().top))).size,
  labelled:[...group.children].filter(e=>!e.matches('details')&&e.querySelector(':scope > span').getBoundingClientRect().width>20).map(name)});
 const now=read(),step=group.dataset.labels??null;let more=null;
 // one step more of labels must not fit: the fitting chose the most the row has room for
 if(step==='0'||step==='1'){group.dataset.labels=String(+step+1);more=read();group.dataset.labels=step;}
 return {step,tools:[...group.children].map(name),ranked:group.querySelectorAll(':scope > [data-label-rank]').length,...now,more:more&&(more.overflow>0||more.labelled.length===now.labelled.length?'does not fit':'fits'),page:document.documentElement.scrollWidth-innerWidth};}"""
def toolbar_menu(browser,url):
    """ADR-145 (D5): on a narrow screen a workspace tool shows its label where the toolbar's row has room for it (the
    tool the step is about first), measured: one row, nothing cut, and one step more of labels would not fit. Where the
    help stands under the lists, Újrakezdés and the way to that help wait behind one icon; a row that did its work
    hands the focus to the menu's button; the help row opens the help and hands it the focus. The author's Próba has no
    help below, so its four tools stay; a wide screen has every tool labelled and no menu."""
    def phone(width):
        context=watch(browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True));page=context.new_page();page.on('pageerror',lambda error:failures.append(str(error)));return context,page
    def author_try(page):
        reset(page,url);opener=page.locator('details.open-menu')
        if opener.get_attribute('open') is None:opener.locator('summary').click()
        page.locator('[data-start-example]').select_option(page.locator('[data-start-example] option').nth(1).get_attribute('value'))
        page.locator('[data-author-apply]').click();current(page,'rules');page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible()
    failures=[];seen={}
    for width in [320,360,390,600]:
        context,page=phone(width)
        try:
            reset(page,url);page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
            page.wait_for_function("()=>document.querySelector('.workspace-actions')?.dataset.labels")
            state=page.evaluate(TOOLBAR);seen[width]=state['labelled']
            assert state['tools']==['all','focus','menu'] and state['ranked']==2,(width,state)
            assert state['overflow']<=0 and state['rows']==1 and state['page']<=0,(width,'the tools stand in one row inside the screen',state)
            assert state['more']!='fits',(width,'a label more would have fitted',state)
            author_try(page);page.wait_for_function("()=>document.querySelector('.workspace-actions')?.dataset.labels");state=page.evaluate(TOOLBAR)
            assert state['tools']==['reset','all','rule-panel-toggle','focus'] and state['ranked']==4,(width,state)
            assert state['overflow']<=0 and state['rows']==1 and state['page']<=0 and state['more']!='fits',(width,state)
            # the tool the step is about is the first to carry its label
            assert not state['labelled'] or 'rule-panel-toggle' in state['labelled'],(width,state)
            if width==600:assert state['labelled']==['reset','all','rule-panel-toggle','focus'],(width,state)
        finally:context.close()
    # the widths differ, so the answers do: icons on the narrowest phone, the first tool's label, then every label
    assert seen[320]==[] and seen[360]==['all'] and seen[390]==['all','focus'] and seen[600]==['all','focus'],seen
    context,page=phone(390)
    try:
        reset(page,url);page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
        menu=page.locator('.workspace-actions details.more-menu');button=menu.locator(':scope > summary');expect(button).to_have_attribute('aria-label','További eszközök')
        assert button.inner_text().strip()=='' and button.locator('svg').count()==1,('a menu button is its icon',button.inner_text())
        box=button.bounding_box();assert box['width']>=44 and box['height']>=44,box
        button.click();panel=menu.locator('.menu-panel');expect(panel).to_be_visible();rows=panel.locator('button.btn');expect(rows).to_have_text(['Újrakezdés','Súgó: kezelés és billentyűzet'])
        for index in range(rows.count()):
            row=rows.nth(index);box=row.bounding_box();assert box['height']>=44 and row.locator('span').first.bounding_box()['width']>20 and row.locator('svg').count()==1,(index,box)
        box=panel.bounding_box();assert box['x']>=0 and box['x']+box['width']<=390,box
        # with nothing placed there is nothing to start again: the row says so and stays a row
        expect(rows.nth(0)).to_have_attribute('aria-disabled','true')
        # the help row: the help under the lists opens, is on the screen and has the focus; the menu is closed
        helper=page.locator('details.workspace-help');expect(helper).not_to_have_attribute('open','')
        rows.nth(1).click();expect(helper).to_have_attribute('open','');expect(helper.locator(':scope > summary')).to_be_focused();expect(menu).not_to_have_attribute('open','')
        assert page.evaluate("()=>{const r=document.querySelector('details.workspace-help > summary').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}"),'the opened help is on the screen'
        # Újrakezdés from the menu: the attempt starts again, the menu is closed and its button has the focus
        page.evaluate('scrollTo(0,0)');pool=page.locator('.source-zone .drag-handle');lines=pool.count();assert lines>0;page.locator('[data-all]').click();expect(pool).to_have_count(0)
        button.click();expect(rows.nth(0)).not_to_have_attribute('aria-disabled','true');rows.nth(0).click()
        expect(pool).to_have_count(lines);expect(menu).not_to_have_attribute('open','');expect(button).to_be_focused()
        # Escape closes the menu and returns the focus; the focus surface keeps the same tools
        button.click();page.keyboard.press('Escape');expect(menu).not_to_have_attribute('open','');expect(button).to_be_focused()
        page.locator('[data-focus]').click();expect(page.locator('#app')).to_have_attribute('data-surface','focus');expect(page.locator('[data-focus]')).to_be_focused()
        state=page.evaluate(TOOLBAR);assert state['tools']==['all','focus','menu'] and state['overflow']<=0 and state['rows']==1,state
        page.locator('[data-focus]').click();expect(page.locator('#app')).not_to_have_attribute('data-surface','focus')
        # a wide screen: every tool labelled by the stylesheet, nothing ranked, no menu
        page.set_viewport_size({'width':900,'height':844});page.wait_for_function("()=>!document.querySelector('.workspace-actions details')")
        state=page.evaluate(TOOLBAR);assert state['tools']==['reset','all','focus'] and state['ranked']==0 and state['step'] is None and state['labelled']==['reset','all','focus'],state
        assert not failures,failures
    finally:context.close()
def toggletips_everywhere(browser,url):
    """ADR-141 (T3): the ⓘ of every place, on a desktop and a phone, light and dark: opening it moves nothing; the bubble
    stands inside the screen; the focus ring stays off the label; on a touch screen the target is 44 px and leaves the
    label alone; there is no native title bubble; it is painted where it belongs from its first frame (by keyboard, mouse
    and touch); Escape, an outside click and Tab out each close it and Escape returns the focus. The places: the settings, the findings' head, a grouped project-context finding, the inputs line, the three
    task questions and the qualification."""
    seen=set()
    for theme in ('light','dark'):
        for name,viewport,touch in (('desktop',{'width':1280,'height':900},False),('phone',{'width':390,'height':844},True)):
            context=browser.new_context(viewport=viewport,color_scheme=theme,**({'is_mobile':True,'has_touch':True} if touch else {}));page=context.new_page()
            def check(where):
                tips=page.locator('.toggletip')
                for i in range(tips.count()):
                    tip=tips.nth(i)
                    if not tip.is_visible():continue
                    help_id=tip.get_attribute('data-help');label=f'{theme} {name} {where} {help_id}';seen.add(help_id)
                    button=tip.locator('.info-button');panel=tip.locator('.toggletip-panel')
                    button.scroll_into_view_if_needed();page.keyboard.press('Shift');button.focus()
                    wrong=tip.evaluate(TIP_CHECK);assert not wrong,f'{label}: {wrong}'
                    page.evaluate(FIRST_FRAME)
                    for attempt in range(3):
                        # Measured between renders: a background answer that redraws the page meanwhile is not the bubble's doing.
                        settle(page);button.focus();drawn=page.evaluate(RENDERS);page.evaluate('window.__tipFrames.length=0')
                        before=page.evaluate(PAGE_LAYOUT);page.keyboard.press('Enter');expect(panel).to_be_visible()
                        page.wait_for_function('()=>(document.querySelector(".toggletip-panel:popover-open")?.style.top??"")!==""')
                        page.wait_for_function('()=>window.__tipFrames.length>0')
                        final=panel.evaluate('p=>{const r=p.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top)]}')
                        after=page.evaluate(PAGE_LAYOUT)
                        if page.evaluate(RENDERS)==drawn:break
                        page.keyboard.press('Escape');expect(panel).to_be_hidden()
                    else:raise AssertionError(f'{label}: the page kept redrawing; nothing measured')
                    assert page.evaluate('window.__tipFrames[0]')==final,f"{label}: first painted at {page.evaluate('window.__tipFrames[0]')}, placed at {final}"
                    if after!=before:
                        moved=[(a,b) for a,b in zip(before,after) if a!=b][:4]
                        raise AssertionError(f'{label}: opening moved the page {moved} (lengths {len(before)} → {len(after)})')
                    assert not page.evaluate(BUBBLE_MISPLACED),f'{label}: {page.evaluate(BUBBLE_MISPLACED)}'
                    page.keyboard.press('Escape');expect(panel).to_be_hidden();expect(button).to_be_focused()
                    page.evaluate('window.__tipFrames.length=0')
                    if touch:button.tap()
                    else:button.click()
                    expect(panel).to_be_visible();page.wait_for_function('()=>window.__tipFrames.length>0')
                    assert page.evaluate('window.__tipFrames[0]')==panel.evaluate('p=>{const r=p.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top)]}'),f'{label}: a pointer opening flashed'
                    page.mouse.click(2,viewport['height']//2);expect(panel).to_be_hidden()
                    button.focus();page.keyboard.press('Enter');expect(panel).to_be_visible()
                    for _ in range(14):
                        page.keyboard.press('Tab')
                        if not tip.evaluate('t=>t.contains(document.activeElement)'):break
                    expect(panel).to_be_hidden()
            try:
                page.goto(url);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
                page.locator('[data-source-kind="code"]').click();page.locator('[data-author="language"]').select_option('typescript')
                page.locator('#author-editor').fill("import { x } from './m';\nimport { y } from './n';\nconsole.log(x + y);");page.locator('[data-author-check]').click()
                expect(page.locator('.toggletip[data-help="project-context"]')).to_have_count(1);check('source')
                page.locator('[data-author="language"]').select_option('javascript')
                page.locator('#author-editor').fill('const box = { a: 1 };\nconst p = new Proxy(box, {});\nconst a = p.a;\nconsole.log(a);');page.locator('[data-author-apply]').click()
                current(page,'rules');analysis_options(page);expect(page.locator('[data-inputs-override] .toggletip')).to_have_count(1);check('rules')
            finally:context.close()
    assert {'findings','project-context','inputs','keyOrder','fillable','checkable','fair','qualification'}<=seen,seen

try:
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception:time.sleep(.1)
    with sync_playwright() as p:
        browser=launch(p);context=browser.new_context(viewport={'width':1500,'height':1000},permissions=['clipboard-read','clipboard-write'])
        # ADR-133: many cases below use the switched-off views (solution editor, code-view choice); the key turns them on.
        # The shipped default is checked in its own context (view_switches_off).
        context.add_init_script(SWITCHES_ON);context.tracing.start(screenshots=True,snapshots=True,sources=True);page=context.new_page();page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        watch(context)
        try:
            for mode,url in [('node',BASE),('pages',f'http://127.0.0.1:{static.server_port}/developer-exercise/')]:
                for name,action in [('steps stay locked until a model exists',steps_locked_until_model),('preflight settings, locks and findings',preflight_ui),('one indentation in source, board and sorter',indentation_single_owner),('the source is checked without a model',source_check),('the Rules step answers three questions and names one next step',task_status),('the help: bubbles beside the settings and the searchable help page',help_toggletips),('the help: Kipróbálom reproduces an example, from the bubble and from the page',lambda page:help_trial(page,url)),('the Local Demo analyses in a worker: the page stays responsive',local_demo_responsive),('the Rules step names why valid inputs became strict',inputs_override),('session v2 records the analysis settings; v1 is partial',session_settings),('model-first creation',model_first),('a rejected order names its rule and how to lift it',rule_cause_lifts),('key order setting and rule kinds',key_order_and_rule_kinds),('class-field mode setting',class_fields_setting),('source file pending then apply',source_file),('JSON file creation',json_file),('fixed position permits crossing peers',fixed_crossing),('learner preview isolation and roundtrip',learner),('keyboard tabs and draft preservation',keyboard_draft),('focus, details and contextual copy',continuity),('one author project beside practice; examples as starting points',reference_continuity),('rebuild and JSON apply refresh every later step',stale_rebuild_updates_every_step),('explicit legacy dependency refresh preserves screenshot arrangement',legacy_dependency_refresh),('delayed model/session File.text preserves newer reference',stale_file_import),('author rule panel edits, acknowledges and stays author-only',rule_panel),('pointer and keyboard connect lines into rules',rule_connect),('try sorter shows, redraws and edits rules while arranging',try_rules),('rule edits keep unapplied reference and JSON drafts',pending_reference_survives_rule_edit),('the input contract is chosen, recorded and restored',input_contract),('rule edits keep the sorter scroll position',rule_edit_keeps_scroll),('circles toggle links: checks, removal and exact restore',link_toggle),('pins fix and release a line on the board',pin_lines),('feedback marks graded rows, invalidates on a move and respects the learner view',learner_feedback)]:
                    reset(page,url);case(mode+' '+name,lambda:action(page))
                reset(page,url);page.screenshot(path=str(ARTIFACTS/('ux-'+mode+'-author.png')),full_page=True)
                practice(page);page.screenshot(path=str(ARTIFACTS/('ux-'+mode+'-practice.png')),full_page=True)
            # The server counts POSTs per client and minute (120). This file runs two server processes, each staying under
            # 120 POSTs in total, so no machine is fast enough to trip the limit (ADR-110, the CI 429 of E6/E7).
            segments.append(len(posts));proc.terminate();proc.wait(timeout=10);proc=start_server()
            for _ in range(100):
                try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
                except Exception:time.sleep(.1)
            reset(page,BASE);case('node one horizontal scroll per code list, row controls pinned',lambda:single_horizontal_scroll(page))
            reset(page,BASE);case('node author chooses the exercise level',lambda:author_level(page))
            case('node tap to pick, tap to place on a touch screen',lambda:tap_to_place(browser))
            case('node picked row actions in the action bar, rule panel as a bottom sheet',lambda:pick_actions(browser))
            case('node disabled controls carry their reason; one draft at a time',lambda:availability_rules(page))
            case('node one code editor: highlight, indentation, formatted load, snippets',lambda:code_editor(page))
            reset(page,BASE);case('node theme choice: system, light, dark, remembered before first paint',lambda:theme_choice(page))
            reset(page,BASE);case('node header and step menus open and close',lambda:menus(page))
            case('node forced dark browser keeps the chosen light theme white',lambda:forced_dark(p))
            reset(page,BASE);case('node editor stripes stay on their rows while scrolling',lambda:editor_stripes(page))
            reset(page,BASE);case('node focus mode: only the code workspace, largest surface, arrangement kept',lambda:focus_mode(page))
            case('node focus mode without the Fullscreen API: overlay, Escape leaves',lambda:focus_without_fullscreen_api(browser))
            reset(page,BASE);case('node two code views, remembered, with their row geometry',lambda:code_views(page))
            reset(page,BASE);case('node pane separator and full-screen focus without scroll',lambda:split_and_full_screen_focus(page))
            case('node the tools and the panels are one frame; the rule panel docks behind a separator of its own',lambda:rules_split(browser,BASE))
            case('node the practice list is the curriculum tree: branches open and close, the open exercise\'s path is open',lambda:curriculum_tree(browser,BASE))
            case('pages the practice list is the curriculum tree: branches open and close, the open exercise\'s path is open',lambda:curriculum_tree(browser,f'http://127.0.0.1:{static.server_port}/developer-exercise/'))
            case('node the practice list shows the technology labels, sums them up and narrows to a chosen one',lambda:technology_filter(browser,BASE))
            case('pages the practice list shows the technology labels, sums them up and narrows to a chosen one',lambda:technology_filter(browser,f'http://127.0.0.1:{static.server_port}/developer-exercise/'))
            case('node the learner sees the rules only after a first check, read-only, where the author allows it',lambda:learner_rules(browser,BASE,False))
            case('pages the learner sees the rules only after a first check, read-only, where the author allows it',lambda:learner_rules(browser,f'http://127.0.0.1:{static.server_port}/developer-exercise/',True))
            reset(page,BASE);case('node focus bar and the return to the full-screen page',lambda:focus_bar_and_full_screen_return(page))
            reset(page,BASE);case('node first gate: a definite language error stays on the source step',lambda:source_gate(page))
            reset(page,BASE);case('node second gate: stale source keeps the Try step closed',lambda:second_gate(page))
            reset(page,BASE);case('node duplicate-check prevention and async feedback',lambda:busy(page))
            case('node one progress indicator: delayed, docked above the action bar, winds down',lambda:activity_indicator(browser))
            case('pages the compiler loads with the first author action, not with the page',lambda:lazy_compiler(page,f'http://127.0.0.1:{static.server_port}/developer-exercise/'))
            case('node the four view buttons are switched off; the key turns them back on',lambda:view_switches_off(browser))
            case('node a menu opened before a background answer stays open',lambda:background_render_keeps_menu(page))
            case('node the app bar keeps the wordmark wherever it fits, EDITOR beside it on the desktop',lambda:header_logo_fits(browser))
            case('node the rule icons of the Try lists stand in one column, the arcs before them',lambda:rule_icons_in_one_column(browser))
            case('node the result bar sticks to the bottom in practice and in Try, at every width',lambda:result_bar_sticks(browser))
            case('node a long wait offers Megszakítás after 10 s and the page works on',lambda:activity_abort(browser,BASE,False))
            case('pages the compiler download is named; Megszakítás restarts the worker, exercises still check',lambda:activity_abort(browser,f'http://127.0.0.1:{static.server_port}/developer-exercise/',True))
            reset(page,BASE);case('node admission preserves newer reference edits',lambda:stale_author_admission(page))
            reset(page,BASE);case('node sample loading preserves newer reference edits',lambda:stale_source_sample(page))
            for name,action in [('author format preserves newer edits',lambda:stale_format(page,True)),('solution format preserves newer edits',lambda:stale_format(page,False)),('stale check failure cannot replace newer attempt',lambda:stale_check_failure(page))]:
                reset(page,BASE);case('node '+name,action)
            reset(page,BASE);case('node button states: disabled one way, busy not disabled, pressed lined and unmarked',lambda:button_states(page))
            case('node every ⓘ: nothing moves, inside the screen, ring off the label, 44 px on touch, closes three ways',lambda:toggletips_everywhere(browser,BASE))
            case('node a phone has one header menu beside full screen: labelled rows, the theme as a choice, focus back to its button',lambda:header_menu(browser,BASE))
            case('node a narrow toolbar labels the tools the row has room for and keeps the rare two behind one icon',lambda:toolbar_menu(browser,BASE))
            for width in [320,390,768]:
                mobile=watch(browser.new_context(viewport={'width':width,'height':900},is_mobile=True,has_touch=True));target=mobile.new_page();target.on('pageerror',lambda error:errors.append(str(error)))
                try:
                    reset(target,BASE);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    practice(target);target.locator('[data-all]').click();assert target.evaluate('document.documentElement.scrollWidth')<=width
                    handle=target.locator('.solution-zone .drag-handle[tabindex="0"]').first;assert handle.bounding_box()['width']>=44 and handle.bounding_box()['height']>=44
                    target.locator('[data-mode="author"]').click();build(target,rules_source);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    connector=target.locator('[data-rule-connect="3"]').bounding_box();assert connector['width']>=28 and connector['height']>=28
                    # ADR-141: an open ⓘ bubble floats over the page: nothing moves, and it stays inside the screen, at every width.
                    analysis_options(target);tip=target.locator('.toggletip[data-help="keyOrder"]');panel=tip.locator('.toggletip-panel')
                    tip.locator('.info-button').scroll_into_view_if_needed();before=target.evaluate(PAGE_LAYOUT);tip.locator('.info-button').click();expect(panel).to_be_visible()
                    target.wait_for_function('()=>(document.querySelector(".toggletip-panel:popover-open")?.style.top??"")!==""')
                    assert target.evaluate(PAGE_LAYOUT)==before,f"{width}px: opening the bubble moved the page"
                    assert not target.evaluate(BUBBLE_MISPLACED),f"{width}px: {target.evaluate(BUBBLE_MISPLACED)}"
                    target.keyboard.press('Escape');expect(panel).to_be_hidden()
                    # A bubble taller than the screen (another font, as on the CI runner, taken to the extreme) is held to the room
                    # it has; its rest scrolls inside.
                    target.evaluate("()=>{const sheet=[...document.styleSheets].at(-1);sheet.insertRule('.toggletip-panel{line-height:6!important}',sheet.cssRules.length);}")
                    tip.locator('.info-button').click();expect(panel).to_be_visible()
                    target.wait_for_function('()=>(document.querySelector(".toggletip-panel:popover-open")?.style.top??"")!==""')
                    assert not target.evaluate(BUBBLE_MISPLACED),f"{width}px, tall bubble: {target.evaluate(BUBBLE_MISPLACED)}"
                    assert panel.evaluate('p=>p.scrollHeight>p.clientHeight'),f"{width}px: the tall bubble should scroll inside"
                    target.keyboard.press('Escape')
                    target.screenshot(path=str(ARTIFACTS/f'ux-mobile-{width}.png'),full_page=True);count+=1;print(f'PASS workbench: {width}px touch practice and author layout',flush=True)
                finally:mobile.close()
            # Each server process stays under 120 POSTs in total (the server's per-minute limit), whatever the machine speed.
            counts=[segments[0],len(posts)-segments[0]]
            assert all(count_<120 for count_ in counts),f'{counts} POSTs per server process: the 120/min limit can refuse them on a fast machine'
            assert not errors,errors;context.tracing.stop(path=str(ARTIFACTS/'workbench-trace.zip'));print(f'PASS workbench total: {count} cases',flush=True)
        except Exception:
            page.screenshot(path=str(ARTIFACTS/'workbench-failure.png'),full_page=True);context.tracing.stop(path=str(ARTIFACTS/'workbench-failure-trace.zip'));raise
        finally:context.close();browser.close()
finally:
    static.shutdown();static.server_close();proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
