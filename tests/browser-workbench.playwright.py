"""Real authoring/learner workflows on Node and Pages, with keyboard and mobile QA.
ADR-022: two modes (author steps Forrás → Szabályok → Próba, practice), one active step,
explicit staleness; every transition below checks which model the next view starts from."""
import json,os,re,socket,subprocess,threading,time,urllib.request
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch,StaticServer,open_menu,analysis_options,pixel
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
    # The Format action is a labelled, visible button again (it had become a bare, borderless icon).
    fmt=page.locator('[data-author-format]');expect(fmt).to_be_visible();expect(fmt).to_have_text('Formázás')
    assert fmt.evaluate("b=>getComputedStyle(b).borderTopColor!=='rgba(0, 0, 0, 0)'")
    for legend in ['Elemzési környezet','Forrás biztonságossága','Haladó profil']:expect(box.locator('legend',has_text=legend)).to_have_count(1)
    expect(page.locator('[data-preflight="jsCheck"]')).to_have_count(1);expect(page.locator('[data-preflight="tsDiagnostics"]')).to_have_count(0)
    expect(page.locator('[data-preflight="inputs"] option:checked')).to_contain_text('új feladat kezdőértéke')
    summary=page.locator('[data-preflight-summary]')
    page.locator('[data-preflight="portability"]').select_option('conservative')
    inputs=page.locator('[data-preflight="inputs"]');expect(inputs).to_be_disabled();expect(inputs).to_have_value('any');expect(summary).to_contain_text('3 zárolt')
    why=page.locator('[data-lock-why="inputs"]');why.locator('summary').focus();page.keyboard.press('Enter')
    expect(why).to_have_attribute('open','');expect(why.locator('p')).to_contain_text('Feloldás');expect(why.locator('p')).to_contain_text('Érvényes egyszerű adat')
    expect(page.locator('[data-preflight="objectState"]')).to_be_enabled()
    page.locator('[data-preflight="portability"]').select_option('configured');expect(inputs).to_be_enabled();expect(inputs).to_have_value('valid');expect(summary).not_to_contain_text('zárolt')
    # ADR-113: the Local Demo loads the standard library, so it offers what the server offers (C16 only without it).
    expect(page.locator('[data-preflight="unknownPolicy"] option[value="block"]')).to_be_enabled();expect(page.locator('[data-server-only]')).to_have_count(0)
    page.locator('[data-preflight="unknownPolicy"]').select_option('block');expect(summary).to_contain_text('bizonytalan: tilt')
    page.locator('[data-preflight="unknownPolicy"]').select_option('warn')
    page.locator('#author-editor').fill('function f() {\n  const a = b;\n  const b = 1;\n  return a;\n}');page.locator('[data-author-apply]').click();current(page,'source')
    findings=page.locator('[data-source-diagnostics]');expect(findings).to_contain_text('Biztos hiba');expect(findings).to_contain_text('BS001')
    expect(page.locator('[data-step="source"]')).to_contain_text('Hibás forrás')
    findings.locator('[data-goto-line="2"]').click();expect(page.locator('#author-editor')).to_be_focused()
    assert page.evaluate("()=>{const e=document.querySelector('#author-editor');return e.value.slice(e.selectionStart,e.selectionEnd)}")=='  const a = b;'
    page.locator('#author-editor').fill('function f() {\n  const b = 1;\n  const a = b;\n  return a;\n}')
    page.locator('[data-preflight="objectState"]').select_option('off');expect(page.locator('[data-diagnostics-stale]')).to_be_visible();expect(page.locator('[data-step="source"]')).not_to_contain_text('Hibás forrás')
    page.locator('[data-author-apply]').click();current(page,'rules');page.locator('[data-step="source"]').click()
    expect(page.locator('[data-source-diagnostics]')).to_have_count(0);analysis_options(page);expect(page.locator('[data-preflight="objectState"]')).to_have_value('off')
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
    page.locator('details.analysis-options summary').click();expect(opener).not_to_have_attribute('open','');expect(page.locator('[data-preflight="inputs"]')).to_be_visible()

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
def source_file(page):
    with page.expect_file_chooser() as chooser:open_menu(page,'open');page.locator('[data-import-source]').click()
    chooser.value.set_files({'name':'typed.ts','mimeType':'text/plain','buffer':source.encode()})
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
    page.locator('[data-step="source"]').click();page.locator('[data-author="language"]').select_option('typescript');analysis_options(page);expect(page.locator('[data-preflight="importEmit"]')).to_have_value('verbatim')
    unapplied='function f() {\n  const unapplied = 1;\n}'
    page.locator('#author-editor').fill(unapplied);page.locator('[data-step="rules"]').click();expect(page.locator('[data-stale-notice]')).to_be_visible()
    page.locator('.board-row').first.locator('[data-rule-line]').click();page.locator('[data-rule-edit="fixed"]').click()
    expect(page.locator('[data-rule-panel] .rule-status')).to_contain_text('érvényes');expect(page.locator('[data-stale-notice]')).to_be_visible()
    page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_have_value(unapplied);expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott')
    # An unapplied JSON draft is never overwritten by a rule edit.
    rules_json(page);page.locator('#model-editor').fill('{unapplied JSON');page.locator('[data-rules-view="visual"]').click()
    page.locator('[data-rule-edit="fixed"]').click();expect(page.locator('[data-rule-panel] .rule-status')).to_contain_text('nem alkalmazott JSON')
    page.locator('[data-rules-view="json"]').click();expect(page.locator('#model-editor')).to_have_value('{unapplied JSON')

