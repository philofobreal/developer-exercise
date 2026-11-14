/** Who the client is (ADR-151). Directly reached, the client is the socket's peer. Behind reverse proxies the peer is
 * the last proxy, and only the proxies the operator runs can be believed about who called them: each appends its own
 * peer to `X-Forwarded-For`, so with `n` trusted proxies the client is the entry `n` places from the right. Everything
 * to its left is the client's own claim and is ignored.
 *
 * Hidden here: the header, its list format and the counting. The rate limit and the author gate ask for one address. */
import type { IncomingMessage } from 'node:http';
/** The proxy count named by `CODELINE_TRUSTED_PROXIES`; unset, the server is reached directly (0). A value that is
 * not such a count fails instead of trusting a header nobody vouches for. */
export declare function trustedProxyCount(value: string | undefined): number;
/** The address of the client of this request. A request that did not pass the whole trusted chain (the header is
 * shorter than the chain) is attributed to the socket's peer: that is who verifiably sent it. */
export declare function clientAddress(req: Pick<IncomingMessage, 'headers' | 'socket'>, trustedProxies?: number): string;
