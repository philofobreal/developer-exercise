const describe = (diagnostics) => diagnostics.slice(0, 5).map(d => `${d.line}. sor: ${d.message} (${d.code})`).join(' · ');
export function sourceGate(audit, policy) {
    const diagnostics = audit.diagnostics.map(d => ({ line: d.line, code: 'TS' + d.code, message: d.message, certainty: d.certainty, origin: d.context ? 'environment' : 'compiler' }));
    const base = { gate: 'source-to-rules', diagnostics, policyFingerprint: policy.fingerprint, assumptions: audit.assumptions };
    if (audit.semantics === 'errors') {
        const definite = diagnostics.filter(d => d.certainty === 'definite');
        return { ...base, verdict: 'blocked', admitted: false, completeness: 'within-supported-scope', message: `A referencia nyelvi hibát tartalmaz, ezért nem készült modell; a korábbi modell megmaradt. ${describe(definite)}` };
    }
    const blocked = policy.effective.unknownPolicy === 'block';
    const possible = diagnostics.filter(d => d.certainty === 'possible');
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