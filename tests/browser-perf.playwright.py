"""ADR-151 (NY-58, T0.2): the main-thread cost of the workbench's hot paths, as a regression gate.

What is measured: one fixed exercise (the 482-line TypeScript fixture, pasted into the author's editor of the static
Pages build, so the shipped catalog plays no part) and eight scenarios on it. Each scenario runs RUNS times; the gate
reads the median.

Two kinds of numbers:
 - counts (style recalculations, layouts, DOM nodes added): the same on every machine, held to the baseline;
 - time: the main thread's own CPU time for the scenario (Chromium's thread clock, so another process's load does not
   count), divided by the time of a fixed synthetic workload measured in the same browser (a "unit"). A ratio travels
   between machines where milliseconds do not. Held to the baseline with a budget.
Reported, not gated: wall-clock time, the longest task, the slowest event and the longest animation frame, without and
with a 4x CPU throttle; and the start of the page on the shipped catalog.

  python tests/browser-perf.playwright.py              measure and compare with tests/fixtures/perf-baseline.json
  python tests/browser-perf.playwright.py --baseline   measure and rewrite the baseline (review the diff)

The baseline is rewritten only for a documented improvement or a decided change of the scenarios, like the other
baselines of the repository. This suite runs by itself (the gate starts it after the other suites): numbers taken beside
three other browsers are not the page's."""
import json,os,statistics,sys,threading,time
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch,StaticServer

RUNS=7
THROTTLED_RUNS=3
BASELINE=ROOT/'tests'/'fixtures'/'perf-baseline.json'
SOURCE=(ROOT/'tests'/'fixtures'/'copy-field-utility.service.ts').read_text(encoding='utf-8')
# The budgets over the baseline (ADR-151 records the measurements behind them).
# Counts are the gate: they repeat exactly from run to run, and they are what the refactoring changes.
COUNT_BUDGET=1.1
COUNT_FLOOR=2
# While the model is made, the progress indicator and the worker's answers arrive when they arrive: its style and layout
# passes vary by a third between runs (31-39 and 10-14), its added nodes do not.
LOOSE_COUNTS={'make-model':1.5}
# Time catches a gross regression only: between identical runs the best-of-seven ratio moved by 3-37% here, so a budget
# of a fifth would fail on unchanged code. On a CI runner the suite shares its cores with other jobs.
TIME_BUDGET=2.0 if os.environ.get('CI') else 1.6
TIME_FLOOR=.2
# A baseline is the median of this many measurements.
BASELINE_PASSES=3

class Pages(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'_site'),**kwargs)
    def do_GET(self):
        if not self.path.startswith('/developer-exercise/'):
            self.send_error(404);return
        self.path=self.path[len('/developer-exercise'):];super().do_GET()
    def log_message(self,*args):pass
static=StaticServer(('127.0.0.1',0),Pages)
threading.Thread(target=static.serve_forever,daemon=True).start()
PAGES=f'http://127.0.0.1:{static.server_address[1]}/developer-exercise/'

WATCH="""()=>{
 const seen=window.__perf={added:0,long:[],frames:[],events:[],observers:[]};
 const watch=(type,into,extra={})=>{try{const o=new PerformanceObserver(list=>{for(const e of list.getEntries())into.push(Math.round(e.duration));});o.observe({type,...extra});seen.observers.push(o);}catch{}};
 watch('longtask',seen.long);watch('long-animation-frame',seen.frames);watch('event',seen.events,{durationThreshold:16});
 const m=new MutationObserver(list=>{for(const r of list)for(const n of r.addedNodes)seen.added+=1+(n.querySelectorAll?n.querySelectorAll('*').length:0);});
 m.observe(document.documentElement,{childList:true,subtree:true});seen.observers.push(m);
 return performance.now();
}"""
SETTLE="""()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{
 const seen=window.__perf;for(const o of seen.observers){if(o.takeRecords){const left=o.takeRecords();if(left&&left.length&&o instanceof MutationObserver)for(const r of left)for(const n of r.addedNodes)seen.added+=1+(n.querySelectorAll?n.querySelectorAll('*').length:0);}o.disconnect();}
 done({now:performance.now(),added:seen.added,long:Math.max(0,...seen.long),frame:Math.max(0,...seen.frames),event:Math.max(0,...seen.events)});
},0))))"""
# The synthetic workload of one unit: build, style, lay out and drop a fixed tree.
CALIBRATE="""()=>{
 const host=document.createElement('div');host.style.cssText='position:absolute;left:-9999px;width:600px';document.body.append(host);
 let html='';for(let i=0;i<3000;i++)html+=`<div class="code-row" style="padding:${i%7}px"><span class="line-number">${i}</span><code>const value${i} = ${i} * 2;</code></div>`;
 host.innerHTML=html;let total=0;for(const row of host.children)total+=row.getBoundingClientRect().height;host.remove();return total;
}"""

