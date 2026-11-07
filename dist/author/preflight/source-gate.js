const describe = (diagnostics) => diagnostics.slice(0, 5).map(d => `${d.line}. sor: ${d.message} (${d.code})`).join(' · ');
/** The compiler's own access-before-declaration codes; a binding finding on the same line repeats them. */
const TDZ_CODES = new Set(['TS2448', 'TS2449', 'TS2450']);
export function sourceGate(audit, policy, binding) {
    const compiled = audit.diagnostics.map(d => ({ line: d.line, code: 'TS' + d.code, message: d.message, certainty: d.certainty, origin: d.context ? 'environment' : 'compiler' }));
    // C35: one list. A definite compiler report on a line stays the one report there (TDZ, not callable…);
    // a runtime finding replaces a possible TDZ report of the type check on its line.
    const found = (binding?.findings ?? []).filter(f => !compiled.some(d => d.line === f.line && d.certainty === 'definite'));
    const diagnostics = [...compiled.filter(d => !(d.certainty === 'possible' && TDZ_CODES.has(d.code) && found.some(f => f.line === d.line))), ...found.map(f => ({ line: f.line, code: f.code, message: f.message, certainty: f.certainty, origin: f.origin }))].sort((a, b) => a.line - b.line);
    const base = { gate: 'source-to-rules', diagnostics, policyFingerprint: policy.fingerprint, assumptions: binding ? [...audit.assumptions, 'binding-safety'] : audit.assumptions };
    if (audit.semantics === 'errors' || found.length) {
        const definite = diagnostics.filter(d => d.certainty === 'definite');
        const what = audit.semantics === 'errors' ? 'nyelvi hibát tartalmaz' : found.some(f => f.origin === 'runtime-order') ? 'futáskor biztosan hibát dob (inicializálás előtti hozzáférés)' : 'futáskor biztosan hibát dob (null/undefined vagy nem hívható érték)';
        return { ...base, verdict: 'blocked', admitted: false, completeness: 'within-supported-scope', message: `A referencia ${what}, ezért nem készült modell; a korábbi modell megmaradt. ${describe(definite)}` };
    }
    const blocked = policy.effective.unknownPolicy === 'block';
    const possible = diagnostics.filter(d => d.certainty === 'possible');
    if (binding?.completeness === 'budget-exceeded')
        return { ...base, verdict: 'inconclusive', admitted: !blocked, completeness: 'partial',
            message: `A kötéselemzés túllépte a költségkeretét, ezért nem teljes.${blocked ? ' A „tilt” beállítás miatt nem készült modell; ez nem jelenti, hogy a forrás hibás.' : ' Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.'}` };
    if (audit.semantics === 'ok' && !possible.length)
        return { ...base, verdict: 'passed', admitted: true, completeness: 'within-supported-scope', message: '' };
    // E2: a JavaScript type check's finding is a possible error: the program may still run as meant.
    if (audit.semantics === 'ok')
        return { ...base, verdict: 'inconclusive', admitted: !blocked, completeness: 'within-supported-scope',
            message: `A típusellenőrzés lehetséges hibát jelez (a JavaScript ettől még lefuthat). ${describe(possible)}${blocked ? ' A „tilt” beállítás miatt nem készült modell.' : ' Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.'}` };
    const why = audit.semantics === 'not-run'
        ? 'A nyelvi ellenőrzés itt nem futott le (nincs standard könyvtár, például a Local Demóban).'
        : `A forrás egy része projektkontextus nélkül nem ellenőrizhető${audit.unresolved.length ? ` (feloldatlan: ${audit.unresolved.slice(0, 5).join(', ')})` : ''}.`;
    return { ...base, verdict: 'inconclusive', admitted: !blocked, completeness: audit.semantics === 'not-run' ? 'not-run' : 'partial',
        message: blocked ? `${why} A „tilt” beállítás miatt nem készült modell; ez nem jelenti, hogy a forrás hibás.` : `${why} Továbbléphetsz, de a forrás nem tekinthető ellenőrzöttnek.` };
}
//# sourceMappingURL=source-gate.js.map