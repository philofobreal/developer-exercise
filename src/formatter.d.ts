/** Transitional formatter port, not a declaration of full formatter migration. */
export type Beautifier=(source:string,options?:Readonly<Record<string,unknown>>)=>string;
export function beautifier():Beautifier|null;
/** The IDE projection of placed rows (ADR-112): nesting from the arrangement plus each row's own continuation
 * indent (`offset`, levels), in the reference's indent unit; one string per row. */
export function formatForIDE(rawLines:readonly (string|{code:string;normalization?:string;offset?:number})[],options?:{indentSize?:number}):string[];
/** The formatted reference's indent unit and each row's continuation indent in levels (ADR-112). */
export function referenceLayout(referenceRows:readonly (string|{code:string;normalization?:string})[]):{indentSize:number;offsets:number[]};
