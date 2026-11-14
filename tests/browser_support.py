"""Portable browser launch and artifact paths for every Playwright suite."""
import os
from http.server import ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
ARTIFACTS=ROOT/'test-results'
ARTIFACTS.mkdir(exist_ok=True)
def installed_chromium():
    """The newest Chromium in Playwright's browser directory, for a Python Playwright whose own
    revision is not installed there (NY-16: the package expects a newer build than the image has)."""
    root=Path(os.environ.get('PLAYWRIGHT_BROWSERS_PATH') or Path.home()/'.cache'/'ms-playwright')
    found=[]
    for directory in root.glob('chromium-*'):
        revision=directory.name.split('-',1)[1]
        for name in ['chrome-linux64/chrome','chrome-linux/chrome','chrome-mac/Chromium.app/Contents/MacOS/Chromium','chrome-win/chrome.exe']:
            if revision.isdigit() and (directory/name).is_file():found.append((int(revision),directory/name))
    return str(max(found)[1]) if found else None
def launch(p,args=()):
    executable=os.environ.get('CHROMIUM')
    if not executable and os.name=='nt':
        for candidate in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
            if Path(candidate).is_file():executable=candidate;break
    options={'headless':True}
    if args:options['args']=list(args)
    if executable:options['executable_path']=executable
    try:
        return p.chromium.launch(**options)
    except Exception as error:
        # Only a missing bundled browser falls back; every other launch failure stays an error.
        fallback=None if executable or "Executable doesn't exist" not in str(error) else installed_chromium()
        if not fallback:raise
        print(f'browser_support: the bundled Chromium is not installed; using {fallback}',flush=True)
        return p.chromium.launch(**options,executable_path=fallback)
class StaticServer(ThreadingHTTPServer):
    """Test static host. The default listen backlog of 5 refuses part of a browser's parallel
    ES-module requests on Windows (net::ERR_CONNECTION_REFUSED); a real static host does not."""
    request_queue_size=128
    daemon_threads=True


def open_menu(page,name):
    """ADR-105: session and source actions live in a header or step menu (details.<name>-menu); open it before an action."""
    menu=page.locator(f'details.{name}-menu')
    if menu.get_attribute('open') is None:menu.locator('summary').click()
    return menu


def analysis_options(page):
    """ADR-105: the author's analysis settings fold away in the source step; unfold them before choosing one."""
    box=page.locator('details.analysis-options')
    if box.get_attribute('open') is None:box.locator(':scope > summary').click()
    return box


def pixels(page,clip):
    """The painted RGB of every device pixel in `clip` (CSS px), row by row: a screenshot at the device's own scale,
    decoded with zlib alone. What a seam of one device pixel looks like is lost in a screenshot scaled to CSS pixels."""
    import struct,zlib
    data=page.screenshot(clip=clip,scale='device');pos=8;idat=b'';width=height=depth=color=0
    while pos<len(data):
        length,kind=struct.unpack('>I4s',data[pos:pos+8]);chunk=data[pos+8:pos+8+length];pos+=12+length
        if kind==b'IHDR':width,height,depth,color=struct.unpack('>IIBB',chunk[:10])
        elif kind==b'IDAT':idat+=chunk
    assert depth==8 and color in (2,6),'an 8-bit RGB or RGBA screenshot'
    size=3 if color==2 else 4;stride=width*size;raw=zlib.decompress(idat);previous=bytearray(stride);rows=[]
    for y in range(height):
        kind=raw[y*(stride+1)];line=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for i in range(stride):
            a=line[i-size] if i>=size else 0;b=previous[i];c=previous[i-size] if i>=size else 0
            if kind==1:line[i]=(line[i]+a)&255
            elif kind==2:line[i]=(line[i]+b)&255
            elif kind==3:line[i]=(line[i]+(a+b)//2)&255
            elif kind==4:
                p=a+b-c;pa,pb,pc=abs(p-a),abs(p-b),abs(p-c);line[i]=(line[i]+(a if pa<=pb and pa<=pc else b if pb<=pc else c))&255
        rows.append([tuple(line[x*size:x*size+3]) for x in range(width)]);previous=line
    return rows
def pixel(page,x,y):
    """The painted RGB at (x, y): what the reader sees, after any forced darkening of the browser
    (computed styles do not show it). Decodes the 1×1 PNG screenshot with zlib alone."""
    import struct,zlib
    data=page.screenshot(clip={'x':x,'y':y,'width':1,'height':1},scale='css');pos=8;idat=b'';width=0;color=0
    while pos<len(data):
        length,kind=struct.unpack('>I4s',data[pos:pos+8]);chunk=data[pos+8:pos+8+length];pos+=12+length
        if kind==b'IHDR':width=struct.unpack('>I',chunk[:4])[0];color=chunk[9]
        elif kind==b'IDAT':idat+=chunk
    # One pixel in one row: every PNG filter (none, sub, up, average, paeth) leaves the bytes as they are.
    row=zlib.decompress(idat);assert width==1,'a 1×1 screenshot';return tuple(row[1:4]) if color in (2,6) else (row[1],)*3
