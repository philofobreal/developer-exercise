const DEFAULT_LIB = 'lib.es2022.full.d.ts';
/** Unresolved modules, undeclared names and namespaces, and missing ambient typings. */
const CONTEXT_CODES = new Set([2307, 2792, 2304, 2552, 2503, 2580, 2582, 2583, 2584, 2591, 2688]);
const UNRESOLVED_MODULE = new Set([2307, 2792]);
export function createReferenceAuditor(compiler, library) {
    const libraries = new Map();
    const libraryFile = (fileName) => {
        const name = fileName.slice(fileName.lastIndexOf('/') + 1);
        if (!library || !/^lib\.[a-z0-9.]+\.d\.ts$/.test(name))
            return undefined;
        if (!libraries.has(name)) {
            const text = library(name);
            libraries.set(name, text === undefined ? undefined : compiler.createSourceFile(name, text, compiler.ScriptTarget.ES2022));
        }
        return libraries.get(name);
    };
    function audit(source, language) {
        const assumptions = ['single-file', 'target:es2022', 'module:esnext', 'non-strict', ...(language === 'javascript' ? ['javascript-binding-only'] : [])];
        if (!library || !libraryFile(DEFAULT_LIB))
            return { semantics: 'not-run', diagnostics: [], unresolved: [], assumptions: [...assumptions, 'no-standard-library'] };
        const fileName = 'reference.' + (language === 'typescript' ? 'ts' : 'js');
        const file = compiler.createSourceFile(fileName, source, compiler.ScriptTarget.ES2022, true, language === 'typescript' ? compiler.ScriptKind.TS : compiler.ScriptKind.JS);
        // Decorators are checked in TypeScript's legacy mode, the one frameworks such as Angular build with.
        let decorated = false;
        const scan = (node) => { if (compiler.isDecorator(node))
            decorated = true;
        else if (!decorated)
            compiler.forEachChild(node, scan); };
        scan(file);
        if (decorated)
            assumptions.push('experimental-decorators');
        const options = { target: compiler.ScriptTarget.ES2022, module: compiler.ModuleKind.ESNext, moduleResolution: compiler.ModuleResolutionKind.Bundler, allowJs: true, noEmit: true, types: [], skipDefaultLibCheck: true, experimentalDecorators: decorated, lib: [DEFAULT_LIB] };
        const host = {
            getSourceFile: name => name === fileName ? file : libraryFile(name),
            getDefaultLibFileName: () => DEFAULT_LIB, getDefaultLibLocation: () => '', writeFile: () => undefined, getCurrentDirectory: () => '', getDirectories: () => [],
            getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
            fileExists: name => name === fileName || !!libraryFile(name), readFile: () => undefined
        };
        const program = compiler.createProgram([fileName], options, host);
        const found = [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file), ...program.getGlobalDiagnostics()];
        const unresolved = new Set();
        const diagnostics = found.map(diagnostic => {
            const start = diagnostic.start ?? 0;
            if (UNRESOLVED_MODULE.has(diagnostic.code) && diagnostic.file === file && diagnostic.length)
                unresolved.add(file.text.slice(start + 1, start + diagnostic.length - 1));
            return { line: diagnostic.file === file ? file.getLineAndCharacterOfPosition(start).line + 1 : 0, code: diagnostic.code, message: compiler.flattenDiagnosticMessageText(diagnostic.messageText, ' ').slice(0, 300), context: CONTEXT_CODES.has(diagnostic.code) };
        });
        const semantics = diagnostics.some(diagnostic => !diagnostic.context) ? 'errors' : diagnostics.length ? 'unverifiable' : 'ok';
        return { semantics, diagnostics: diagnostics.slice(0, 20), unresolved: [...unresolved].slice(0, 50), assumptions: [...assumptions, 'lib:' + DEFAULT_LIB] };
    }
    return { audit };
}
//# sourceMappingURL=reference-audit.js.map