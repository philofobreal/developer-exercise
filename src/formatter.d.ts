/** Transitional formatter port, not a declaration of full formatter migration. */
export type Beautifier=(source:string,options?:Readonly<Record<string,unknown>>)=>string;
export function beautifier():Beautifier|null;
