"""Browser-safe v3/IR and JS/TS bridge contracts under a Pages subpath.
This is test infrastructure, not a Python source parser or language adapter.
"""
import threading
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
from browser_support import ROOT, launch, StaticServer


class Pages(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / '_site'), **kwargs)

    def do_GET(self):
        prefix = '/developer-exercise/'
        if not self.path.startswith(prefix):
            self.send_error(404)
            return
        self.path = self.path[len(prefix) - 1:]
        super().do_GET()

    def log_message(self, *args):
        pass


server = StaticServer(('127.0.0.1', 0), Pages)
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = launch(p)
        try:
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/developer-exercise/', wait_until='networkidle')
            report = page.evaluate('''async () => {
                const load = path => import(new URL(path, location.href));
                const core = await load('dist/index.js');
                const {LanguageEngine, createLegacyJSTSBridge} = await load('dist/author/engine.js');
                const {generateCodeLineExercise} = await load('author/generator.mjs');
                const {auditReference} = await load('author/audit.mjs');
                const {getLanguageAdapter} = await load('author/languages.mjs');
                const engine = new LanguageEngine();
                const ports = {
                    generate: input => generateCodeLineExercise(input, globalThis.ts),
                    audit: model => auditReference(model, globalThis.ts),
                    format: (source, language) => getLanguageAdapter(language).format(source, globalThis.ts)
                };
                const reports = [];
                for (const language of ['javascript', 'typescript']) {
                    engine.register(createLegacyJSTSBridge(language, ports));
                    const source = language === 'typescript' ? 'const n: number = 1;' : 'const n = 1;';
                    const {model, compiled, renderPlan} = await engine.generate(language, {source});
                    const result = core.validateSubmission(compiled, {exerciseId: model.id, revision: 1, lines: model.ir.lines.map(l => l.code)});
                    reports.push(result.status === 'accepted' && renderPlan.units.length === 1);
                }
                const codes = ['header', '    body', 'tail']; let offset = 0;
                const lines = codes.map((code, i) => {
                    const start = {offset, line: i + 1, column: 0}; offset += code.length;
                    const end = {offset, line: i + 1, column: code.length}; offset++;
                    return {id: 'l' + i, code, normalization: 'exact', sourceSpan: {start, end}};
                });
                const native = {schemaVersion: 3, id: 'browser-fixture', revision: 1, title: '', description: '', ir: {
                    irVersion: 1, language: 'indent-fixture', source: codes.join('\\n'), lines,
                    units: lines.map((l, i) => ({id: l.id, lineIds: [l.id], containerId: i === 1 ? 'suite' : null, bindingScopeId: 'module', dependencies: [], fixed: false})),
                    containers: [{id: 'suite', parentId: null, kind: 'suite'}], bindingScopes: [{id: 'module', parentId: null, kind: 'module'}],
                    boundaries: [{containerId: 'suite', unitId: 'l0', phase: 'after', action: 'open', virtual: true}, {containerId: 'suite', unitId: 'l2', phase: 'before', action: 'close', virtual: true}],
                    edges: [], profiles: [], indentPolicy: {mode: 'semantic', tabWidth: 4, display: 'preserve'},
                    analysis: {strategy: 'native', sourceOrigin: 'original', semanticEquivalenceProven: false}
                }};
                const compiled = core.compileCodeLineExerciseV3(native);
                if (compiled.status) throw Error(compiled.message);
                const body = {exerciseId: native.id, revision: 1, lines: codes};
                reports.push(core.validateSubmission(compiled.compiled, body).status === 'accepted');
                reports.push(core.validateSubmission(compiled.compiled, {...body, lines: ['header', 'body', 'tail']}).status === 'rejected');
                for (const name of ['language-ir-v1.schema.json', 'codeline-v3.schema.json']) reports.push((await fetch(new URL(name, location.href))).ok);
                return reports;
            }''')
            assert report and all(report), report
            assert not errors, errors
            print('PASS Chromium Pages subpath: JS/TS v3 bridge, native IR virtual suite, exact whitespace, standalone Schema and browser-safe module graph')
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
