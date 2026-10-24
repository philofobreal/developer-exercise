# Real HTTP and subpath Pages matrix. Each case prints its own result.
import functools, json, os, socket, subprocess, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_support import ROOT, ARTIFACTS, launch

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port),'HOST':'127.0.0.1'},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
class Pages(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'_site'),**kwargs)
    def do_GET(self):
        if not self.path.startswith('/developer-exercise/'):
            self.send_error(404);return
        self.path=self.path[len('/developer-exercise'):];super().do_GET()
    def log_message(self,*args):pass
static=ThreadingHTTPServer(('127.0.0.1',0),Pages)
thread=threading.Thread(target=static.serve_forever,daemon=True);thread.start()
JS='function calc() {\n const a = 1;\n const b = 2;\n return a + b;\n}'
TS='function calc<T extends number>(a:T): number {\n const result: number = a + 1;\n return result;\n}'
count=0
def case(name,fn):
    global count
    try:fn()
    except Exception:
        page.screenshot(path=str(ARTIFACTS/'matrix-failure.png'));context.tracing.stop(path=str(ARTIFACTS/'matrix-failure-trace.zip'));raise
    count+=1;print('PASS matrix: '+name,flush=True)
def author(page,source=JS,language='javascript'):
    page.locator('[data-view="author"]').click()
    page.locator('[data-author="language"]').select_option(language)
    page.locator('#author-editor').fill(source)
    with page.expect_response(lambda r:'/api/author/compile' in r.url) as response:page.locator('[data-author-apply]').click()
    data=response.value.json();expect(page.locator('.solution-zone .code-row').first).to_be_visible();return data
def model(page):
    page.locator('[data-view="model"]').click();return json.loads(page.locator('#model-editor').input_value())
def apply_model(page,m):
    page.locator('#model-editor').fill(json.dumps(m));page.locator('[data-model-apply]').click();expect(page.locator('.solution-zone')).to_be_visible()
def values(page):return page.locator('.solution-zone .code-text code').all_text_contents()
def native(page,origin,target,y_ratio=.1):
    page.evaluate('''({origin,target,ratio})=>{
      const source=document.querySelector('.solution-zone .code-row[data-index="'+origin+'"]');
      const dest=document.querySelector('.solution-zone .code-row[data-index="'+target+'"]');
      const transfer=new DataTransfer(),rect=dest.getBoundingClientRect();
      source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));
      dest.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.top+rect.height*ratio}));
      if(!document.querySelector('.insert-caret'))throw Error('Missing insertion caret');
      dest.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:rect.top+rect.height*ratio}));
    }''',{'origin':origin,'target':target,'ratio':y_ratio})
