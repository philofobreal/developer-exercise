"""Layout gate (ADR-116, M1): the practice view and the author's Try step on desktop, laptop, tablet and phone (upright and on its side),
in the light and the dark theme. It checks what a machine can measure, not taste: the page never scrolls sideways, no header control runs
off the screen, every toolbar control in view has one height, every action button (ADR-117) has one type style and at most three heights, every plate (ADR-143) has its outline (a bevel with a label, round without one), a flat face its label reads on, and at most two are filled (also on the Kód and the Elemzés step), every surface has its soft corner with nothing square standing in it, a status chip is a flat pill, a segmented choice is one group with one chosen part, the lists end above the sticky result bar wherever the screen leaves them room (ADR-144), a phone on its side keeps the header and the toolbar to one row and shows the
lists on the first screen, focus gives the lists at least 40 % of the height, and a task list closed on a narrow screen is visible when the
screen widens. Screenshots of every view land in test-results/layout-*.png."""
import os,socket,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright,expect
from browser_support import ROOT,ARTIFACTS,launch
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
BASE=f'http://127.0.0.1:{port}'
proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env={**os.environ,'HOST':'127.0.0.1','PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
# name, width, height, touch, phone on its side
VIEWPORTS=[('desktop',1440,900,False,False),('laptop',1280,720,False,False),('tablet',880,1100,True,False),('phone',390,844,True,False),('phone-side',780,360,True,True),('phone-side-wide',915,412,True,True)]
MEASURE=r"""()=>{const shown=s=>[...document.querySelectorAll(s)].filter(e=>e.offsetParent&&getComputedStyle(e).visibility!=='hidden');
 const box=e=>e.getBoundingClientRect(),PLATES='button.btn:not(.link-action),.menu>summary,.mode-tabs button,.stepper .step';
 const rgb=c=>(c.match(/rgba?\(([^)]+)\)/)||['','0,0,0,0'])[1].split(/[\s,/]+/).filter(Boolean).map(Number),alpha=c=>{const p=rgb(c);return p.length>3?p[3]:1;};
 const light=c=>{const [r,g,b]=rgb(c).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;},contrast=(a,b)=>{const [x,y]=[light(a),light(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
 return {scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,
  header:Math.round(box(document.querySelector('.header')??document.body).height),
  offscreen:shown('.header button,.header summary').filter(b=>box(b).right>innerWidth+1).map(b=>b.getAttribute('aria-label')||b.textContent.trim()),
  tools:shown('.toolbar button').map(b=>Math.round(box(b).height)),
  toolRows:new Set(shown('.toolbar button').map(b=>Math.round(box(b).top+box(b).height/2))).size,
  // ADR-117 (U1): the action-button component and its relatives (segment, menu, mode switch)
  controls:shown('button.btn,.segment button,.menu>summary,.mode-tabs button').map(b=>{const s=getComputedStyle(b);return [Math.round(box(b).height),s.fontSize,s.fontWeight];}),
  // ADR-143 (D2, D3b): every plate (a tool, a menu button, a mode tab, a step plate, the main action). Its face is a layer
  // under the label, clipped to the plate's outline. The outline starts on the left side where the first corner ends: 39.94%
  // of the plate's height down for a bevel (a plate with a visible label), the round corner's radius for one without a
  // label; a plate with a line (pressed) has its face a pixel inside. Where the browser does not know shape() the plate is
  // the button's own rounded rectangle.
  plates:shown(PLATES).map(b=>{const s=getComputedStyle(b),h=parseFloat(s.getPropertyValue('--plate-h'))||box(b).height,clip=getComputedStyle(b,'::after').clipPath,round=Math.min(8,h*.22);
   const labelled=[...b.querySelectorAll('span,b,small')].some(e=>e.textContent.trim()&&box(e).width>1&&box(e).height>1&&getComputedStyle(e).visibility!=='hidden');
   const start=parseFloat((clip.match(/^shape\((?:evenodd )?from [\d.]+px ([\d.]+)px/)||[])[1]),want=labelled?h*.3994:round;
   const right=CSS.supports('clip-path','shape(from 0 0,line to 1px 1px)')?Math.abs(start-want)<=1.2:clip==='none'&&Math.abs(parseFloat(s.borderTopLeftRadius)-(labelled?h*.22:round))<=.6;
   return right?null:`${b.getAttribute('aria-label')||b.textContent.trim().slice(0,24)} (${labelled?'labelled':'no label'}): the outline starts ${start} px down, not ${Math.round(want*10)/10}, at ${Math.round(h)} (${clip.slice(0,40)})`;}).filter(Boolean),
  // a plate that can be pressed has a face: one flat tone, no gradient, and no shadow under it
  faceless:shown(PLATES).filter(b=>!b.matches(':disabled,[aria-disabled=true],.locked')).filter(b=>{const f=getComputedStyle(b,'::after');return alpha(f.backgroundColor)===0||(f.backgroundImage!=='none'&&b.getAttribute('aria-pressed')!=='true')||getComputedStyle(b).boxShadow!=='none';}).map(b=>b.getAttribute('aria-label')||b.textContent.trim().slice(0,24)),
  // the label reads on its face: 4.5 to 1 (axe cannot see a face drawn by a pseudo-element, so this is measured here)
  dim:shown(PLATES).filter(b=>!b.matches(':disabled,[aria-disabled=true],.locked')).map(b=>[b.getAttribute('aria-label')||b.textContent.trim().slice(0,24),contrast(getComputedStyle(b).color,getComputedStyle(b,'::after').backgroundColor)]).filter(([,c])=>c<4.5).map(([n,c])=>`${n}: ${c.toFixed(2)}`),
  // every role's label reads on its face, resting and hovered (a hover is not in view while this runs)
  roles:(()=>{const probe=document.createElement('i');document.documentElement.append(probe);const of=t=>{probe.style.color=`var(${t})`;return getComputedStyle(probe).color;};
   const bad=[['--text','--plate'],['--text','--plate-hover'],['--accent-text','--plate-on'],['--blue-ink','--blue'],['--blue-ink','--blue-hover'],['--yellow-ink','--yellow'],['--yellow-ink','--yellow-hover']].map(([ink,face])=>[ink,face,contrast(of(ink),of(face))]).filter(([,,c])=>c<4.5).map(([ink,face,c])=>`${ink} on ${face}: ${c.toFixed(2)}`);
   probe.remove();return bad;})(),
  // at most two filled plates on a screen: the current step and the main action. Filled = the face is a solid brand colour
  // (resting or hovered), whichever element carries it.
  filled:(()=>{const probe=document.createElement('i');document.documentElement.append(probe);
   const solid=['--blue','--blue-hover','--yellow','--yellow-hover'].map(t=>{probe.style.color=`var(${t})`;return getComputedStyle(probe).color;});probe.remove();
   const face=b=>{if(b.matches(PLATES))return getComputedStyle(b,'::after').backgroundColor;const s=getComputedStyle(b),stops=s.backgroundImage.match(/(?:rgba?|color)\([^()]*\)/g);return stops?stops[stops.length-1]:s.backgroundColor;};
   return shown('button,summary').filter(b=>solid.includes(face(b))).map(b=>b.getAttribute('aria-label')||b.textContent.trim().slice(0,24));})(),
  // a pressed plate: a line around it and a 2 px mark on its face
  pressed:shown(':is(button.btn,.mode-tabs button)[aria-pressed=true]').map(b=>{const f=getComputedStyle(b,'::after'),line=getComputedStyle(b,'::before');return [(b.getAttribute('aria-label')||b.textContent.trim()),f.backgroundImage.includes('gradient')&&/ 2px$/.test(f.backgroundSize)&&parseFloat(f.backgroundSize)!==0&&line.content!=='none'&&alpha(line.backgroundColor)>0];}),
  zoneTop:Math.round(box(document.querySelector('.drop-zone')??document.body).top),
  zones:shown('.drop-zone').map(z=>Math.round(box(z).height)),
  // the lists side by side share their height; stacked, their heights add up
  lists:(z=>z.length?Math.round(new Set(z.map(e=>Math.round(box(e).top))).size>1?z.reduce((s,e)=>s+box(e).height,0):Math.max(...z.map(e=>box(e).height))):0)(shown('.drop-zone'))};}"""
# ADR-143 (D3): nothing square stands in a rounded corner. For every box in view with a corner of 5 px or more, the point
# just inside its bounding box and outside its curve must not be painted by one of its descendants (a ground, or a border
# whose strip the point lies in). Hit testing knows the curve and what an ancestor clips; it does not see ::before and
# ::after, so a stripe is drawn as the box's own background.
CORNERS=r"""()=>{const name=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
 const alpha=c=>{if(c==='transparent')return 0;const m=c.match(/\(([^)]+)\)/);if(!m)return 1;const p=m[1].split(/[\s,/]+/).filter(Boolean);return /^rgba?$/.test(c.split('(')[0])?(p.length>3?parseFloat(p[3]):1):(c.includes('/')?parseFloat(p[p.length-1]):1);};
 // a descendant paints at a point with its ground, or with a border whose strip the point lies in
 const paints=(e,px,py)=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();if(s.visibility==='hidden')return false;if(alpha(s.backgroundColor)>0||s.backgroundImage!=='none')return true;
  const on=k=>parseFloat(s['border'+k+'Width'])>0&&s['border'+k+'Style']!=='none'&&alpha(s['border'+k+'Color'])>0,w=k=>parseFloat(s['border'+k+'Width']);
  return on('Left')&&px<r.left+w('Left')||on('Right')&&px>r.right-w('Right')||on('Top')&&py<r.top+w('Top')||on('Bottom')&&py>r.bottom-w('Bottom');};
 const out=new Set();
 for(const box of document.querySelectorAll('body *')){const r=box.getBoundingClientRect();if(r.width<12||r.height<12||!box.checkVisibility())continue;const s=getComputedStyle(box);
  for(const [k,x,y,dx,dy] of [['TopLeft',r.left,r.top,1,1],['TopRight',r.right,r.top,-1,1],['BottomRight',r.right,r.bottom,-1,-1],['BottomLeft',r.left,r.bottom,1,-1]]){
   const raw=s['border'+k+'Radius'];let rad=parseFloat(raw);if(raw.includes('%'))rad=Math.min(r.width,r.height)*rad/100;rad=Math.min(rad,r.width/2,r.height/2);if(!(rad>=5))continue;
   const d=Math.max(.75,rad*.12),px=x+dx*d,py=y+dy*d;if(px<0||py<0||px>=innerWidth||py>=innerHeight)continue;
   if(!document.elementsFromPoint(x+dx*rad,y+dy*rad).includes(box))continue;
   const poke=document.elementsFromPoint(px,py).find(e=>e!==box&&box.contains(e)&&paints(e,px,py));
   if(poke)out.add(`${name(box)} ${k} (${Math.round(rad)}px): ${name(poke)}`);}}
 return [...out];}"""
# ADR-143 (D3): every surface in view has its token's corner (a later rule once squared most panels, ADR-138); a status
# chip is a flat pill; a text field has the field's corner; a segmented choice is one group as high as the controls, with
# exactly one chosen part that has a face while the others have none, and each part answers over the group's whole height.
SURFACES="""()=>{const shown=s=>[...document.querySelectorAll(s)].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().width>0);
 const root=getComputedStyle(document.documentElement),token=t=>parseFloat(root.getPropertyValue(t)),name=e=>e.tagName.toLowerCase()+'.'+[...e.classList].slice(0,2).join('.');
 const radii=e=>{const s=getComputedStyle(e);return ['TopLeft','TopRight','BottomRight','BottomLeft'].map(k=>parseFloat(s['border'+k+'Radius']));};
 const kinds=[['--r-frame','.author,.solution-editor'],['--r-panel','.model-overview,.rule-panel,.model-insight,.rule-board,.try-rules,.source-diagnostics,.task-status,.help-topic,.analysis-options,.learner-data,.evaluation-bar'],
  ['--r-inset','.dependency-details,.rule-item,.board-list,.feedback-details,.rule-kinds,.help-code,.validation-notice,.draft-notice,.stale-notice,.edit-paused'],['--r-float','.menu-panel,.activity,.toggletip-panel:popover-open'],
  ['--r-field','#app :is(input:not([type=checkbox],[type=radio],[type=file],[hidden]),select)']];
 const square=kinds.flatMap(([t,list])=>shown(list).filter(e=>radii(e).some(r=>Math.abs(r-token(t))>.1)).map(e=>`${name(e)}: ${radii(e)} for ${t} ${token(t)}`));
 const chips=shown('.context-label,.rule-badge,.verification-badge,.publish-badge,.mode-badge,.lock-label').filter(e=>{const s=getComputedStyle(e),h=e.getBoundingClientRect().height;
  return radii(e).some(r=>r<h/2)||s.boxShadow!=='none'||s.backgroundImage!=='none';}).map(name);
 const segments=shown('.segment').flatMap(g=>{const parts=[...g.querySelectorAll('button')],r=g.getBoundingClientRect(),control=parseFloat(getComputedStyle(g).getPropertyValue('--control-h'));
  const faced=parts.filter(b=>!/rgba\([^)]*, 0\)|transparent/.test(getComputedStyle(b).backgroundColor)),chosen=parts.filter(b=>b.classList.contains('active')),bad=[];
  if(Math.abs(r.height-control)>1)bad.push(`${name(g)}: ${r.height} px high beside ${control} px controls`);
  if(chosen.length!==1||faced.length!==1||faced[0]!==chosen[0])bad.push(`${name(g)}: ${chosen.length} chosen, ${faced.length} with a face`);
  for(const b of parts){const c=b.getBoundingClientRect(),x=c.left+c.width/2;if(r.top<0||r.bottom>innerHeight)continue;
   for(const y of [r.top+1.5,r.bottom-1.5])if(document.elementFromPoint(x,y)?.closest('button')!==b)bad.push(`${name(g)}: "${b.textContent.trim()}" does not answer at the group's edge`);}
  return bad;});
 return {square,chips,segments};}"""
def surfaces(page,name):
    """The soft surfaces of the view in front (ADR-143, D3), down the whole page."""
    s=page.evaluate(SURFACES)
    assert not s['square'],f"{name}: surfaces without their corner: {s['square']}"
    assert not s['chips'],f"{name}: status chips that are not flat pills: {s['chips']}"
    assert not s['segments'],f"{name}: segmented choices: {s['segments']}"
    top,height,view=page.evaluate('[scrollY,document.documentElement.scrollHeight,innerHeight]');found=set();y=0
    while True:
        page.evaluate('y=>scrollTo(0,y)',y);found|=set(page.evaluate(CORNERS))
        if y+view>=height:break
        y+=view-80
    page.evaluate('y=>scrollTo(0,y)',top)
    assert not found,f"{name}: something square stands in a rounded corner: {sorted(found)}"
def step(page,name):
    """An author step without the lists (Kód, Elemzés és szabályok): the plates, the roles and the surfaces."""
    page.mouse.move(0,0);m=page.evaluate(MEASURE);page.screenshot(path=str(ARTIFACTS/f'layout-{name}.png'))
    assert m['scroll']<=m['width'],f"{name}: the page scrolls sideways ({m['scroll']} > {m['width']})"
    assert not m['offscreen'],f"{name}: header controls off the screen: {m['offscreen']}"
    assert not m['plates'],f"{name}: plates with the wrong shape: {m['plates']}"
    assert not m['faceless'],f"{name}: plates without a flat face: {m['faceless']}"
    assert not m['dim'],f"{name}: labels under 4.5 to 1 on their plate: {m['dim']}"
    assert not m['roles'],f"{name}: a role's label under 4.5 to 1 on its face: {m['roles']}"
    assert len(m['filled'])<=2,f"{name}: more than two filled plates on the screen: {m['filled']}"
    assert all(marked for _,marked in m['pressed']),f"{name}: a pressed button without its line and mark: {m['pressed']}"
    surfaces(page,name)
    print(f"PASS layout: {name} {m['width']}x{m['height']} filled {len(m['filled'])}",flush=True)
def check(page,name,side,focused=False):
    m=page.evaluate(MEASURE)
    page.screenshot(path=str(ARTIFACTS/f'layout-{name}.png'))
    assert m['scroll']<=m['width'],f"{name}: the page scrolls sideways ({m['scroll']} > {m['width']})"
    assert not m['offscreen'],f"{name}: header controls off the screen: {m['offscreen']}"
    assert m['tools'] and max(m['tools'])-min(m['tools'])<=1,f"{name}: toolbar controls of different heights {m['tools']}"
    heights=sorted({h for h,_,_ in m['controls']});fonts=sorted({(f,w) for _,f,w in m['controls']})
    assert len(heights)<=3,f"{name}: buttons in {len(heights)} heights {heights} (at most 3: default, small, and the header's or the main action's)"
    assert len(fonts)==1,f"{name}: buttons in {len(fonts)} type styles {fonts} (one: 13 px, 600)"
    assert not m['plates'],f"{name}: plates with the wrong shape: {m['plates']}"
    assert not m['faceless'],f"{name}: plates without a flat face: {m['faceless']}"
    assert not m['dim'],f"{name}: labels under 4.5 to 1 on their plate: {m['dim']}"
    assert not m['roles'],f"{name}: a role's label under 4.5 to 1 on its face: {m['roles']}"
    assert len(m['filled'])<=2,f"{name}: more than two filled plates on the screen: {m['filled']}"
    assert all(marked for _,marked in m['pressed']),f"{name}: a pressed button without its line and mark: {m['pressed']}"
    if focused:assert m['pressed'],f"{name}: the focus toggle is pressed in focus mode"
    if side:
        assert m['toolRows']==1,f"{name}: the toolbar takes {m['toolRows']} rows on a phone on its side"
        if not focused:
            assert m['header']<=52,f"{name}: the header is {m['header']} px high on a phone on its side"
            assert m['zoneTop']<m['height']-60,f"{name}: the lists start at {m['zoneTop']} px, below the first screen ({m['height']} px)"
    # ADR-123 (UI4): an upright phone keeps the app bar to one row (one 44 px touch control and its padding; two rows were ~110 px).
    if not side and not focused and m['width']<=650:assert m['header']<=66,f"{name}: the header is {m['header']} px high: more than one row on an upright phone"
    if focused:assert m['lists']>=.4*m['height'],f"{name}: focus leaves the lists {m['lists']} px of {m['height']}"
    surfaces(page,name)
    print(f"PASS layout: {name} {m['width']}x{m['height']} header {m['header']} tools {sorted(set(m['tools']))} rows {m['toolRows']} lists {m['zones']}",flush=True)
def focus(page,name,side):
    page.locator('[data-focus]').click();expect(page.locator('#app')).to_have_attribute('data-surface','focus')
    check(page,name+'-focus',side,focused=True)
    page.locator('[data-focus]').click();expect(page.locator('#app')).not_to_have_attribute('data-surface','focus')
def views(page,name,side):
    page.goto(BASE);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
    menu=page.locator('details.open-menu')
    if menu.get_attribute('open') is None:menu.locator('summary').click()
    example=page.locator('[data-start-example] option').nth(1).get_attribute('value');page.locator('[data-start-example]').select_option(example)
    step(page,name+'-author-source')
    page.locator('[data-author-apply]').click();expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step')
    step(page,name+'-author-rules')
    page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible()
    check(page,name+'-author-try',side);focus(page,name+'-author-try',side)
    page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
    check(page,name+'-practice',side);focus(page,name+'-practice',side)
# ADR-144 (NY-38): where the lists end and where the result bar starts, with the page as it stands.
FIT="""()=>{const bar=document.querySelector('.evaluation-bar').getBoundingClientRect(),zones=[...document.querySelectorAll('.drop-zone')].filter(e=>e.checkVisibility()).map(e=>e.getBoundingClientRect());
 return {height:Math.round(zones[0].height),bottom:Math.max(...zones.map(r=>r.bottom)),barTop:bar.top,barBottom:bar.bottom,view:innerHeight,side:new Set(zones.map(r=>Math.round(r.top))).size===1};}"""
def settled(page):
    """Two frames: the measurement runs in the frame after a size changes."""
    page.evaluate('()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))')
def fits(page,name,least=False):
    """Side by side, the lists end above the result bar with the page at its top, and reach down to it (the bar's own
    margin and the pane's line between them) unless they stand at their least or greatest height. `least`: the room may be under the
    lists' least height here, and then the page scrolls."""
    page.evaluate('scrollTo(0,0)');settled(page);f=page.evaluate(FIT)
    assert f['side'],f"{name}: the lists stand side by side"
    assert f['view']-4<=f['barBottom']<=f['view']+1,f"{name}: the result bar stands at the bottom of the screen ({f['barBottom']} of {f['view']})"
    if not(least and f['height']==180):assert f['bottom']<=f['barTop']+.5,f"{name}: {round(f['bottom']-f['barTop'])} px of the lists stand under the result bar"
    if 180<f['height']<640:assert f['barTop']-f['bottom']<=20,f"{name}: the lists end {round(f['barTop']-f['bottom'])} px above the result bar"
    return f
def lists_above_bar(browser):
    """ADR-144 (NY-38): on a low laptop screen, a laptop, a desktop and a tablet on its side, in the author's Try step and
    in practice, before and after a check (the bar grows with a result) the lists end above the result bar. The room is
    measured, not a constant: a block that pushes the lists down and a detail opened in the bar shorten them. Where the
    room is under 180 px the lists keep 180 px. On a phone on its side a list and its title fill the screen above the bar."""
    for width,height,touch in [(1366,600,False),(1366,650,False),(1280,720,False),(1440,900,False),(1024,768,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch);page=context.new_page();name=f'{width}x{height}'
        page.goto(BASE);expect(page.locator('[data-step="source"]')).to_have_attribute('aria-current','step')
        menu=page.locator('details.open-menu')
        if menu.get_attribute('open') is None:menu.locator('summary').click()
        example=page.locator('[data-start-example] option').nth(1).get_attribute('value');page.locator('[data-start-example]').select_option(example)
        page.locator('[data-author-apply]').click();expect(page.locator('[data-step="rules"]')).to_have_attribute('aria-current','step')
        page.locator('[data-step="try"]').click();expect(page.locator('.solution-zone')).to_be_visible();fits(page,name+' author Try')
        page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle');fits(page,name+' author Try, checked')
        page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible();idle=fits(page,name+' practice')
        # what stands above the lists is measured: 70 px more above them is 70 px less for them
        page.evaluate("()=>{const block=document.createElement('div');block.id='pushed';block.style.height='70px';document.querySelector('.task-heading').before(block);}")
        pushed=fits(page,name+' practice, pushed down',least=True)
        if idle['height']-70>180 and idle['height']<640:assert abs(idle['height']-70-pushed['height'])<=1,f"{name}: the lists were {idle['height']} px and are {pushed['height']} px with 70 px more above them"
        page.evaluate("()=>document.querySelector('#pushed').remove()")
        page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle');checked=fits(page,name+' practice, checked')
        # the bar is measured too: a detail opened in it leaves the lists above it
        detail=page.locator('.evaluation-bar details').first;expect(detail).to_be_visible()
        detail.locator('summary').click();opened=fits(page,name+' practice, a detail open in the bar',least=True)
        assert opened['barTop']<checked['barTop']-1,f"{name}: the opened detail made the bar higher"
        context.close()
    # under 180 px of room the lists keep 180 px and the page scrolls (500 px and lower is the low, wide layout of a phone on its side)
    context=browser.new_context(viewport={'width':1366,'height':520});page=context.new_page();page.goto(BASE)
    page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible();settled(page)
    assert page.evaluate(FIT)['height']==180,f"a 520 px high window leaves the lists {page.evaluate(FIT)['height']} px, not their least 180 px"
    context.close()
    # a phone on its side: scrolled to a list's title, the list ends above the bar, before and after a check
    context=browser.new_context(viewport={'width':780,'height':360},is_mobile=True,has_touch=True);page=context.new_page();page.goto(BASE)
    page.locator('[data-mode="practice"]').click();expect(page.locator('[data-check]')).to_be_visible()
    for state in ['idle','checked']:
        if state=='checked':page.locator('[data-check]').click();expect(page.locator('.report')).not_to_have_class('report idle')
        settled(page);page.evaluate("()=>document.querySelector('.panel-title').scrollIntoView({block:'start'})");settled(page);f=page.evaluate(FIT)
        assert page.evaluate("()=>Math.abs(document.querySelector('.panel-title').getBoundingClientRect().top)")<=1,'the list title stands at the top of the screen'
        assert f['bottom']<=f['barTop']+.5,f"phone on its side, {state}: {round(f['bottom']-f['barTop'])} px of the lists stand under the result bar"
    context.close()
    print('PASS layout: the lists end above the result bar on five screens, before and after a check; the room is measured',flush=True)
def sidebar(browser):
    """ADR-116: a task list closed on a narrow screen is still the sidebar when the screen widens (it was an empty column)."""
    page=browser.new_context(viewport={'width':780,'height':900}).new_page();page.goto(BASE)
    page.locator('[data-mode="practice"]').click();picker=page.locator('details.task-picker')
    expect(picker).not_to_have_attribute('open','')
    page.set_viewport_size({'width':1280,'height':900});expect(page.locator('[data-task]').first).to_be_visible()
    print('PASS layout: a task list closed on a narrow screen is visible in the wide sidebar',flush=True)
    page.context.close()
try:
    for _ in range(100):
        try:urllib.request.urlopen(BASE+'/api/exercises',timeout=.5);break
        except Exception:time.sleep(.1)
    with sync_playwright() as p:
        browser=launch(p)
        try:
            for scheme in ['light','dark']:
                for name,width,height,touch,side in VIEWPORTS:
                    context=browser.new_context(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch,color_scheme=scheme)
                    views(context.new_page(),f'{scheme}-{name}',side);context.close()
            sidebar(browser);lists_above_bar(browser)
            print('PASS layout total: every view in both themes',flush=True)
        finally:browser.close()
finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
