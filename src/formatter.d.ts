/** Transitional formatter port, not a declaration of full formatter migration. */
export type Beautifier=(source:string,options?:Readonly<Record<string,unknown>>)=>string;
export function beautifier():Beautifier|null;
/** The IDE projection of placed rows: one formatted string per row (ADR-095/NY-28 port). */
export function formatForIDE(rawLines:readonly (string|{code:string;normalization?:string})[],options?:{language?:string;beautify?:Beautifier|null}):string[];
