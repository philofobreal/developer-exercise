"""Real browser drags on all shipped examples, in Node and static Pages mode.
Drags use real input; unrelated-pointer cancellation is explicit fault injection.
Native code-body drags exercise the
browser's pointercancel transition before dragover/drop.
"""
import json,os,socket,subprocess,threading,time,urllib.request
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
class Pages(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'_site'),**kwargs)
    def do_GET(self):
        if not self.path.startswith('/developer-exercise/'):
            self.send_error(404);return
        self.path=self.path[len('/developer-exercise'):];super().do_GET()
    def log_message(self,*args):pass
static=ThreadingHTTPServer(('127.0.0.1',0),Pages)
threading.Thread(target=static.serve_forever,daemon=True).start()
count=0

def identities(page,zone='solution'):
    return page.locator('.'+zone+'-zone .code-row').evaluate_all('(rows)=>rows.map(r=>r.dataset.lineId)')
def select(page,url,exercise,fill=False):
    page.goto(url);expect(page.locator('[data-task]').first).to_be_visible()
    page.locator('[data-task="'+exercise['id']+'"]').click()
    if fill:page.locator('[data-all]').click()
    page.evaluate("window.__drag=[];for(const type of ['dragstart','pointercancel','dragover','drop','dragend'])document.addEventListener(type,e=>window.__drag.push({type,prevented:e.defaultPrevented,caret:!!document.querySelector('.insert-caret')}));")
def rotated(exercise,before):
    indices=[i for i,line in enumerate(exercise['lines']) if not line['fixed']]
    movable=[before[i] for i in indices];expected=before[:]
    for i,value in zip(indices,movable[1:]+movable[:1]):expected[i]=value
    return expected

def pointer_drag(page,source,target,unrelated_cancel=False,fraction=.85):
    source.scroll_into_view_if_needed();start=source.bounding_box();end=target.bounding_box()
    page.mouse.move(start['x']+start['width']/2,start['y']+start['height']/2);page.mouse.down()
    page.mouse.move(end['x']+5,end['y']+end['height']*fraction,steps=12)
    expect(page.locator('.insert-caret')).to_have_count(1)
    if unrelated_cancel:
        page.locator('#app').dispatch_event('pointercancel',{'pointerId':987654,'pointerType':'touch','bubbles':True})
        expect(page.locator('.insert-caret')).to_have_count(1)
    page.mouse.up()

try:
    for _ in range(100):
        try:exercises=json.load(urllib.request.urlopen(BASE+'/api/exercises',timeout=.5))['exercises'];break
        except Exception:time.sleep(.1)
    else:raise AssertionError('Test server did not start')
    with sync_playwright() as p:
        browser=launch(p);context=browser.new_context(viewport={'width':1500,'height':1000})
        context.tracing.start(screenshots=True,snapshots=True,sources=True)
        page=context.new_page();page.set_default_timeout(8000);errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        try:
            for mode,url in [('node',BASE),('pages',f'http://127.0.0.1:{static.server_port}/developer-exercise/')]:
                for exercise in exercises:
                    for origin in ['pool','answer']:
                        for input_mode in ['native','pointer']:
                            select(page,url,exercise,fill=origin=='answer')
                            before=identities(page);pool=identities(page,'source')
                            if origin=='answer':
                                rows=page.locator('.solution-zone .code-row[draggable="true"]')
                                source_row=rows.first;target_row=rows.last;expected=rotated(exercise,before)
                            else:
                                source_row=page.locator('.source-zone .code-row').first
                                target_row=page.locator('.solution-zone .blank-row').first
                                expected=before[:];expected[int(target_row.get_attribute('data-index'))]=pool[0]
                            source=source_row.locator('.code-text' if input_mode=='native' else '.drag-handle');target=target_row.locator('.gutter')
                            if input_mode=='native':source.drag_to(target,target_position={'x':5,'y':target.bounding_box()['height']*(.15 if origin=='pool' else .85)})
                            else:pointer_drag(page,source,target,fraction=.15 if origin=='pool' else .85)
                            assert identities(page)==expected,(mode,exercise['id'],origin,input_mode,before,identities(page),expected,page.evaluate('window.__drag'))
                            assert identities(page,'source')==(pool[1:] if origin=='pool' else pool)
                            for i,line in enumerate(exercise['lines']):
                                if line['fixed']:assert identities(page)[i]==str(line['id'])
                            assert sorted(x for x in before+pool if x)==sorted(x for x in identities(page)+identities(page,'source') if x)
                            expect(page.locator('.insert-caret')).to_have_count(0)
                            if input_mode=='native':
                                events=page.evaluate('window.__drag')
                                assert any(e['type']=='drop' for e in events),events
                                assert any(e['type']=='dragover' and e['prevented'] and e['caret'] for e in events),events
                            count+=1;print(f'PASS drag: {mode} {exercise["id"]} {origin} {input_mode}',flush=True)
                exercise=exercises[0]
                select(page,url,exercise,fill=True);before=identities(page)
                rows=page.locator('.solution-zone .code-row[draggable="true"]')
                pointer_drag(page,rows.first.locator('.drag-handle'),rows.last.locator('.gutter'),unrelated_cancel=True)
                assert identities(page)==rotated(exercise,before)
                count+=1;print(f'PASS drag: {mode} unrelated pointercancel preserves owned mouse drag',flush=True)
                touch_context=browser.new_context(viewport={'width':1500,'height':1000},has_touch=True)
                try:
                    touch_page=touch_context.new_page();select(touch_page,url,exercise,fill=True);before=identities(touch_page)
                    rows=touch_page.locator('.solution-zone .code-row[draggable="true"]');start=rows.first.locator('.drag-handle').bounding_box();end=rows.last.locator('.gutter').bounding_box()
                    cdp=touch_context.new_cdp_session(touch_page);x=start['x']+start['width']/2;y=start['y']+start['height']/2
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':end['x']+5,'y':end['y']+end['height']*.85,'id':1}]})
                    expect(touch_page.locator('.insert-caret')).to_have_count(1)
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});cdp.detach()
                    expect(touch_page.locator('.insert-caret')).to_have_count(0);assert identities(touch_page)==before
                    rows=touch_page.locator('.solution-zone .code-row[draggable="true"]')
                    rows.first.locator('.code-text').drag_to(rows.last.locator('.gutter'),target_position={'x':5,'y':23})
                    assert identities(touch_page)==rotated(exercise,before)
                finally:touch_context.close()
                count+=1;print(f'PASS drag: {mode} actual touchcancel cancels only its own gesture; native dragging still works',flush=True)
            assert not errors,errors
            context.tracing.stop();print(f'PASS drag total: {count} cases',flush=True)
        except Exception:
            page.screenshot(path=str(ARTIFACTS/'drag-failure.png'))
            context.tracing.stop(path=str(ARTIFACTS/'drag-failure-trace.zip'));raise
        finally:context.close();browser.close()
finally:
    static.shutdown();static.server_close();proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
