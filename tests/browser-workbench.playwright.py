"""Real authoring/learner workflows on Node and Pages, with keyboard and mobile QA.
ADR-022: two modes (author steps Forrás → Szabályok → Próba, practice), one active step,
explicit staleness; every transition below checks which model the next view starts from."""
import json,os,re,socket,subprocess,threading,time,urllib.request
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch,StaticServer
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
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
def current(page,step):expect(page.locator(f'[data-step="{step}"]')).to_have_attribute('aria-current','step')
def build(page,text):
    """Forrás → Modell készítése: the flow continues on the rules step."""
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="code"]').click();page.locator('#author-editor').fill(text);page.locator('[data-author-apply]').click();current(page,'rules')
def json_model(page,value):
    page.locator('[data-step="source"]').click();page.locator('[data-source-kind="json"]').click();expect(page.locator('[data-import-model]')).to_be_visible()
    page.locator('#model-editor').fill(json.dumps(value));expect(page.locator('[data-model-status]')).to_contain_text('Nem alkalmazott JSON');page.locator('[data-model-apply]').click();current(page,'rules')
def to_try(page):page.locator('[data-step="try"]').click();current(page,'try');expect(page.locator('.solution-zone')).to_be_visible()
def rules_json(page):page.locator('[data-step="rules"]').click();page.locator('[data-rules-view="json"]').click();expect(page.locator('#model-editor')).to_be_visible()
def practice(page):page.locator('[data-mode="practice"]').click();expect(page.locator('[data-task]').first).to_be_visible()

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
    with page.expect_file_chooser() as chooser:page.locator('[data-import-source]').click()
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
    page.locator('[data-start-example]').select_option(second);page.locator('[data-start-load]').click();expect(page.locator('#author-editor')).to_have_value('\n'.join(l['code'] for l in examples[second]['lines']))
    expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott referencia');expect(page.locator('[data-step="source"] .dirty-dot')).to_have_count(1)
    page.locator('[data-step="rules"]').click();expect(page.locator('[data-stale-notice]')).to_contain_text('referenciaforrás');expect(page.locator('[data-step="try"]')).to_contain_text('Elavult')
    page.locator('[data-stale-notice] [data-author-revert]').click();expect(page.locator('[data-stale-notice]')).to_have_count(0)
    page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.screenshot(path=str(ARTIFACTS/'ux-reference-workspace.png'),full_page=True)
def stale_rebuild_updates_every_step(page):
    """Regenerating from a changed source refreshes rules, JSON and try; nothing keeps the old model."""
    build(page,rules_source);to_try(page);page.locator('[data-all]').click()
    page.locator('[data-step="source"]').click();page.locator('#author-editor').fill(rules_source.replace('  g(b, c);\n','  g(b, c);\n  h(c);\n'))
    page.locator('[data-step="try"]').click();expect(page.locator('[data-stale-notice]')).to_contain_text('referenciaforrás');expect(page.locator('.solution-zone .code-row')).to_have_count(6)
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
    assert after['authoring']['dependencyPolicy']=='scoped-effect-analysis-v17'
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
    rules_json(page);edited=json.loads(page.locator('#model-editor').input_value());[relaxed]=edited['authoring']['relaxations'];removed=relaxed.pop('removed');assert relaxed=={'before':3,'after':5,'editability':'proven','note':'Didaktikai döntés'},relaxed;assert removed['origins']==['dependency'] and removed['reasons'],removed
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
    page.locator('[data-step="source"]').click();page.locator('[data-author="language"]').select_option('typescript');expect(page.locator('[data-author="importEmit"]')).to_have_value('verbatim')
    unapplied='function f() {\n  const unapplied = 1;\n}'
    page.locator('#author-editor').fill(unapplied);page.locator('[data-step="rules"]').click();expect(page.locator('[data-stale-notice]')).to_be_visible()
    page.locator('.board-row').first.locator('[data-rule-line]').click();page.locator('[data-rule-edit="fixed"]').click()
    expect(page.locator('[data-rule-panel] .rule-status')).to_contain_text('érvényes');expect(page.locator('[data-stale-notice]')).to_be_visible()
    page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_have_value(unapplied);expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott')
    # An unapplied JSON draft is never overwritten by a rule edit.
    rules_json(page);page.locator('#model-editor').fill('{unapplied JSON');page.locator('[data-rules-view="visual"]').click()
    page.locator('[data-rule-edit="fixed"]').click();expect(page.locator('[data-rule-panel] .rule-status')).to_contain_text('nem alkalmazott JSON')
    page.locator('[data-rules-view="json"]').click();expect(page.locator('#model-editor')).to_have_value('{unapplied JSON')