try:
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception:time.sleep(.1)
    else:raise AssertionError('Node server failed to start')
    with sync_playwright() as p:
        browser=launch(p)
        context=browser.new_context(viewport={'width':1500,'height':1000},has_touch=True,permissions=['clipboard-read','clipboard-write'])
        context.tracing.start(screenshots=True,snapshots=True,sources=True)
        page=context.new_page();page.set_default_timeout(10000);errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(BASE);expect(page.locator('[data-task]').first).to_be_visible()
        def format_case(source,language):
            page.locator('[data-view="author"]').click();page.locator('[data-author="language"]').select_option(language);page.locator('#author-editor').fill(source)
            page.locator('[data-author-format]').click();expect(page.locator('.author-status')).to_contain_text('Formázva')
            formatted=page.locator('#author-editor').input_value();assert '\n' in formatted
            page.locator('[data-author-apply]').click();expect(page.locator('.solution-zone')).to_be_visible()
            page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
        case('JS formatting, generation and evaluation',lambda:format_case(JS,'javascript'))
        case('TS formatting, generation and evaluation',lambda:format_case(TS,'typescript'))
        def binding_witness(target,language):
            source='\nfunction calc() {\n const a = 1;\n const b = 2;\n const c = a + b;\n const spare = 9;\n return c + spare;\n}'
            target.locator('[data-view="author"]').click();target.locator('[data-author="language"]').select_option(language);target.locator('#author-editor').fill(source);target.locator('[data-author-apply]').click();expect(target.locator('.solution-zone')).to_be_visible()
            m=model(target);assert m['lines'][3]['dependencies']==[2,3];assert m['lines'][3]['sourceLine']==5
            target.locator('[data-dependency-table] summary').click();expect(target.locator('[data-reference-line="4"]')).to_contain_text('#2, #3')
            order=[1,3,2,5,4,6,7];by_id={line['id']:line['code'] for line in m['lines']}
            target.locator('[data-view="edit"]').click();target.locator('#code-editor').fill('\n'.join(by_id[i] for i in order));target.locator('[data-apply]').click();target.locator('[data-check]').click();expect(target.locator('.report')).to_contain_text('Elfogadva')
            target.locator('[data-validation-witness] summary').click();row=target.locator('[data-witness-position="5"]');expect(row).to_contain_text('#4');expect(row).to_contain_text('#2, #3');expect(row.locator('td').nth(2)).to_have_text('5')
            target.screenshot(path=str(ARTIFACTS/('dependencies-'+language+('-pages' if '/developer-exercise/' in target.url else '-node')+'.png')))
            target.locator('[data-view="edit"]').click();target.locator('#code-editor').fill('\n'.join(by_id[i] for i in [1,2,4,3,5,6,7]));target.locator('[data-apply]').click();target.locator('[data-check]').click();expect(target.locator('.report')).to_contain_text('Hibás');expect(target.locator('[data-validation-witness]')).to_have_count(0)
        case('JS binding dependencies, arbitrary gaps and evaluation witness',lambda:binding_witness(page,'javascript'))
        case('TS binding dependencies, arbitrary gaps and evaluation witness',lambda:binding_witness(page,'typescript'))
        def nested_witness(target,language):
            source='function evaluate() {\n const a = 10;\n const b = 20;\n {\n const note = "outer";\n const sum = a + b;\n {\n const x = sum + 1;\n const y = sum + 2;\n const z = x + y;\n const label = "inner";\n record(z, label);\n }\n record(sum, note);\n }\n return a + b;\n}'
            target.locator('[data-view="author"]').click();target.locator('[data-author="language"]').select_option(language);target.locator('#author-editor').fill(source);target.locator('[data-author-apply]').click();expect(target.locator('.solution-zone')).to_be_visible()
            m=model(target);assert m['lines'][9]['dependencies']==[8,9];assert len(m['blocks'])==3
            by_id={line['id']:line['code'] for line in m['lines']};order=[1,3,2,4,6,5,7,9,8,11,10,12,13,14,15,16,17]
            target.locator('[data-view="edit"]').click();target.locator('#code-editor').fill('\n'.join(by_id[i] for i in order));target.locator('[data-apply]').click();target.locator('[data-check]').click();expect(target.locator('.report')).to_contain_text('Elfogadva')
            target.locator('[data-validation-witness] summary').click();expect(target.locator('[data-witness-position="11"]')).to_contain_text('#8, #9')
            order.remove(10);order.insert(6,10)
            target.locator('[data-view="edit"]').click();target.locator('#code-editor').fill('\n'.join(by_id[i] for i in order));target.locator('[data-apply]').click();target.locator('[data-check]').click();expect(target.locator('.report')).to_contain_text('Hibás')
        case('JS three-level lexical ownership, ancestor bindings and scope escape',lambda:nested_witness(page,'javascript'))
        case('TS three-level lexical ownership, ancestor bindings and scope escape',lambda:nested_witness(page,'typescript'))


        def dependency():
            author(page);strict=model(page);strict['lines'][2]['dependencies']=[2];apply_model(page,strict)
            page.locator('[data-all]').click();page.locator('[data-up="2"]').click();before=values(page)
            page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Hibás')
            m=model(page);m['lines'][2]['dependencies']=[1];m['lines'][3]['dependencies']=[2,3];apply_model(page,m)
            expect(page.locator('.report')).to_contain_text('Elfogadva');assert values(page)==before
        case('dependency-only edits retain attempt and immediately reevaluate',dependency)
        def invalid_model():
            before=values(page);m=model(page);m['lines'][1]['code']='const a = ;'
            page.locator('#model-editor').fill(json.dumps(m));page.locator('[data-model-apply]').click();expect(page.locator('.author-status')).to_contain_text('Szintaktikai')
            page.locator('[data-view="sort"]').click();assert values(page)==before
        case('invalid edited reference is rejected atomically',invalid_model)
        def braces():
            author(page,'function calc() {\n if (true) {\n const a = 1;\n run(a);\n }\n done();\n}')
            page.locator('[data-all]').click();old=page.locator('.solution-zone .code-row').evaluate_all('(rows)=>rows.map(r=>r.dataset.lineId)')
            page.locator('[data-up="6"]').click();page.locator('[data-up="5"]').click();page.locator('[data-down="5"]').click()
            new=page.locator('.solution-zone .code-row').evaluate_all('(rows)=>rows.map(r=>r.dataset.lineId)');assert old[4]==new[6] and old[6]==new[4]
            page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
        case('identical closing brace IDs can swap without false rejection',braces)
        def insertion():
            author(page);page.locator('[data-all]').click();old=values(page);native(page,1,3,.1);new=values(page)
            assert [x.strip() for x in new]==[old[i].strip() for i in [0,2,1,3,4]]
        case('native insertion shifts intervening rows and shows marker',insertion)
        def keyboard():
            author(page);page.locator('[data-all]').click();old=values(page)
            handle=page.locator('.solution-zone .code-row[data-index="1"] .drag-handle');handle.focus();page.keyboard.press('Space');page.keyboard.press('End');page.keyboard.press('Enter')
            assert values(page)[-1].strip()==old[1].strip();expect(page.locator('[data-move-status]')).to_contain_text('Sor áthelyezve')
            assert page.locator('.solution-zone .code-row').last.locator('.drag-handle').evaluate('(x)=>x===document.activeElement')
            before=values(page);page.keyboard.press('Space');page.keyboard.press('Home');page.keyboard.press('Escape');assert values(page)==before
        case('keyboard insertion, focus, announcement and cancellation',keyboard)
        def pointer():
            author(page);page.locator('[data-all]').click();old=values(page)
            start=page.locator('.solution-zone .code-row[data-index="1"] .drag-handle').bounding_box();dest=page.locator('.solution-zone .code-row[data-index="4"] .gutter').bounding_box()
            page.mouse.move(start['x']+8,start['y']+12);page.mouse.down();page.mouse.move(dest['x']+6,dest['y']+22,steps=12);page.mouse.up()
            assert values(page)[-1].strip()==old[1].strip();assert sorted(x.strip() for x in values(page))==sorted(x.strip() for x in old)
        case('real mouse pointer insertion has no loss or duplication',pointer)
        def touch():
            author(page);page.locator('[data-all]').click();old=values(page)
            start=page.locator('.solution-zone .code-row[data-index="1"] .drag-handle').bounding_box();end=page.locator('.solution-zone .code-row[data-index="4"] .gutter').bounding_box()
            cdp=context.new_cdp_session(page);x=start['x']+8;y=start['y']+12;tx=end['x']+5;ty=end['y']+22
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
            for step in range(1,11):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+(tx-x)*step/10,'y':y+(ty-y)*step/10,'id':1}]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cdp.detach()
            expect(page.locator('.solution-zone .code-row').last.locator('code')).to_contain_text(old[1].strip())
        case('actual touch input uses the same insertion domain',touch)
        def pool_insert():
            author(page);start=page.locator('.source-zone .code-row').first.locator('.drag-handle').bounding_box();end=page.locator('.solution-zone .code-row').first.locator('.gutter').bounding_box()
            page.mouse.move(start['x']+8,start['y']+12);page.mouse.down();page.mouse.move(end['x']+5,end['y']+5,steps=10);page.mouse.up()
            expect(page.locator('.source-zone .code-row')).to_have_count(4);expect(page.locator('.solution-zone .code-row').first.locator('code')).to_have_text('function calc() {')
        case('pool insertion fills an empty solution position without replacing a token',pool_insert)
        def stale_report():
            author(page);page.locator('[data-all]').click()
            def delayed(route):
                response=route.fetch();page.locator('[data-up="2"]').click();route.fulfill(response=response)
            page.route('**/api/author/preview',delayed)
            try:
                page.locator('[data-check]').click();expect(page.locator('.solution-zone .code-row[data-index="1"] code')).to_contain_text('const b')
                page.wait_for_function('() => !document.querySelector(".report.accepted")')
            finally:page.unroute('**/api/author/preview',delayed)
        case('an evaluation response cannot overwrite feedback after a new move',stale_report)
        def fixed():
            author(page);m=model(page);m['lines'][0]['fixed']=True;m['lines'][-1]['fixed']=True;apply_model(page,m);page.locator('[data-all]').click()
            before=values(page);page.locator('[data-up="2"]').click();assert values(page)[0]==before[0] and values(page)[-1]==before[-1]
            assert page.locator('.solution-zone .code-row').first.get_attribute('draggable')=='false'
            page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('wrong\nconst a = 1;\nconst b = 2;\nreturn a+b;\n}');page.locator('[data-apply]').click();expect(page.locator('.note')).to_contain_text('Rögzített')
        case('fixed anchors survive movement and reject text changes',fixed)
        def incomplete(language):
            author(page,JS,language);page.locator('[data-view="edit"]').click();rows=['function calc<T>(a: T) {' if language=='typescript' else 'function calc() {','const re = /}/;','if (ok) {','run();','}']
            page.locator('#code-editor').fill('\n'.join(rows));page.locator('[data-apply]').click();expect(page.locator('.solution-zone')).to_be_visible()
            actual=values(page);assert len(actual)==5;assert [x.strip() for x in actual]==rows;assert actual[3].startswith('          ')
        case('incomplete invalid JS retains row count and live regex indentation',lambda:incomplete('javascript'))
        case('incomplete invalid TS retains row count and live regex indentation',lambda:incomplete('typescript'))
        def copy_fullscreen_styles():
            author(page);page.locator('[data-all]').click();page.locator('[data-copy-solution]').click();expect(page.locator('.note')).to_contain_text('másolva')
            assert 'return a + b' in page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')
            page.locator('[data-fullscreen]').click();page.wait_for_function('() => document.fullscreenElement===document.querySelector("#app") || document.querySelector("#app").classList.contains("ng-fullscreen")')
            page.locator('[data-fullscreen]').click();page.wait_for_function('() => !document.fullscreenElement && !document.querySelector("#app").classList.contains("ng-fullscreen")')
            assert abs(page.locator('#app').bounding_box()['width']-1500)<2
            colors=page.locator('.solution-zone .code-row').evaluate_all('(rows)=>rows.slice(0,2).map(r=>getComputedStyle(r).backgroundColor)');assert colors[0]!=colors[1]
            assert page.locator('.solution-zone .gutter span').all_text_contents()==['1','2','3','4','5']
            bg=page.locator('.solution-zone .token.operator').first.evaluate('(x)=>getComputedStyle(x).backgroundColor');assert bg=='rgba(0, 0, 0, 0)'
            page.locator('[data-view="author"]').click();expect(page.locator('.editor-gutter span').first).to_have_text('1')
        case('actual clipboard and fullscreen, full width, gutters and Prism colors',copy_fullscreen_styles)
        def clipboard_author():
            author(page);page.locator('[data-view="author"]').click();expected=page.locator('#author-editor').input_value();page.locator('[data-copy-author]').click();expect(page.locator('.author-status')).to_contain_text('másolva');assert page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')==expected,(repr(expected),repr(page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')))
            assert page.locator('[data-copy-author]').evaluate('(x)=>x===document.activeElement')
            source='function pasted() {\n const text = "<img src=x>";\n return text;\n}'
            page.evaluate('(x)=>navigator.clipboard.writeText(x)',source);page.locator('[data-paste-author]').click();expect(page.locator('#author-editor')).to_have_value(source);expect(page.locator('.author-status')).to_contain_text('még nincs alkalmazva')
        case('author clipboard copy/paste preserves text and waits for Apply',clipboard_author)
        def clipboard_model():
            author(page);m=model(page);page.locator('[data-copy-model]').click();expect(page.locator('.author-status')).to_contain_text('JSON másolva');assert json.loads(page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n'))==m
            m['lines'][2]['dependencies']=[1];value=json.dumps(m);page.evaluate('(x)=>navigator.clipboard.writeText(x)',value);page.locator('[data-paste-model]').click();expect(page.locator('#model-editor')).to_have_value(value);expect(page.locator('.author-status')).to_contain_text('Alkalmazás után')
        case('model JSON clipboard copy/paste does not silently activate rules',clipboard_model)
        def clipboard_editor():
            author(page);page.locator('[data-all]').click();old=values(page);page.locator('[data-view="edit"]').click();expected=page.locator('#code-editor').input_value();page.locator('[data-copy-editor]').click();expect(page.locator('.note')).to_contain_text('másolva');assert page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')==expected,(repr(expected),repr(page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')))
            page.evaluate('(x)=>navigator.clipboard.writeText(x)',JS);page.locator('[data-paste-editor]').click();expect(page.locator('#code-editor')).to_have_value(JS);page.locator('[data-view="sort"]').click();assert values(page)==old
        case('solution editor copy/paste leaves the active arrangement intact until Apply',clipboard_editor)
        def clipboard_sorter():
            author(page);page.locator('[data-all]').click();expected='\n'.join(values(page));page.locator('[data-copy-arrangement]').click();expect(page.locator('.note')).to_contain_text('másolva');assert page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')==expected,(repr(expected),repr(page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')))
            page.locator('[data-reset]').click();page.evaluate('(x)=>navigator.clipboard.writeText(x)',JS);page.locator('[data-paste-solution]').click();expect(page.locator('.note')).to_contain_text('Megoldás beillesztve');assert '\n'.join(values(page))==expected
            m=model(page);m['lines'][0]['fixed']=True;apply_model(page,m);page.locator('[data-all]').click();old=values(page);page.evaluate('(x)=>navigator.clipboard.writeText(x)',JS.replace('function calc() {','wrong'));page.locator('[data-paste-solution]').click();expect(page.locator('.note')).to_contain_text('Rögzített');assert values(page)==old
            page.locator('[data-reset]').click();pool=page.locator('.source-zone .code-text code').all_text_contents();page.locator('[data-copy-pool]').click();expect(page.locator('.note')).to_contain_text('másolva');assert page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')=='\n'.join(pool)
        case('sorter/pool clipboard buttons preserve rows and enforce fixed anchors',clipboard_sorter)
        def clipboard_denied():
            author(page);page.locator('[data-view="author"]').click();before=page.locator('#author-editor').input_value()
            page.evaluate("window.__clipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>{throw new DOMException('denied','NotAllowedError')}}});")
            try:
                page.locator('[data-paste-author]').click();expect(page.locator('.author-status')).to_contain_text('Ctrl+V');assert page.locator('#author-editor').input_value()==before
            finally:page.evaluate("if(window.__clipboardDescriptor)Object.defineProperty(navigator,'clipboard',window.__clipboardDescriptor);else delete navigator.clipboard;")
        case('clipboard permission denial preserves editor content and explains manual paste',clipboard_denied)
        def transfers():
            author(page);page.locator('[data-all]').click();before=values(page);m=model(page)
            with page.expect_download() as download:page.locator('[data-export-model]').click()
            exported=json.loads(Path(download.value.path()).read_text(encoding='utf-8'));assert exported['lines']==m['lines']
            page.locator('[data-view="author"]').click();page.locator('[data-model-file]').set_input_files({'name':'model.json','mimeType':'application/json','buffer':json.dumps(exported).encode()});expect(page.locator('.solution-zone')).to_be_visible();page.locator('[data-all]').click()
            with page.expect_download() as download:page.locator('[data-export-session]').click()
            session=json.loads(Path(download.value.path()).read_text(encoding='utf-8'));assert session['kind']=='ngdynamic-session'
            page.locator('[data-reset]').click();page.locator('[data-session-file]').set_input_files({'name':'session.json','mimeType':'application/json','buffer':json.dumps(session).encode()});expect(page.locator('.solution-zone .code-row').last.locator('code')).to_have_text('}')
            expect(page.locator('.solution-zone .code-text code')).to_have_text(before)
            assert values(page)==before  # Preserve exact whitespace after waiting for async admission.
            page.locator('[data-save-local]').click();page.reload();expect(page.locator('[data-task]').first).to_be_visible();page.locator('[data-load-local]').click();expect(page.locator('.solution-zone .code-row').last.locator('code')).to_have_text('}')
            # Both the initial exercise and imported preview end in "}"; await the full async restore.
            expect(page.locator('.solution-zone .code-text code')).to_have_text(before)
            assert values(page)==before
        case('model/session files and opt-in local save survive reload',transfers)
        def full_ts():
            page.locator('[data-view="author"]').click();page.locator('[data-author-sample]').click();expect(page.locator('#author-editor')).to_have_value(__import__('re').compile('CopyFieldUtilityService'))
            page.locator('[data-author-format]').click();expect(page.locator('.author-status')).to_contain_text('Formázva');page.locator('[data-author-apply]').click();expect(page.locator('.solution-zone .code-row')).to_have_count(436)
            page.locator('[data-all]').click();page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text('Elfogadva')
            m=model(page);assert len(m['blocks'])>20;assert len([x for x in m['lines'] if x['functionBlock']])>200
            page.locator('[data-view="sort"]').click();page.locator('.solution-zone').evaluate('(x)=>x.scrollTop=3000');saved=page.locator('.solution-zone').evaluate('(x)=>x.scrollTop');visible_index=page.locator('.solution-zone').evaluate('(zone)=>Math.floor(zone.scrollTop/zone.querySelector(".code-row").getBoundingClientRect().height)+3');page.locator(f'[data-down="{visible_index}"]').click();assert abs(page.locator('.solution-zone').evaluate('(x)=>x.scrollTop')-saved)<2
        case('full TS service, AST hierarchy and long-list scroll',full_ts)
        page.screenshot(path=str(ARTIFACTS/'matrix-node.png'))
        def pages():
            demo=context.new_page();assets=[];demo.on('response',lambda r:assets.append((r.url,r.status)))
            demo.on('pageerror',lambda error:errors.append(str(error)))
            prefix=f'http://127.0.0.1:{static.server_port}/developer-exercise/'
            demo.goto(prefix);expect(demo.locator('[data-task]').first).to_be_visible();expect(demo.locator('.mode-badge')).to_contain_text('Local Demo / Preview Validation')
            expect(demo.locator('.validation-notice')).to_contain_text('nem hitelesített')
            demo.locator('[data-all]').click();demo.locator('[data-check]').click();expect(demo.locator('.report')).to_contain_text('Elfogadva')
            demo.locator('[data-view="author"]').click();demo.locator('[data-author="language"]').select_option('typescript');demo.locator('#author-editor').fill(TS);demo.locator('[data-author-format]').click();expect(demo.locator('.author-status')).to_contain_text('Formázva');demo.locator('[data-author-apply]').click();expect(demo.locator('.solution-zone')).to_be_visible()
            demo.locator('[data-all]').click();demo.locator('[data-check]').click();expect(demo.locator('.report')).to_contain_text('Elfogadva')
            m=model(demo);m['lines'][1]['code']='const a = ;';demo.locator('#model-editor').fill(json.dumps(m));demo.locator('[data-model-apply]').click();expect(demo.locator('.author-status')).to_contain_text('Szintaktikai')
            assert all(status<400 for url,status in assets if url.startswith(prefix)),assets
            assert all(url.startswith(prefix) for url,status in assets),assets
            demo.screenshot(path=str(ARTIFACTS/'matrix-pages.png'));demo.close()
        case('real Pages HTTP subpath assets, TS authoring and syntax audit',pages)
        def pages_bindings(language):
            demo=context.new_page();demo.on('pageerror',lambda error:errors.append(str(error)))
            try:
                demo.goto(f'http://127.0.0.1:{static.server_port}/developer-exercise/');expect(demo.locator('[data-task]').first).to_be_visible();binding_witness(demo,language)
            finally:demo.close()
        case('Pages JS binding dependencies and evaluation witness',lambda:pages_bindings('javascript'))
        case('Pages TS binding dependencies and evaluation witness',lambda:pages_bindings('typescript'))
        def pages_nested(language):
            demo=context.new_page();demo.on('pageerror',lambda error:errors.append(str(error)))
            try:
                demo.goto(f'http://127.0.0.1:{static.server_port}/developer-exercise/');expect(demo.locator('[data-task]').first).to_be_visible();nested_witness(demo,language)
            finally:demo.close()
        case('Pages JS three-level scope and ancestor binding validation',lambda:pages_nested('javascript'))
        case('Pages TS three-level scope and ancestor binding validation',lambda:pages_nested('typescript'))
        def mobile():
            mobile_context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            try:
                mobile_page=mobile_context.new_page();mobile_page.goto(BASE);expect(mobile_page.locator('[data-task]').first).to_be_visible();mobile_page.locator('[data-all]').click()
                assert abs(mobile_page.locator('#app').bounding_box()['width']-390)<2
                handle=mobile_page.locator('.solution-zone .drag-handle[tabindex="0"]').first
                assert handle.bounding_box()['width']>=44 and handle.bounding_box()['height']>=44
                mobile_page.screenshot(path=str(ARTIFACTS/'matrix-mobile.png'))
            finally:mobile_context.close()
        case('mobile width and coarse-pointer touch target sizing',mobile)
        assert not errors,errors
        context.tracing.stop(path=str(ARTIFACTS/'matrix-trace.zip'));context.close();browser.close()
        print(f'PASS matrix total: {count} cases',flush=True)
finally:
    static.shutdown();static.server_close();proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
