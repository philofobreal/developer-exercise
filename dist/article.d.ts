/** „a” or „az” before `next`; `capital` for the first word of a sentence. */
export declare function article(next: string | number, capital?: boolean): string;
/** `next` with its article before it: the usual way to name a row or a line in a sentence. */
export declare function withArticle(next: string | number, capital?: boolean): string;
