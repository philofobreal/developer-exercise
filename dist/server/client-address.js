const MAX_TRUSTED_PROXIES = 8;
/** The proxy count named by `CODELINE_TRUSTED_PROXIES`; unset, the server is reached directly (0). A value that is
 * not such a count fails instead of trusting a header nobody vouches for. */
export function trustedProxyCount(value) {
    if (value === undefined || value === '')
        return 0;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 0 || count > MAX_TRUSTED_PROXIES)
        throw Error(`Invalid CODELINE_TRUSTED_PROXIES: ${value} (0–${MAX_TRUSTED_PROXIES})`);
    return count;
}
/** The address of the client of this request. A request that did not pass the whole trusted chain (the header is
 * shorter than the chain) is attributed to the socket's peer: that is who verifiably sent it. */
export function clientAddress(req, trustedProxies = 0) {
    const peer = req.socket.remoteAddress ?? '';
    if (trustedProxies <= 0)
        return peer;
    const header = req.headers['x-forwarded-for'], text = Array.isArray(header) ? header.join(',') : header ?? '';
    const chain = text.split(',').map(entry => entry.trim()).filter(Boolean);
    return chain[chain.length - trustedProxies] ?? peer;
}
//# sourceMappingURL=client-address.js.map