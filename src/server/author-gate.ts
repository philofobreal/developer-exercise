/** Server-side author authorization (ADR-027). The decision is made here from the request alone:
 * a UI flag, a query parameter or a learner import never grants author rights. */
import {timingSafeEqual,createHash} from 'node:crypto';
import type {IncomingMessage} from 'node:http';
export interface AuthorRefusal {status:401|403;error:string;}
const LOOPBACK_ADDRESSES=new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const LOOPBACK_HOSTS=new Set(['localhost','127.0.0.1','[::1]']);
const CROSS_SITE:AuthorRefusal={status:403,error:'A szerzői API csak a saját oldalról hívható.'};
const hostName=(host:string|undefined):string=>{const value=(host??'').toLowerCase();return value.startsWith('[')?value.slice(0,value.indexOf(']')+1):value.split(':')[0]??'';};
const digest=(value:string):Buffer=>createHash('sha256').update(value).digest();
const sameOrigin=(origin:string,host:string|undefined):boolean=>{try{return new URL(origin).host.toLowerCase()===(host??'').toLowerCase();}catch{return false;}};
/** `null` when the request may use the author API, else the refusal.
 * - Cross-site browser requests are refused in every mode (CSRF).
 * - With a configured token only `Authorization: Bearer <token>` is accepted.
 * - Without a token only a loopback client addressing a loopback host is accepted, which also
 *   refuses DNS-rebinding pages that reach 127.0.0.1 under a foreign name. */
export function authorRefusal(req:Pick<IncomingMessage,'headers'|'socket'>,{token}:{token?:string|undefined}={}):AuthorRefusal|null {
  const site=req.headers['sec-fetch-site'];
  if(site!==undefined&&site!=='same-origin'&&site!=='none')return CROSS_SITE;
  const origin=req.headers.origin;
  if(origin!==undefined&&!sameOrigin(origin,req.headers.host))return CROSS_SITE;
  if(token){
    const given=/^Bearer (.+)$/.exec(req.headers.authorization??'')?.[1]??'';
    return timingSafeEqual(digest(given),digest(token))?null:{status:401,error:'A szerzői API hitelesítést igényel.'};
  }
  if(LOOPBACK_ADDRESSES.has(req.socket.remoteAddress??'')&&LOOPBACK_HOSTS.has(hostName(req.headers.host)))return null;
  return {status:403,error:'A szerzői API token nélkül csak helyi gépről érhető el (CODELINE_AUTHOR_TOKEN).'};
}
