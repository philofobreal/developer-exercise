/** 64-bit, non-cryptographic digest of the ordered line IDs, texts and scopes, as 16 hex digits. */
export function codeLineDigest(lines) {
    return digest(JSON.stringify(lines.map(line => [line.id, line.code, line.scopeId])));
}
/** ADR-044: digest of the reference source alone (the line texts in reference order). An author
 * relaxation holds for the source it was confirmed on; IDs and scopes do not change what runs. */
export function sourceTextDigest(lines) {
    return digest(JSON.stringify(lines.map(line => line.code)));
}
function digest(text) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const unit = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ unit, 2654435761);
        h2 = Math.imul(h2 ^ unit, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
/** `current`: the evidence describes these lines; `stale`: they changed since; `absent`: no evidence. */
export function evidenceStatus(model) {
    const evidence = model.authoring?.evidence;
    if (!evidence)
        return 'absent';
    return evidence.sourceDigest === codeLineDigest(model.lines) ? 'current' : 'stale';
}
//# sourceMappingURL=evidence.js.map