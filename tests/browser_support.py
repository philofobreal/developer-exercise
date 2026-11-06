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
def launch(p):
    executable=os.environ.get('CHROMIUM')
    if not executable and os.name=='nt':
        for candidate in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
            if Path(candidate).is_file():executable=candidate;break
    options={'headless':True}
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
    if box.get_attribute('open') is None:box.locator('summary').click()
    return box
