"""Public TS fixture matrix and screenshot workflow on real Node / Pages subpath."""
import json, os, socket, subprocess, threading, time, urllib.request
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect
from browser_support import ROOT, ARTIFACTS, launch, StaticServer

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
process=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
class Pages(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'_site'),**kwargs)
    def do_GET(self):
        if not self.path.startswith('/developer-exercise/'): self.send_error(404); return
        self.path=self.path[len('/developer-exercise'):]; super().do_GET()
    def log_message(self,*args): pass
static=StaticServer(('127.0.0.1',0),Pages)
threading.Thread(target=static.serve_forever,daemon=True).start()
results={}
try:
    for _ in range(100):
        try: urllib.request.urlopen(BASE+'/api/exercises',timeout=.5); break
        except Exception: time.sleep(.1)
    with sync_playwright() as p:
        browser=launch(p)
        try:
            for mode,url in [('node',BASE),('pages',f'http://127.0.0.1:{static.server_port}/developer-exercise/')]:
                context=browser.new_context(viewport={'width':1500,'height':1000})
                page=context.new_page(); errors=[]; page.on('pageerror',lambda error: errors.append(str(error)))
                try:
                    page.goto(url); expect(page.locator('[data-task]').first).to_be_visible()
                    matrix=page.evaluate('''async () => {
                        const api=await import('./app/api.js');
                        const read=async path=>{const r=await fetch(new URL(path,location.href));if(!r.ok)throw Error('Missing '+path);return r;};
                        const suite=await (await read('./samples/typescript/suite.json')).json();
                        let posts=0,checks=0;
                        for(const item of suite){
                            const prefix='./samples/typescript/'+item.id;
                            const source=await (await read(prefix+'.ts')).text(),expected=await (await read(prefix+'.model.json')).json();
                            const draft=await api.compileDraft(item.authored?{model:expected}:{source,language:'typescript',title:item.title,description:item.description});posts++;
                            for(const field of ['lines','blocks','edges','profiles','authoring'])if(JSON.stringify(draft.model[field])!==JSON.stringify(expected[field]))throw Error(item.id+' '+field+' divergence');
                            const check=async (pair,accepted)=>{
                                const order=draft.model.lines.map(l=>l.id).map(id=>pair?(id===pair[0]?pair[1]:id===pair[1]?pair[0]:id):id);
                                const lines=order.map(id=>draft.model.lines.find(l=>l.id===id).code);
                                const report=await api.previewDraft({draftId:draft.draftId,lines});posts++;checks++;
                                if(report.status!==(accepted?'accepted':'rejected'))throw Error(JSON.stringify({id:item.id,pair,report}));
                            };
                            await check(null,true);
                            for(const pair of item.acceptedSwaps)await check(pair,true);
                            for(const pair of item.rejectedSwaps)await check(pair,false);
                        }
                        const authored=await (await read('./samples/typescript/01-user-account.values-only.model.json')).json();
                        const draft=await api.compileDraft({model:authored});posts++;
                        const lines=[1,2,3,4,5,7,6,8,10,9,11,12,13].map(id=>authored.lines.find(line=>line.id===id).code);
                        const report=await api.previewDraft({draftId:draft.draftId,lines});posts++;checks++;
                        if(report.status!=='accepted')throw Error('Explicit values-only contract must accept the screenshot');
                        if(posts>112)throw Error('Matrix would consume the real server rate budget: '+posts);
                        return {models:suite.length,authoredVariants:1,checks,posts};
                    }''')
                    results[mode]=matrix
                    page.locator('[data-view="author"]').click()
                    source=(ROOT/'public/samples/typescript/01-user-account.ts').read_text(encoding='utf-8')
                    page.locator('[data-source-file]').set_input_files({'name':'user-account.ts','mimeType':'text/plain','buffer':source.encode()})
                    expect(page.locator('#author-editor')).to_have_value(source)
                    page.locator('[data-author="title"]').fill('UserAccount sorrendszabályok')
                    page.locator('[data-author="description"]').fill('Az interface mezők cserélhetők; az osztálymezők és a constructor értékadásai sorrendtartók.')
                    page.locator('[data-author-apply]').click();expect(page.locator('.solution-zone .code-row')).to_have_count(13)
                    model=json.loads((ROOT/'public/samples/typescript/01-user-account.model.json').read_text(encoding='utf-8'))
                    def check_order(order,label):
                        by_id={line['id']:line['code'] for line in model['lines']}
                        page.locator('[data-view="edit"]').click();page.locator('#code-editor').fill('\n'.join(by_id[id] for id in order));page.locator('[data-apply]').click()
                        page.locator('[data-check]').click();expect(page.locator('.report')).to_contain_text(label)
                    check_order([1,3,2,4,5,6,7,8,9,10,11,12,13],'Elfogadva')
                    check_order([1,2,3,4,5,7,6,8,10,9,11,12,13],'Hibás')
                    page.locator('[data-ordering-policy] summary').click();expect(page.locator('[data-ordering-policy]')).to_contain_text('kulcssorrend')
                    page.screenshot(path=str(ARTIFACTS/f'typescript-{mode}-screenshot-explained.png'),full_page=True)
                    page.locator('[data-preview-toggle]').click();expect(page.locator('[data-ordering-policy]')).to_have_count(0)
                    page.locator('[data-preview-toggle]').click();page.locator('[data-view="author"]').click()
                    with page.expect_popup() as popup: page.locator('[data-typescript-catalog]').click()
                    catalog=popup.value;expect(catalog.locator('tbody tr')).to_have_count(24)
                    with catalog.expect_download() as download: catalog.locator('a[download]').nth(1).click()
                    download.value.save_as(str(ARTIFACTS/f'typescript-{mode}-download.model.json'))
                    assert json.loads((ARTIFACTS/f'typescript-{mode}-download.model.json').read_text(encoding='utf-8'))==model
                    catalog.screenshot(path=str(ARTIFACTS/f'typescript-{mode}-catalog.png'),full_page=True);catalog.close()
                    assert not errors,errors
                    print(f'PASS TypeScript {mode}: {matrix}, source-file screenshot workflow, policy explanation, learner isolation, 24 downloadable source/model pairs',flush=True)
                except Exception:
                    page.screenshot(path=str(ARTIFACTS/f'typescript-{mode}-failure.png'),full_page=True);raise
                finally: context.close()
        finally: browser.close()
finally:
    static.shutdown();static.server_close();process.terminate()
    try:process.wait(timeout=5)
    except subprocess.TimeoutExpired:process.kill();process.wait()
(ARTIFACTS/'typescript-matrix.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