def try_rules(page):
    """ADR-022: the try sorter shows and edits rules while arranging; learners and practice never see them."""
    build(page,rules_source);to_try(page);expect(page.locator('[data-try-rules]')).to_be_visible()
    expect(page.locator('.source-zone .code-row[data-line-id="3"] [data-rule-line]')).to_have_count(1)
    page.locator('[data-all]').click()
    page.locator('.solution-zone .code-row[data-line-id="4"] [data-rule-line]').click()
    panel=page.locator('.try-rule-panel [data-rule-panel]');expect(panel).to_have_attribute('data-rule-panel-line','4')
    expect(page.locator('.solution-zone .code-row[data-line-id="2"]')).to_have_class(re.compile('rule-before'));expect(page.locator('.solution-zone .code-row[data-line-id="5"]')).to_have_class(re.compile('rule-after'))
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
def rule_edit_keeps_scroll(page):
    """A rule edit yields a new draft id, but it is the same project: the sorter keeps its scroll like after a drag."""
    source='\n'.join(['function f() {',*[f'  const v{i} = {i};' for i in range(38)],'  g(v0, v37);','}'])
    build(page,source);to_try(page);page.locator('[data-all]').click()
    zone=page.locator('.solution-zone');zone.evaluate('z=>{z.scrollTop=z.scrollHeight}');top=zone.evaluate('z=>z.scrollTop');assert top>200,top
    page.locator('.solution-zone .code-row[data-line-id="40"] [data-rule-line]').click()
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
    drag(3,4);expect(page.locator('.try-rule-panel [data-rule-panel] [data-rule-pair="3-4"] .rule-badge')).to_have_text('Szerzői')
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
        page.locator('[data-author-sample]').click();expect(page.locator('[data-author-sample]')).to_be_disabled()
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
        try:
            for mode,url in [('node',BASE),('pages',f'http://127.0.0.1:{static.server_port}/developer-exercise/')]:
                for name,action in [('steps stay locked until a model exists',steps_locked_until_model),('model-first creation',model_first),('source file pending then apply',source_file),('JSON file creation',json_file),('fixed position permits crossing peers',fixed_crossing),('learner preview isolation and roundtrip',learner),('keyboard tabs and draft preservation',keyboard_draft),('focus, details and contextual copy',continuity),('one author project beside practice; examples as starting points',reference_continuity),('rebuild and JSON apply refresh every later step',stale_rebuild_updates_every_step),('explicit legacy dependency refresh preserves screenshot arrangement',legacy_dependency_refresh),('delayed model/session File.text preserves newer reference',stale_file_import),('author rule panel edits, acknowledges and stays author-only',rule_panel),('pointer and keyboard connect lines into rules',rule_connect),('try sorter shows, redraws and edits rules while arranging',try_rules),('rule edits keep unapplied reference and JSON drafts',pending_reference_survives_rule_edit),('rule edits keep the sorter scroll position',rule_edit_keeps_scroll),('circles toggle links: checks, removal and exact restore',link_toggle),('pins fix and release a line on the board',pin_lines),('feedback marks graded rows, invalidates on a move and respects the learner view',learner_feedback)]:
                    reset(page,url);case(mode+' '+name,lambda:action(page))
                reset(page,url);page.screenshot(path=str(ARTIFACTS/('ux-'+mode+'-author.png')),full_page=True)
                practice(page);page.screenshot(path=str(ARTIFACTS/('ux-'+mode+'-practice.png')),full_page=True)
            reset(page,BASE);case('node duplicate-check prevention and async feedback',lambda:busy(page))
            reset(page,BASE);case('node admission preserves newer reference edits',lambda:stale_author_admission(page))
            reset(page,BASE);case('node sample loading preserves newer reference edits',lambda:stale_source_sample(page))
            for name,action in [('author format preserves newer edits',lambda:stale_format(page,True)),('solution format preserves newer edits',lambda:stale_format(page,False)),('stale check failure cannot replace newer attempt',lambda:stale_check_failure(page))]:
                reset(page,BASE);case('node '+name,action)
            for width in [320,390,768]:
                mobile=browser.new_context(viewport={'width':width,'height':900},is_mobile=True,has_touch=True);target=mobile.new_page();target.on('pageerror',lambda error:errors.append(str(error)))
                try:
                    reset(target,BASE);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    practice(target);target.locator('[data-all]').click();assert target.evaluate('document.documentElement.scrollWidth')<=width
                    handle=target.locator('.solution-zone .drag-handle[tabindex="0"]').first;assert handle.bounding_box()['width']>=44 and handle.bounding_box()['height']>=44
                    target.locator('[data-mode="author"]').click();build(target,rules_source);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    connector=target.locator('[data-rule-connect="3"]').bounding_box();assert connector['width']>=28 and connector['height']>=28
                    target.screenshot(path=str(ARTIFACTS/f'ux-mobile-{width}.png'),full_page=True);count+=1;print(f'PASS workbench: {width}px touch practice and author layout',flush=True)
                finally:mobile.close()
            assert not errors,errors;context.tracing.stop(path=str(ARTIFACTS/'workbench-trace.zip'));print(f'PASS workbench total: {count} cases',flush=True)
        except Exception:
            page.screenshot(path=str(ARTIFACTS/'workbench-failure.png'),full_page=True);context.tracing.stop(path=str(ARTIFACTS/'workbench-failure-trace.zip'));raise
        finally:context.close();browser.close()
finally:
    static.shutdown();static.server_close();proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