def metrics(client):
    return {m['name']:m['value'] for m in client.send('Performance.getMetrics')['metrics']}

def measure(page,client,action,settled=None):
    """One run of a scenario: what the main thread did between the action and two frames after it settled."""
    started=page.evaluate(WATCH);before=metrics(client)
    action()
    if settled:settled()
    after=page.evaluate(SETTLE);now=metrics(client)
    return {'task':(now['TaskDuration']-before['TaskDuration'])*1000,'styles':now['RecalcStyleCount']-before['RecalcStyleCount'],'layouts':now['LayoutCount']-before['LayoutCount'],
            'added':after['added'],'wall':after['now']-started,'long':after['long'],'frame':after['frame'],'event':after['event']}

def session(page,throttle=1):
    client=page.context.new_cdp_session(page)
    client.send('Performance.enable',{'timeDomain':'threadTicks'})
    client.send('Emulation.setCPUThrottlingRate',{'rate':throttle})
    return client

def prepare(page):
    """The fixed exercise in the author's editor, in the code view every scenario was measured in."""
    page.goto(PAGES);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
    page.locator('[data-source-kind="code"]').click();page.locator('[data-author="language"]').select_option('typescript')
    page.locator('#author-editor').fill(SOURCE)

def to_rules(page):
    page.locator('[data-author-apply]').click();expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step',timeout=120000)

