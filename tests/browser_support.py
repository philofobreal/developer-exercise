"""Portable browser launch and artifact paths for every Playwright suite."""
import os
from http.server import ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
ARTIFACTS=ROOT/'test-results'
ARTIFACTS.mkdir(exist_ok=True)
def launch(p):
    executable=os.environ.get('CHROMIUM')
    if not executable and os.name=='nt':
        for candidate in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']:
            if Path(candidate).is_file():executable=candidate;break
    options={'headless':True}
    if executable:options['executable_path']=executable
    return p.chromium.launch(**options)
class StaticServer(ThreadingHTTPServer):
    """Test static host. The default listen backlog of 5 refuses part of a browser's parallel
    ES-module requests on Windows (net::ERR_CONNECTION_REFUSED); a real static host does not."""
    request_queue_size=128
    daemon_threads=True
