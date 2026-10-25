"""Real authoring/learner workflows on Node and Pages, with keyboard and mobile QA."""
import json,os,socket,subprocess,threading,time,urllib.request
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
class Pages(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'_site'),**kwargs)
    def do_GET(self):
        if not self.path.startswith('/developer-exercise/'):self.send_error(404);return
        self.path=self.path[len('/developer-exercise'):];super().do_GET()
    def log_message(self,*args):pass
static=ThreadingHTTPServer(('127.0.0.1',0),Pages);threading.Thread(target=static.serve_forever,daemon=True).start()
model=json.loads((ROOT/'docs/evaluate-ordering.generated.json').read_text(encoding='utf-8'))
source='function typed() {\n const a: number = 10;\n const b: number = 20;\n return a + b;\n}'
count=0

def case(name,action):
    global count
    action();count+=1;print('PASS workbench: '+name,flush=True)
def reset(page,url):page.goto(url);expect(page.locator('[data-task]').first).to_be_visible()
def model_first(page):
    page.locator('[data-view="model"]').click();expect(page.locator('#model-editor')).to_be_visible();expect(page.locator('[data-import-model]')).to_be_visible()
    page.locator('#model-editor').fill(json.dumps(model));expect(page.locator('[data-model-status]')).to_contain_text('Nem alkalmazott JSON');page.locator('[data-model-apply]').click();expect(page.locator('.solution-zone .code-row')).to_have_count(7)
    page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
def source_file(page):
    before=page.locator('.task.selected').get_attribute('data-task');page.locator('[data-view="author"]').click()
    with page.expect_file_chooser() as chooser:page.locator('[data-import-source]').click()
    chooser.value.set_files({'name':'typed.ts','mimeType':'text/plain','buffer':source.encode()})
    expect(page.locator('#author-editor')).to_have_value(source);expect(page.locator('[data-author="language"]')).to_have_value('typescript');expect(page.locator('.author-status')).to_contain_text('még nincs alkalmazva')
    assert page.locator('.task.selected').get_attribute('data-task')==before
    page.locator('[data-author-apply]').click();expect(page.locator('.solution-zone .code-row')).to_have_count(5)
    page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.locator('[data-view="model"]').click();generated=json.loads(page.locator('#model-editor').input_value());assert generated['language']=='typescript';assert '\n'.join(line['code'] for line in generated['lines'])==source
def json_file(page):
    page.locator('[data-view="model"]').click()
    with page.expect_file_chooser() as chooser:page.locator('[data-import-model]').click()
    chooser.value.set_files({'name':'exercise.json','mimeType':'application/json','buffer':json.dumps(model).encode()})
    expect(page.locator('.solution-zone .code-row')).to_have_count(7);expect(page.locator('.task.selected')).to_contain_text('evaluate')
    page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value('\n'.join(line['code'] for line in model['lines']))
