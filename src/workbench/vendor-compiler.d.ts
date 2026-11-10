/** ADR-127 (P1): the Local Demo worker's compiler port, loaded on demand. The build writes `vendor/typescript.mjs` (the
 *  shipped compiler, setting `globalThis.ts`); the module has no exports the worker reads. */
declare module '*/vendor/typescript.mjs';
