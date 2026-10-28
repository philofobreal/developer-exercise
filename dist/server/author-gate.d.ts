import type { IncomingMessage } from 'node:http';
export interface AuthorRefusal {
    status: 401 | 403;
    error: string;
}
/** `null` when the request may use the author API, else the refusal.
 * - Cross-site browser requests are refused in every mode (CSRF).
 * - With a configured token only `Authorization: Bearer <token>` is accepted.
 * - Without a token only a loopback client addressing a loopback host is accepted, which also
 *   refuses DNS-rebinding pages that reach 127.0.0.1 under a foreign name. */
export declare function authorRefusal(req: Pick<IncomingMessage, 'headers' | 'socket'>, { token }?: {
    token?: string | undefined;
}): AuthorRefusal | null;
