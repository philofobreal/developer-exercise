/** Transitional clipboard port; implementation is covered by clipboard regressions. */
export function readClipboard(options?:{limit?:number;clipboard?:Pick<Clipboard,'readText'>}):Promise<string>;
export function copyToClipboard(value:string,options?:{clipboard?:Pick<Clipboard,'writeText'>;document?:Document}):Promise<boolean>;
