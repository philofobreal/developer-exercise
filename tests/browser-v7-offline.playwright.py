"""Chromium UI integration without loopback navigation (restricted test runners).
It runs the *real* shipped ES modules through import maps; only HTTP responses
are stubbed. Server/model tests separately cover the real API and validation.
"""
import base64, json, os, posixpath, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_support import launch, ARTIFACTS
PUBLIC=Path(__file__).resolve().parent.parent/'public'
def import_map():
    items={}
    for p in sorted(PUBLIC.rglob('*.js')):
        if 'vendor' in p.parts:continue
        rel=p.relative_to(PUBLIC).as_posix()
        content=p.read_text(encoding='utf-8')
        def sub(m):
            key=posixpath.normpath(posixpath.join(posixpath.dirname(rel),m.group(2)))
            return m.group(1)+'app:/'+key+m.group(3)
        content=re.sub(r'(from\s*[\'\"])(\.{1,2}/[^\'\"]+)([\'\"])',sub,content)
        url='data:text/javascript;base64,'+base64.b64encode(content.encode()).decode()
        items['app:/'+rel]=url
    return {'imports':items}
small={'id':'small','title':'Small','description':'Preview','language':'javascript','revision':1,
       'lines':[{'id':i,'code':x,'fixed':False,'normalization':'indent'} for i,x in enumerate(['function f() {','const a = 1;','const b = 2;','return a + b;','}'],1)]}
large={'id':'large','title':'Large scrolling exercise','description':'220 elements','language':'typescript','revision':1,
       'lines':[{'id':i,'code':f'const value{i}: number = {i};','fixed':False,'normalization':'indent'} for i in range(1,221)]}
with sync_playwright() as p:
    browser=launch(p)
    page=browser.new_page(viewport={'width':1440,'height':900});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="app"></div></body></html>')
    page.add_style_tag(content=(PUBLIC/'vendor/prism.css').read_text(encoding='utf-8'))
    page.add_style_tag(content=(PUBLIC/'style.css').read_text(encoding='utf-8'))
    for script in ['prism-core.js','prism-clike.js','prism-javascript.js','prism-typescript.js']:
        page.add_script_tag(content=(PUBLIC/'vendor'/script).read_text(encoding='utf-8'))
    page.add_script_tag(content='''window.fetch = async (url,options) => {
      if(url === '/api/exercises')return {ok:true,json:async()=>({exercises:window.__fixture})};
      throw Error('Only initial GET is mocked for this UI-only test: '+url);
    };''')
    page.evaluate('(x)=>window.__fixture=x',[small,large])
    page.add_script_tag(type='importmap',content=json.dumps(import_map()))
    page.evaluate("() => import('app:/ui.js')")
    page.locator('[data-mode="practice"]').click(timeout=10000)
    page.locator('.solution-zone .code-row').first.wait_for(timeout=10000)
    assert page.locator('.solution-zone .code-row').count()==5
    assert abs(page.locator('#app').evaluate('(e)=>e.getBoundingClientRect().width')-1440)<2
    page.locator('[data-all]').click()
    assert page.locator('.solution-zone .code-row').count()==5
    # A-> before last: insertion shifts the two lines between; NOT a swap.
    page.evaluate('''() => {
      const first=document.querySelector('.solution-zone .code-row[data-index="1"]');
      const target=document.querySelector('.solution-zone .code-row[data-index="4"]');
      const tr=new DataTransfer();
      first.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:tr}));
      const r=target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:tr,clientY:r.top+3}));
      if(!document.querySelector('.insert-caret'))throw Error('No insertion indicator');
      target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:tr,clientY:r.top+3}));
    }''')
    values=page.locator('.solution-zone .code-text code').all_text_contents()
    assert 'const b' in values[1] and 'const a' in values[3],values
    assert page.locator('.insert-caret').count()==0
    page.locator('[data-task="large"]').click()
    page.locator('[data-all]').click()
    assert page.locator('.solution-zone .code-row').count()==220
    page.evaluate("document.querySelector('.solution-zone').scrollTop=3100")
    before=page.evaluate("document.querySelector('.solution-zone').scrollTop")
    page.evaluate('''() => {
      const first=document.querySelector('.solution-zone .code-row[data-index="105"]');
      const target=document.querySelector('.solution-zone .code-row[data-index="108"]');
      const tr=new DataTransfer();
      first.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:tr}));
      const z=target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:tr,clientY:z.top+5}));
    }''')
    after=page.evaluate("document.querySelector('.solution-zone').scrollTop")
    assert before>1000 and abs(after-before)<2,(before,after)
    assert page.locator('[data-fullscreen]').count()==1
    assert not errors,errors
    bg=page.locator('.solution-zone .token.operator').first.evaluate('(el)=>getComputedStyle(el).backgroundColor')
    assert bg in ('rgba(0, 0, 0, 0)','transparent'),bg
    print('PASS Chromium offline ES-module UI: full width, true insertion DnD, visible insertion caret, no swapping, 220-row scroll, operators, fullscreen, no JS errors')
    page.screenshot(path=str(ARTIFACTS/'offline.png'),full_page=False)
    browser.close()
