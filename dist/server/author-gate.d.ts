import type { IncomingMessage } from 'node:http';
export interface AuthorRefusal {
    status: 401 | 403;
    error: string;
}
/** `null` when the request may use the author API, else the refusal.
 * - Cross-site browser requests are refused in every mode (CSRF).
 * - With a configured token only `Authorization: Bearer <token>` is accepted.
 * - Without a token only a loopback client addressing a loopback host is accepted, which also
 *   refuses DNS-rebinding pages that reach 127.0.0.1 under a foreign name.
 * `client` is the request's client address when the caller knows it better than the socket does (behind trusted
 * proxies the socket's peer is the proxy, often on loopback; ADR-151). */
export declare function authorRefusal(req: Pick<IncomingMessage, 'headers' | 'socket'>, { token, client }?: {
    token?: string | undefined;
    client?: string;
}): AuthorRefusal | null;