def input_contract(page):
    """ADR-050: the author picks the input contract; the model records it and frees the input reads.
    ADR-106: a new draft starts from valid inputs, ignored key order and standard class fields, and the
    folded summary follows every change."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click()
    summary=page.locator('details.analysis-options summary');expect(summary).to_contain_text('érvényes adat · kulcssorrend nem számít · szabványos mezők')
    analysis_options(page);expect(page.locator('[data-preflight="inputs"]')).to_have_value('valid');expect(page.locator('[data-preflight="keyOrder"]')).to_have_value('ignored');expect(page.locator('[data-preflight="classFields"]')).to_have_value('define')
    page.locator('[data-preflight="inputs"]').focus();page.locator('[data-preflight="inputs"]').select_option('any');expect(summary).to_contain_text('szigorú bemenet');expect(page.locator('[data-preflight="inputs"]')).to_be_focused()
    page.locator('[data-preflight="inputs"]').select_option('valid');expect(summary).to_contain_text('érvényes adat')
    page.locator('#author-editor').fill('function measure(grid) {\n  const rows = grid.length;\n  const cols = grid[0].length;\n  return rows * cols;\n}');page.locator('[data-author-apply]').click();current(page,'rules')
    rules_json(page);generated=json.loads(page.locator('#model-editor').input_value())
    assert generated['authoring']['evidence']['environment']['inputs']=='valid';assert 2 not in generated['lines'][2]['dependencies']
    page.locator('[data-step="source"]').click();analysis_options(page);expect(page.locator('[data-preflight="inputs"]')).to_have_value('valid');expect(page.locator('[data-author-status]')).to_contain_text('ebből a forrásból')

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
        first.locator('.drag-handle').tap();expect(first).to_have_class(re.compile('picked'));expect(page.locator('[data-move-status]')).to_contain_text('Sor kijelölve')
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
        expect(page.locator('.pick-bar .pick-status')).to_contain_text('Felhasználható sor');page.locator('.pick-bar [data-move]').tap()
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
        page.locator('.source-zone .code-row').nth(1).locator('.code-text').tap();page.locator('.pick-bar [data-rule-line]').tap()
        sheet=page.locator('.rule-inspector');expect(sheet).to_be_visible();expect(page.locator('#rule-panel-title')).to_be_visible()
        box=sheet.bounding_box();assert box['y']>844*.2,f'the rule sheet leaves the top in view ({box["y"]})'
        close=page.locator('.inspector-head [data-rule-panel-toggle]');expect(close).to_be_visible();close.tap();expect(sheet).to_have_count(0)
    finally:mobile.close()

# ADR-101: the author chooses the level in the source step; the built model carries it.
def author_level(page):
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click()
    page.locator('[data-author="level"]').select_option('intermediate');page.locator('#author-editor').fill(rules_source);page.locator('[data-author-apply]').click();current(page,'rules')
    rules_json(page);assert json.loads(page.locator('#model-editor').input_value()).get('level')=='intermediate'
    page.locator('[data-step="source"]').click();expect(page.locator('[data-author="level"]')).to_have_value('intermediate')

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
def source_check(page):
    """ADR-113: the Source step checks the reference under the chosen settings without making a model: findings
    with their line, the step's state, and a clean result in words; no model, so Rules stays locked."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click()
    page.locator('#author-editor').fill('function f() {\n  const a = b;\n  const b = 1;\n  return a;\n}')
    page.locator('[data-author-check]').click()
    findings=page.locator('[data-source-diagnostics]');expect(findings).to_contain_text('BS001');expect(findings).to_contain_text('Biztos hiba')
    expect(page.locator('[data-step="source"]')).to_contain_text('Hibás forrás');expect(page.locator('[data-step="rules"]')).to_be_disabled()
    page.locator('#author-editor').fill('function f() {\n  const b = 1;\n  const a = b;\n  return a;\n}');page.locator('[data-author-check]').click()
    expect(page.locator('.author-status')).to_contain_text('nem találtam hibát');expect(page.locator('[data-source-diagnostics]')).to_have_count(0)
    expect(page.locator('[data-step="rules"]')).to_be_disabled()
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
def split_and_full_screen_focus(page):
    """ADR-107: the separator moves the split by pointer and keyboard and is remembered; Focus fills the
    screen with no page or workspace scroll, also with the inspector and the feedback open."""
    build(page,rules_source);to_try(page);page.locator('[data-all]').click()
    split=page.locator('[data-pane-split]');pool=page.locator('#pool-pane');expect(split).to_have_attribute('aria-valuenow','40')
    box=split.bounding_box();page.mouse.move(box['x']+6,box['y']+60);page.mouse.down();page.mouse.move(box['x']+206,box['y']+60,steps=6);page.mouse.up()
    value=int(split.get_attribute('aria-valuenow'));assert 50<value<80,value
    split.focus();page.keyboard.press('ArrowLeft');expect(split).to_have_attribute('aria-valuenow',str(value-2));page.keyboard.press('Home');expect(split).to_have_attribute('aria-valuenow','20')
    width=pool.bounding_box()['width'];page.reload();current(page,'source');build(page,rules_source);to_try(page);expect(page.locator('[data-pane-split]')).to_have_attribute('aria-valuenow','20');assert abs(page.locator('#pool-pane').bounding_box()['width']-width)<3
    page.locator('[data-pane-split]').focus();page.keyboard.press('End')
    for _ in range(20):page.keyboard.press('ArrowLeft')
    expect(page.locator('[data-pane-split]')).to_have_attribute('aria-valuenow','40')
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
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(source)
    # The rule under test exists only while key order is observed (ADR-055); since ADR-106 a new draft ignores it.
    analysis_options(page);page.locator('[data-preflight="inputs"]').select_option('valid');page.locator('[data-preflight="keyOrder"]').select_option('observed');page.locator('[data-author-apply]').click();current(page,'rules')
    expect(page.locator('[data-ordering-policy]').first).not_to_contain_text('nem alkalmazható')
    to_try(page);page.locator('[data-all]').click();page.locator('[data-down="2"]').click();page.locator('[data-check]').click()
    expect(page.locator('.report')).to_contain_text('Hibás');cause=page.locator('.report [data-rule-cause="3-4"]')
    expect(cause).to_contain_text('új kulcsot hoz létre');expect(cause).to_contain_text('Policy-felülírás megerősítése')
    page.locator('[data-preview-toggle]').click();expect(page.locator('[data-rule-cause]')).to_have_count(0);page.locator('[data-preview-toggle]').click()
    page.locator('[data-check]').click();cause.locator('[data-rule-line="4"]').click()
    panel=page.locator('.try-rule-panel [data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','4')
    expect(panel.locator('[data-rule-pair="3-4"] .rule-meaning')).to_contain_text('felsorolja a kulcsokat')
    panel.locator('[data-rule-pair="3-4"] [data-rule-edit="remove"]').click();confirm=page.locator('[data-rule-confirm]')
    confirm.locator('[data-rule-note]').fill('A kulcsok sorrendje itt nem számít.');confirm.locator('[data-rule-edit="confirm"]').click()
    expect(page.locator('.rule-status')).to_contain_text('újraminősítve');page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.screenshot(path=str(ARTIFACTS/('ux-rule-cause-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
def key_order_and_rule_kinds(page):
    """ADR-055: with key order declared not to count, the swapped key writes are accepted without any
    rule edit and the model stays analysis-verified. ADR-056: with key order counting, lifting the
    rule kind in one confirmed step accepts it too, and the qualification honestly drops."""
    source='\n'.join(['class Box {','  constructor() {','    this.a = 1;','    this.b = 2;','  }','}','function evaluate() {',"  const list = Object['ke' + 'ys'];",'  return list(new Box());','}'])
    def make(key_order):
        page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(source)
        analysis_options(page);page.locator('[data-preflight="keyOrder"]').select_option(key_order);page.locator('[data-author-apply]').click();current(page,'rules')
    def swapped_verdict():
        to_try(page)
        if page.locator('[data-all]').count():page.locator('[data-all]').click()
        if page.locator('.solution-zone .code-row code').nth(2).text_content().strip()=='this.a = 1;':page.locator('[data-down="2"]').click()
        page.locator('[data-check]').click();return page.locator('.report')
    make('ignored');expect(page.locator('[data-analysis-settings]')).to_contain_text('nem számít');expect(page.locator('[data-step-verification]')).to_have_text('Elemzéssel igazolt')
    expect(swapped_verdict()).to_contain_text('Elfogadva')
    make('observed');expect(page.locator('[data-analysis-settings]')).to_contain_text('számít')
    kinds=page.locator('[data-rule-kinds]');kinds.locator('summary').click();kinds.locator('[data-rule-kind="object-write-after-write"]').click()
    kinds.locator('[data-rule-kind-note]').fill('A kulcsok sorrendje itt nem számít.');kinds.locator('[data-rule-kind-confirm]').click()
    expect(kinds.locator('.rule-status')).to_contain_text('1 szabály feloldva');expect(page.locator('[data-step-verification]')).to_have_text('Nem igazolt')
    expect(swapped_verdict()).to_contain_text('Elfogadva')
    page.screenshot(path=str(ARTIFACTS/('ux-key-order-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)
def class_fields_setting(page):
    """ADR-075: with both class-field modes (default) a base setter of the field name keeps the two fields
    in order; with standard [[Define]] fields only, the swap is accepted without any rule edit, the model
    stays analysis-verified and the rules step names the setting."""
    source='\n'.join(['class B {','  set f5(value) {',"    record('set', this.g);",'  }','}','class A extends B {','  f5 = 6;','  g = 7;','}','function evaluate() {','  const a = new A();','  return [a.g, a.f5];','}'])
    def make(class_fields):
        page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(source)
        analysis_options(page);page.locator('[data-preflight="classFields"]').select_option(class_fields);page.locator('[data-author-apply]').click();current(page,'rules')
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
    page.locator('[data-step="source"]').click();analysis_options(page);expect(page.locator('[data-preflight="classFields"]')).to_have_value('define')
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

try:
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception:time.sleep(.1)
    with sync_playwright() as p:
        browser=launch(p);context=browser.new_context(viewport={'width':1500,'height':1000},permissions=['clipboard-read','clipboard-write']);context.tracing.start(screenshots=True,snapshots=True,sources=True);page=context.new_page();page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        watch(context)
        try:
            for mode,url in [('node',BASE),('pages',f'http://127.0.0.1:{static.server_port}/developer-exercise/')]:
                for name,action in [('steps stay locked until a model exists',steps_locked_until_model),('preflight settings, locks and findings',preflight_ui),('one indentation in source, board and sorter',indentation_single_owner),('the source is checked without a model',source_check),('session v2 records the analysis settings; v1 is partial',session_settings),('model-first creation',model_first),('a rejected order names its rule and how to lift it',rule_cause_lifts),('key order setting and rule kinds',key_order_and_rule_kinds),('class-field mode setting',class_fields_setting),('source file pending then apply',source_file),('JSON file creation',json_file),('fixed position permits crossing peers',fixed_crossing),('learner preview isolation and roundtrip',learner),('keyboard tabs and draft preservation',keyboard_draft),('focus, details and contextual copy',continuity),('one author project beside practice; examples as starting points',reference_continuity),('rebuild and JSON apply refresh every later step',stale_rebuild_updates_every_step),('explicit legacy dependency refresh preserves screenshot arrangement',legacy_dependency_refresh),('delayed model/session File.text preserves newer reference',stale_file_import),('author rule panel edits, acknowledges and stays author-only',rule_panel),('pointer and keyboard connect lines into rules',rule_connect),('try sorter shows, redraws and edits rules while arranging',try_rules),('rule edits keep unapplied reference and JSON drafts',pending_reference_survives_rule_edit),('the input contract is chosen, recorded and restored',input_contract),('rule edits keep the sorter scroll position',rule_edit_keeps_scroll),('circles toggle links: checks, removal and exact restore',link_toggle),('pins fix and release a line on the board',pin_lines),('feedback marks graded rows, invalidates on a move and respects the learner view',learner_feedback)]:
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
            reset(page,BASE);case('node theme choice: system, light, dark, remembered before first paint',lambda:theme_choice(page))
            reset(page,BASE);case('node header and step menus open and close',lambda:menus(page))
            case('node forced dark browser keeps the chosen light theme white',lambda:forced_dark(p))
            reset(page,BASE);case('node editor stripes stay on their rows while scrolling',lambda:editor_stripes(page))
            reset(page,BASE);case('node focus mode: only the code workspace, largest surface, arrangement kept',lambda:focus_mode(page))
            case('node focus mode without the Fullscreen API: overlay, Escape leaves',lambda:focus_without_fullscreen_api(browser))
            reset(page,BASE);case('node two code views, remembered, with their row geometry',lambda:code_views(page))
            reset(page,BASE);case('node pane separator and full-screen focus without scroll',lambda:split_and_full_screen_focus(page))
            reset(page,BASE);case('node focus bar and the return to the full-screen page',lambda:focus_bar_and_full_screen_return(page))
            reset(page,BASE);case('node first gate: a definite language error stays on the source step',lambda:source_gate(page))
            reset(page,BASE);case('node second gate: stale source keeps the Try step closed',lambda:second_gate(page))
            reset(page,BASE);case('node duplicate-check prevention and async feedback',lambda:busy(page))
            reset(page,BASE);case('node admission preserves newer reference edits',lambda:stale_author_admission(page))
            reset(page,BASE);case('node sample loading preserves newer reference edits',lambda:stale_source_sample(page))
            for name,action in [('author format preserves newer edits',lambda:stale_format(page,True)),('solution format preserves newer edits',lambda:stale_format(page,False)),('stale check failure cannot replace newer attempt',lambda:stale_check_failure(page))]:
                reset(page,BASE);case('node '+name,action)
            for width in [320,390,768]:
                mobile=watch(browser.new_context(viewport={'width':width,'height':900},is_mobile=True,has_touch=True));target=mobile.new_page();target.on('pageerror',lambda error:errors.append(str(error)))
                try:
                    reset(target,BASE);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    practice(target);target.locator('[data-all]').click();assert target.evaluate('document.documentElement.scrollWidth')<=width
                    handle=target.locator('.solution-zone .drag-handle[tabindex="0"]').first;assert handle.bounding_box()['width']>=44 and handle.bounding_box()['height']>=44
                    target.locator('[data-mode="author"]').click();build(target,rules_source);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    connector=target.locator('[data-rule-connect="3"]').bounding_box();assert connector['width']>=28 and connector['height']>=28
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
