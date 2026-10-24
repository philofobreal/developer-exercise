"""Pinned parser platform gate, not Python exercise/IR/UI acceptance.
Uses the same bounded corpus in Node and two browser hosting policies.
"""
import json
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
from browser_support import ROOT, launch

BASE_CSP = "default-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'"


class Probe(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'test-results' / 'python-site'), **kwargs)

    def do_GET(self):
        parts = self.path.split('/', 3)
        if len(parts) < 4 or parts[1] not in ('scoped', 'strict', 'pages') or parts[2] != 'developer-exercise':
            self.send_error(404)
            return
        self.policy = parts[1]
        self.path = '/' + parts[3]
        super().do_GET()

    def end_headers(self):
        if getattr(self, 'policy', 'pages') != 'pages':
            policy = BASE_CSP
            if self.policy == 'scoped' and self.path.split('?')[0] == '/dist/python/browser-worker.js':
                policy = policy.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'")
            self.send_header('Content-Security-Policy', policy)
        super().end_headers()

    def log_message(self, *args):
        pass


node = json.loads(subprocess.check_output(['node', 'tests/python-parity.mjs'], cwd=ROOT, text=True, encoding='utf-8', timeout=40))
corpus = json.loads((ROOT / 'tests/fixtures/python-parser-corpus.json').read_text(encoding='utf-8'))
server = ThreadingHTTPServer(('127.0.0.1', 0), Probe)
threading.Thread(target=server.serve_forever, daemon=True).start()
metrics = {'node': node['metrics'], 'corpusCases': len(corpus), 'browser': {}}
try:
    with sync_playwright() as p:
        browser = launch(p)
        try:
            for policy in ('scoped', 'pages', 'strict'):
                context = browser.new_context()
                page = context.new_page()
                page.set_default_timeout(30_000)
                external, errors, requested = [], [], []

                def route(request):
                    if not request.request.url.startswith(f'http://127.0.0.1:{server.server_port}/'):
                        external.append(request.request.url)
                        request.abort()
                    else:
                        requested.append(request.request.url)
                        request.continue_()

                context.route('**/*', route)
                page.on('pageerror', lambda error: errors.append(str(error)))
                url = f'http://127.0.0.1:{server.server_port}/{policy}/developer-exercise/'
                page.goto(url, wait_until='networkidle')
                assert not any('pyodide' in item for item in requested), 'Runtime must remain lazy'
                if policy == 'strict':
                    blocked = page.evaluate('''async () => {
                        const {createBrowserPythonParser} = await import('./dist/python/browser-parser.js');
                        const parser = createBrowserPythonParser();
                        try { await parser.audit('x = 1', {timeoutMs: 2500}); return 'unexpected-success'; }
                        catch (error) { return error.code; } finally { parser.close(); }
                    }''')
                    assert blocked in ('timeout', 'runtime_error'), blocked
                else:
                    result = page.evaluate('''async corpus => {
                        const {createBrowserPythonParser} = await import('./dist/python/browser-parser.js');
                        const parser = createBrowserPythonParser(), replies = [], times = [];
                        let coldMs;
                        try {
                            for (const [index, item] of corpus.entries()) {
                                const begin = performance.now();
                                try { replies.push({protocolVersion: 1, requestId: index + 1, ok: true, audit: await parser.audit(item.source, {timeoutMs: 30_000})}); }
                                catch (error) { replies.push({protocolVersion: 1, requestId: index + 1, ok: false, error: {code: error.code, message: error.message, ...(error.position ? {position: error.position} : {})}}); }
                                const elapsed = performance.now() - begin;
                                if (!index) coldMs = elapsed; else times.push(elapsed);
                            }
                            // Cancellation terminates an isolated worker; no stale result is admitted.
                            const abort = new AbortController();
                            const pending = parser.audit('x=1', {signal: abort.signal}).then(() => 'unexpected-success', error => error.code);
                            abort.abort();
                            const cancelled = await pending;
                            const restarted = await parser.audit('x=2');
                            const closedParser = createBrowserPythonParser(); closedParser.close();
                            const closed = await closedParser.audit('x=3').then(() => 'unexpected-success', error => error.code);
                            times.sort((a,b) => a-b);
                            globalThis.parserProbe = parser;
                            return {replies, cancelled, restarted: restarted.tree.kind, closed, coldMs, warmP95Ms: times[Math.floor(times.length * .95)]};
                        } catch (error) { parser.close(); throw error; }
                    }''', corpus)
                    if result['replies'] != node['replies']:
                        (ROOT / 'test-results/python-parity-failure.json').write_text(json.dumps({'node': node['replies'], 'browser': result['replies'], 'coldMs': result['coldMs']}, ensure_ascii=True, indent=2), encoding='utf-8')
                    differences = [item['id'] for item, actual, expected in zip(corpus, result['replies'], node['replies']) if actual != expected]
                    assert result['replies'] == node['replies'], f'Full AST/token/binding/diagnostic parity failed under {policy}: {differences}, cold={result["coldMs"]}ms'
                    assert result['cancelled'] == 'aborted' and result['restarted'] == 'Module' and result['closed'] == 'closed'
                    assert not errors, errors
                    metrics['browser'][policy] = {key: result[key] for key in ('coldMs', 'warmP95Ms')}
                    # The loaded isolated runtime needs no further host/network access.
                    # Cold offline reload is not a product feature (there is no service worker).
                    context.set_offline(True)
                    offline = page.evaluate('''async () => {
                        const parser = globalThis.parserProbe;
                        try { return (await parser.audit('x=1', {timeoutMs: 5000})).tree.kind; }
                        finally { parser.close(); }
                    }''')
                    assert offline == 'Module', offline
                assert not external, external
                context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
(ROOT / 'test-results/python-platform.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
print(f'PASS Python platform: {len(corpus)} full Node/Chromium DTO cases, scoped worker CSP / Pages subpath, lazy same-origin assets, warm offline runtime, cancel/restart/close; strict CSP fails closed')
print(json.dumps(metrics))