def scenarios(page,client,runs):
    """Every scenario, `runs` times each, on one page. Returns name → list of runs."""
    out={}
    def repeat(name,action,settled=None,before=None,after=None):
        rows=[]
        for _ in range(runs):
            if before:before()
            rows.append(measure(page,client,action,settled))
            if after:after()
        out[name]=rows
    # The synthetic unit, on the same page and in the same browser as everything else.
    repeat('unit',lambda:page.evaluate(CALIBRATE))
    prepare(page)
    # One key in the 482-line source: the editor's own work for one input.
    editor=page.locator('#author-editor');editor.focus();page.keyboard.press('Control+End')
    repeat('type-key',lambda:page.keyboard.type('x'))
    for _ in range(runs):page.keyboard.press('Backspace')
    # Making the model: the analysis runs in the worker; this is what the main thread does around it.
    def edit():
        page.locator('[data-step="source"]').click();expect(page.locator('#author-editor')).to_be_visible()
        page.locator('#author-editor').focus();page.keyboard.press('Control+End');page.keyboard.type(' ')
    to_rules(page)
    repeat('make-model',lambda:page.locator('[data-author-apply]').click(),lambda:expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step',timeout=120000),before=edit)
    # Opening the Try step: both lists of the whole exercise are drawn.
    back=lambda:(page.locator('[data-step="rules"]').click(),expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step'))
    repeat('open-try',lambda:page.locator('[data-step="try"]').click(),lambda:expect(page.locator('.solution-zone')).to_be_visible(),after=back)
    page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible()
    row=lambda:page.locator('.source-zone .code-row:not(.blank-row):not(.fixed-row) .drag-handle[tabindex="0"]').first
    # The keyboard gesture: pick a row, move the target, place it.
    def pick():
        row().focus();page.keyboard.press('Enter');expect(page.locator('[data-move-status]')).to_contain_text('Sor felvéve')
    repeat('key-target',lambda:page.keyboard.press('ArrowDown'),before=pick,after=lambda:page.keyboard.press('Escape'))
    placed=lambda:page.locator('.solution-zone .code-row:not(.blank-row):not(.fixed-row)').count()
    def place_settled(count):
        return lambda:page.wait_for_function('n=>document.querySelectorAll(".solution-zone .code-row:not(.blank-row):not(.fixed-row)").length>n',arg=count)
    rows=[]
    for _ in range(runs):
        pick();count=placed();rows.append(measure(page,client,lambda:page.keyboard.press('Enter'),place_settled(count)))
    out['key-place']=rows
    # The pointer gesture: one move of a held row over the other list.
    rows=[]
    for index in range(runs):
        source=row();source.scroll_into_view_if_needed();start=source.bounding_box();zone=page.locator('.solution-zone').bounding_box()
        page.mouse.move(start['x']+start['width']/2,start['y']+start['height']/2);page.mouse.down()
        page.mouse.move(zone['x']+60,zone['y']+40,steps=4);expect(page.locator('.insert-caret')).to_have_count(1)
        rows.append(measure(page,client,lambda:page.mouse.move(zone['x']+60,zone['y']+90+index*24)))
        page.keyboard.press('Escape');page.mouse.up()
    out['drag-move']=rows
    # A check of the arrangement: the validator runs in the worker; the report is drawn here.
    rows=[]
    for _ in range(runs):
        pick();count=placed();page.keyboard.press('Enter');place_settled(count)()
        rows.append(measure(page,client,lambda:page.locator('[data-check]').click(),lambda:expect(page.locator('.report')).not_to_have_class('report idle')))
    out['check']=rows
    return out

def summary(rows):
    median=lambda key:statistics.median(row[key] for row in rows)
    return {key:median(key) for key in rows[0]}|{'task_min':min(row['task'] for row in rows),'task_spread':max(row['task'] for row in rows)-min(row['task'] for row in rows)}

def start(browser):
    """Reported only: the page's start on the shipped catalog, cold cache, wall clock."""
    rows=[]
    for _ in range(3):
        context=browser.new_context(viewport={'width':1500,'height':1000});page=context.new_page();began=time.perf_counter()
        page.goto(PAGES);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step');rows.append((time.perf_counter()-began)*1000);context.close()
    return statistics.median(rows)

GATED_TIME=['type-key','make-model','open-try','key-target','key-place','drag-move','check']
def compare(result,baseline):
    problems=[]
    for name in GATED_TIME:
        now,then=result['scenarios'][name],baseline['scenarios'].get(name)
        if not then:problems.append(f'{name}: no baseline');continue
        limit=max(then['units']*TIME_BUDGET,then['units']+TIME_FLOOR)
        if now['units']>limit:problems.append(f"{name}: main-thread time {now['units']:.2f} units ({now['task']:.0f} ms) is over the budget {limit:.2f} (baseline {then['units']:.2f})")
        budget=LOOSE_COUNTS.get(name,COUNT_BUDGET)
        for count in ('styles','layouts','added'):
            limit=max(then[count]*(COUNT_BUDGET if count=='added' else budget),then[count]+COUNT_FLOOR)
            if now[count]>limit:problems.append(f"{name}: {count} {now[count]:.0f} is over the budget {limit:.0f} (baseline {then[count]:.0f})")
    return problems

try:
    with sync_playwright() as p:
        browser=launch(p)
        try:
            result={'runs':RUNS,'scenarios':{},'throttled':{}}
            def one_pass(throttle,runs):
                context=browser.new_context(viewport={'width':1500,'height':1000});page=context.new_page();client=session(page,throttle)
                try:return {name:summary(rows) for name,rows in scenarios(page,client,runs).items()}
                finally:context.close()
            def plain(measured):
                unit=measured['unit']['task_min']
                return {name:{'units':round(row['task_min']/unit,3),'task':round(row['task'],1),'task_spread':round(row['task_spread'],1),'styles':row['styles'],'layouts':row['layouts'],'added':row['added'],
                              'wall':round(row['wall']),'long':row['long'],'frame':row['frame'],'event':row['event']} for name,row in measured.items()}
            passes=[plain(one_pass(1,RUNS)) for _ in range(BASELINE_PASSES if '--baseline' in sys.argv else 1)]
            result['scenarios']=passes[0];result['passes']=[{name:row['units'] for name,row in one.items()} for one in passes]
            result['throttled']={name:{'wall':round(row['wall']),'long':row['long'],'frame':row['frame'],'event':row['event']} for name,row in one_pass(4,THROTTLED_RUNS).items()}
            result['start_ms']=round(start(browser))
        finally:browser.close()
    (ARTIFACTS/'perf.json').write_text(json.dumps(result,indent=1)+'\n',encoding='utf-8')
    print(f"{'scenario':12} {'units':>6} {'task ms':>8} {'±':>5} {'styles':>6} {'layouts':>7} {'added':>7} {'wall':>6} {'long':>5} {'event':>5} | 4x: {'wall':>6} {'long':>5} {'event':>5}")
    for name,row in result['scenarios'].items():
        slow=result['throttled'][name]
        print(f"{name:12} {row['units']:6.2f} {row['task']:8.1f} {row['task_spread']:5.1f} {row['styles']:6.0f} {row['layouts']:7.0f} {row['added']:7.0f} {row['wall']:6.0f} {row['long']:5.0f} {row['event']:5.0f} |     {slow['wall']:6.0f} {slow['long']:5.0f} {slow['event']:5.0f}")
    print(f"start of the page on the shipped catalog (reported only): {result['start_ms']} ms",flush=True)
    if '--baseline' in sys.argv:
        middle=lambda name,key:statistics.median(one[name][key] for one in passes)
        pinned={'runs':RUNS,'passes':BASELINE_PASSES,'scenarios':{name:{key:middle(name,key) for key in ('units','task','styles','layouts','added')} for name in passes[0]}}
        BASELINE.write_text(json.dumps(pinned,indent=1)+'\n',encoding='utf-8',newline='\n');print(f'perf baseline written for {len(pinned["scenarios"])} scenarios, the median of {BASELINE_PASSES} measurements')
        for name in passes[0]:print(f"  {name:12} units per measurement: {[one[name]['units'] for one in passes]}")
    else:
        problems=compare(result,json.loads(BASELINE.read_text(encoding='utf-8')))
        assert not problems,'\n'.join(problems)
        for name in GATED_TIME:print(f'PASS perf: {name} within its budget',flush=True)
finally:
    static.shutdown();static.server_close()
