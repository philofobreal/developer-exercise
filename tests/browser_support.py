"""Portable browser launch and artifact paths for every Playwright suite."""
import os
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
