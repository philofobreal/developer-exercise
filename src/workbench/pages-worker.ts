/**
 * ADR-125 (NY-32): the Local Demo's engine in a module worker. The build's `vendor/typescript.mjs` is the shipped
 * compiler unchanged, ending with `globalThis.ts = ts`, which the engine reads when it is called; the engine itself is
 * the transitional `pages-api.js` (ADR-001), answering `local-demo`'s calls through worker-rpc. Only the Pages build
 * starts this worker.
 */
import '../vendor/typescript.mjs';
import * as engine from './pages-api.js';
import {serve} from './worker-rpc.js';

serve(self,engine);