def fixed_crossing(page):
    fixed_model={'schemaVersion':2,'id':'fixed-only','revision':1,'language':'javascript','title':'Fixed slots','description':'','blocks':[],'lines':[{'id':i,'code':f'const v{i} = {i};','dependencies':[],'fixed':i==3,'functionBlock':0,'scopeId':None} for i in range(1,6)]}
    page.locator('[data-view="model"]').click();page.locator('#model-editor').fill(json.dumps(fixed_model));page.locator('[data-model-apply]').click();expect(page.locator('.solution-zone .code-row')).to_have_count(5)
    page.locator('[data-all]').click();page.locator('[data-down="1"]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    assert page.locator('.solution-zone .code-row').nth(2).get_attribute('data-line-id')=='3'
    assert [row.get_attribute('data-line-id') for row in page.locator('.solution-zone .code-row').all()]==['1','4','3','2','5']

def learner(page):
    model_first(page);page.locator('[data-view="model"]').click();draft=page.locator('#model-editor').input_value();page.locator('[data-preview-toggle]').click()
    expect(page.locator('#app')).to_have_class('learner-preview');expect(page.locator('[data-view="author"]')).to_have_count(0);expect(page.locator('[data-view="model"]')).to_have_count(0);expect(page.locator('[data-all]')).to_have_count(0);expect(page.locator('.library')).to_have_count(0);expect(page.locator('[data-save-local]')).to_have_count(0)
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva');expect(page.locator('[data-arrangement-progress]')).to_have_attribute('value','7')
    # Internal token witnesses and author dependency IDs are not learner-facing tools.
    expect(page.locator('[data-validation-witness]')).to_have_count(0);expect(page.locator('.technical-details')).to_have_count(0)
    page.screenshot(path=str(ARTIFACTS/'ux-learner.png'),full_page=True)
    page.locator('[data-preview-toggle]').click();expect(page.locator('#model-editor')).to_have_value(draft);expect(page.locator('[data-preview-toggle]')).to_be_focused()
def keyboard_draft(page):
    model_first(page);page.locator('[data-view="sort"]').focus();page.keyboard.press('ArrowRight');expect(page.locator('[data-view="edit"]')).to_be_focused();expect(page.locator('[data-view="sort"]')).to_have_attribute('aria-selected','true');page.keyboard.press('Enter')
    expect(page.locator('[data-view="edit"]')).to_have_attribute('aria-selected','true');expect(page.locator('[data-check]')).to_have_count(0);page.locator('#code-editor').fill('unfinished local draft');expect(page.locator('[data-editor-status]')).to_contain_text('Nem alkalmazott változat');expect(page.locator('[data-view="edit"] .dirty-dot')).to_have_count(1)
    page.locator('[data-view="author"]').click();page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_have_value('unfinished local draft')
    page.locator('[data-view="sort"]').click();page.locator('[data-down="2"]').click();page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_have_value('unfinished local draft');expect(page.locator('.draft-notice')).to_contain_text('rendező')
    page.screenshot(path=str(ARTIFACTS/'ux-editor.png'),full_page=True)
def continuity(page):
    model_first(page);page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.locator('.workspace-help summary').click();page.locator('[data-copy-solution]').click();expect(page.locator('.workspace-help')).to_have_attribute('open','');expect(page.locator('[data-copy-solution]')).to_be_focused()
    assert page.locator('[data-copy-solution]').count()==1 and page.locator('[data-copy-arrangement]').count()==1
    page.locator('[data-view="model"]').click();page.locator('[data-dependency-table] summary').click();page.screenshot(path=str(ARTIFACTS/'ux-model.png'),full_page=True)

def reference_continuity(page):
    tasks=page.locator('[data-task]');first=tasks.nth(0).get_attribute('data-task');second=tasks.nth(1).get_attribute('data-task')
    examples={m['id']:m for m in [json.loads(f.read_text(encoding='utf-8')) for f in (ROOT/'examples').glob('*.json')]}
    page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value('\n'.join(l['code'] for l in examples[first]['lines']))
    expect(page.locator('h1')).to_contain_text(examples[first]['title'])
    draft='function changedDraft() {\n     return 21;\n}'
    page.locator('#author-editor').fill(draft);expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott referencia')
    page.locator('[data-view="sort"]').click();expect(page.locator('[data-view="author"] .dirty-dot')).to_have_count(1)
    page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.locator('[data-view="model"]').click();page.locator('#model-editor').fill('{unfinished JSON')
    page.locator(f'[data-task="{second}"]').click();page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value('\n'.join(l['code'] for l in examples[second]['lines']))
    page.locator('#author-editor').fill('second unfinished draft')
    page.locator(f'[data-task="{first}"]').click();page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.locator('[data-view="model"]').click();expect(page.locator('#model-editor')).to_have_value('{unfinished JSON')
    page.locator('[data-view="author"]').click();page.locator('[data-author-apply]').click();expect(page.locator('.solution-zone .code-row')).to_have_count(3)
    page.locator('[data-all]').click();page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('incorrect answer draft')
    page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.locator('[data-view="edit"]').click();expect(page.locator('#code-editor')).to_have_value('incorrect answer draft')
    page.locator('[data-editor-reload]').click();assert 'changedDraft' in page.locator('#code-editor').input_value();expect(page.locator('[data-editor-status]')).to_contain_text('rendező aktuális')
    page.locator('[data-apply]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value(draft)
    page.screenshot(path=str(ARTIFACTS/'ux-reference-workspace.png'),full_page=True)

def stale_author_admission(page):
    page.locator('[data-view="author"]').click();pending=[]
    def intercept(route):pending.append(route)
    page.route('**/api/author/compile',intercept)
    try:
        for edit_kind in ['source','model']:
            active=page.locator('.task.selected').get_attribute('data-task')
            page.locator('#author-editor').fill('const submitted = 1;');page.locator('[data-author-apply]').click();expect(page.locator('[data-author-apply]')).to_be_disabled()
            newer='const newer = 2;'
            if edit_kind=='source':page.locator('#author-editor').fill(newer)
            else:page.locator('[data-view="model"]').click();page.locator('#model-editor').fill('{new unfinished JSON')
            route=pending.pop();route.fulfill(response=route.fetch())
            if edit_kind=='source':expect(page.locator('[data-author-apply]')).to_be_enabled();expect(page.locator('#author-editor')).to_have_value(newer)
            else:
                expect(page.locator('#model-editor')).to_have_value('{new unfinished JSON');assert page.locator('.task.selected').get_attribute('data-task')==active
                page.locator('[data-view="author"]').click();expect(page.locator('#author-editor')).to_have_value('const submitted = 1;')
            expect(page.locator('[data-author-status]')).to_contain_text('Nem alkalmazott referencia')
    finally:page.unroute('**/api/author/compile',intercept)

def legacy_dependency_refresh(page):
    legacy=json.loads((ROOT/'tests/fixtures/evaluate-legacy-serial.model.json').read_text(encoding='utf-8'))
    page.locator('[data-view="model"]').click();page.locator('#model-editor').fill(json.dumps(legacy));page.locator('[data-model-apply]').click()
    expect(page.locator('.solution-zone .code-row')).to_have_count(7)
    order=[1,3,5,2,4,6,7];codes={line['id']:line['code'] for line in legacy['lines']}
    page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('\n'.join(codes[i] for i in order));page.locator('[data-apply]').click()
    page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Hibás')
    page.locator('[data-view="model"]').click();expect(page.locator('[data-dependency-refresh]')).to_contain_text('Régebbi generált modell')
    before=json.loads(page.locator('#model-editor').input_value());assert [l['dependencies'] for l in before['lines']]==[l['dependencies'] for l in legacy['lines']]
    page.locator('[data-model-refresh]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
    assert [int(row.get_attribute('data-line-id')) for row in page.locator('.solution-zone .code-row').all()]==order
    page.locator('[data-view="model"]').click();after=json.loads(page.locator('#model-editor').input_value())
    assert [l['dependencies'] for l in after['lines']]==[[],[1],[1],[2,3],[1],[4,5],[6]]
    assert [(l['id'],l['code'],l['fixed']) for l in after['lines']]==[(l['id'],l['code'],l['fixed']) for l in legacy['lines']]
    assert after['authoring']['dependencyPolicy']=='scoped-effect-analysis-v4'
    page.screenshot(path=str(ARTIFACTS/('ux-legacy-dependency-refresh-'+('node' if page.url.startswith(BASE) else 'pages')+'.png')),full_page=True)

def stale_file_import(page):
    # Hold the actual File.text promise, before either API adapter can start admission.
    for kind in ('model','session'):
        active=page.locator('.task.selected').get_attribute('data-task')
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
            page.locator('[data-view="author"]').click();newer=f'const keepNewer_{kind} = 42;';page.locator('#author-editor').fill(newer)
            page.evaluate('''async () => {await finishReviewFile();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}''')
            expect(page.locator('#author-editor')).to_have_value(newer);assert page.locator('.task.selected').get_attribute('data-task')==active
        finally:page.evaluate('() => {File.prototype.text=originalFileText;delete globalThis.finishReviewFile;}')

def stale_source_sample(page):
    page.locator('[data-view="author"]').click();pending=[]
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
    if author:
        page.locator('[data-view="author"]').click();selector='#author-editor';action='[data-author-format]'
    else:
        page.locator('[data-all]').click();page.locator('[data-view="edit"]').click();selector='#code-editor';action='[data-format]'
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
    page.locator('[data-all]').click();pending=[]
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
                for name,action in [('model-first creation',model_first),('source file pending then apply',source_file),('JSON file creation',json_file),('fixed position permits crossing peers',fixed_crossing),('learner preview isolation and roundtrip',learner),('keyboard tabs and draft preservation',keyboard_draft),('focus, details and contextual copy',continuity),('reference and solution draft continuity',reference_continuity),('explicit legacy dependency refresh preserves screenshot arrangement',legacy_dependency_refresh),('delayed model/session File.text preserves newer reference',stale_file_import)]:
                    reset(page,url);case(mode+' '+name,lambda:action(page))
                reset(page,url);page.screenshot(path=str(ARTIFACTS/('ux-'+mode+'-workspace.png')),full_page=True)
                page.locator('[data-view="author"]').click();page.screenshot(path=str(ARTIFACTS/('ux-'+mode+'-author.png')),full_page=True)
            reset(page,BASE);case('node duplicate-check prevention and async feedback',lambda:busy(page))
            reset(page,BASE);case('node admission preserves newer reference edits',lambda:stale_author_admission(page))
            reset(page,BASE);case('node sample loading preserves newer reference edits',lambda:stale_source_sample(page))
            for name,action in [('author format preserves newer edits',lambda:stale_format(page,True)),('solution format preserves newer edits',lambda:stale_format(page,False)),('stale check failure cannot replace newer attempt',lambda:stale_check_failure(page))]:
                reset(page,BASE);case('node '+name,action)
            for width in [320,390,768]:
                mobile=browser.new_context(viewport={'width':width,'height':900},is_mobile=True,has_touch=True);target=mobile.new_page();target.on('pageerror',lambda error:errors.append(str(error)))
                try:
                    reset(target,BASE);target.locator('[data-all]').click();assert target.evaluate('document.documentElement.scrollWidth')<=width
                    handle=target.locator('.solution-zone .drag-handle[tabindex="0"]').first;assert handle.bounding_box()['width']>=44 and handle.bounding_box()['height']>=44
                    target.locator('[data-preview-toggle]').click();expect(target.locator('[data-view="author"]')).to_have_count(0);assert target.evaluate('document.documentElement.scrollWidth')<=width
                    target.screenshot(path=str(ARTIFACTS/f'ux-mobile-{width}.png'),full_page=True);count+=1;print(f'PASS workbench: {width}px touch learner layout',flush=True)
                finally:mobile.close()
            assert not errors,errors;context.tracing.stop(path=str(ARTIFACTS/'workbench-trace.zip'));print(f'PASS workbench total: {count} cases',flush=True)
        except Exception:
            page.screenshot(path=str(ARTIFACTS/'workbench-failure.png'),full_page=True);context.tracing.stop(path=str(ARTIFACTS/'workbench-failure-trace.zip'));raise
        finally:context.close();browser.close()
finally:
    static.shutdown();static.server_close();proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
