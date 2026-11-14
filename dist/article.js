/** NY-41 (ADR-148): the Hungarian definite article before what follows, as it is read aloud. A message that names a
 * row by its number or a line by its code cannot know the next sound when it is written, so it wrote „A(z)”; this
 * module decides it. Hidden here: how a number and how a piece of code is read.
 * - A number is read as a Hungarian numeral: „az” before egy (1), öt (5), ötven (50–59), ötszáz (500–599), ezer
 *   (1000–1999) and the thousands and millions they lead; „a” before every other.
 * - Text is read from its first sounded character; quotes, spaces and an identifier's leading `_` or `$` are not
 *   sounded. A lone letter is read by its Hungarian name (ef, el, em, en, er, es, iksz, ipszilon begin with a vowel).
 *   A word is read by its first letter, with the English „u” that sounds as „ju” (use, user, unit, util) as a consonant.
 *   Among symbols only `=` (egyenlőségjel) and `&` (és-jel) begin with a vowel.
 * This is a reading convention, not a pronouncing dictionary: an English word may still be read otherwise. */
const VOWELS = 'aáeéiíoóöőuúüű';
const VOWEL_NAMED_LETTERS = VOWELS + 'flmnrsxy';
const form = (vowel, capital) => vowel ? (capital ? 'Az' : 'az') : (capital ? 'A' : 'a');
function beforeNumber(value) {
    let lead = Math.trunc(Math.abs(value));
    if (lead >= 1000) {
        while (lead >= 1000)
            lead = Math.floor(lead / 1000);
        if (lead === 1)
            return true;
    }
    const digit = lead >= 100 ? Math.floor(lead / 100) : lead >= 10 ? Math.floor(lead / 10) : lead;
    return digit === 5 || lead === 1;
}
function beforeText(text) {
    const sounded = text.replace(/^[\s„”"'`“‘’]+/u, '').replace(/^[_$]+(?=[\p{L}\p{N}])/u, '');
    const digits = /^\d+/.exec(sounded);
    if (digits)
        return beforeNumber(Number(digits[0]));
    const first = sounded.charAt(0).toLowerCase();
    if (!first)
        return false;
    if (!/\p{L}/u.test(first))
        return first === '=' || first === '&';
    if (!/^.[\p{L}\p{N}_$]/u.test(sounded))
        return VOWEL_NAMED_LETTERS.includes(first);
    if (/^u(?:s[aei]|ni|ti)/i.test(sounded))
        return false;
    return VOWELS.includes(first);
}
/** „a” or „az” before `next`; `capital` for the first word of a sentence. */
export function article(next, capital = false) {
    return form(typeof next === 'number' ? beforeNumber(next) : beforeText(next), capital);
}
/** `next` with its article before it: the usual way to name a row or a line in a sentence. */
export function withArticle(next, capital = false) {
    return article(next, capital) + ' ' + next;
}
//# sourceMappingURL=article.js.map