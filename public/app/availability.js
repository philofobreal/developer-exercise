import { authorDraftPending, evidenceStale } from './author-workspace.js';
import { jsonPending } from './flow.js';
import { hasLocalSave } from './persistence.js';
import { escapeHtml } from './ui-utilities.js';
const ACTIONS = ['author-apply', 'author-check', 'authoring', 'format-solution', 'load-local', 'reset', 'rule-edit'];
const isAction = (value) => ACTIONS.includes(value);
const enabled = { state: 'enabled' };
const disabled = (reason) => ({ state: 'disabled', reason });
/** What a request for authoring is told where it is not served (a link from the help page can still ask). */
export const AUTHORING_NOT_SERVED = 'A feladatkészítés ezen a szerveren nem érhető el. A gyakorlás használható.';
export function availability(state, action, attempt) {
    switch (action) {
        case 'author-apply':
            if (!state.author.source.trim())
                return disabled('Nincs forrás: írj be kódot, vagy nyiss meg egy példát vagy fájlt.');
            if (state.authorBaseline && !authorDraftPending(state))
                return disabled('A modell naprakész: ebből a forrásból és ezekkel a beállításokkal készült.');
            return enabled;
        case 'author-check':
            return state.author.source.trim() ? enabled : disabled('Nincs forrás: írj be kódot, vagy nyiss meg egy példát vagy fájlt.');
        case 'authoring':
        case 'format-solution':
            return state.authoring === false ? { state: 'hidden' } : enabled;
        case 'load-local':
            return hasLocalSave() ? enabled : disabled('Ebben a böngészőben még nincs mentett munka. A Mentés a böngészőbe után nyitható meg.');
        case 'reset':
            return attempt && attempt.answer.some(id => id !== null) ? enabled : disabled('A megoldás üres, nincs mit újrakezdeni.');
        case 'rule-edit':
            if (jsonPending(state))
                return disabled('A CodeLine JSON-ban alkalmazatlan módosítás van. Alkalmazd vagy vesd el, és utána szerkeszd itt a szabályokat.');
            if (evidenceStale(state))
                return disabled('A forrás vagy az elemzési beállítás megváltozott a modell óta. Készítsd újra a modellt, vagy vesd el a változtatásokat.');
            return enabled;
    }
}
/** The attributes that mark a control disabled with its reason (empty when it is enabled). */
export function disabledAttributes(answer) {
    return answer.state === 'disabled' ? ` aria-disabled="true" data-disabled-reason="${escapeHtml(answer.reason)}" title="${escapeHtml(answer.reason)}"` : '';
}
/** The reason a disabled answer gives, or '' (for the handlers' own last check). */
export const reasonOf = (answer) => answer.state === 'disabled' ? answer.reason : '';
/** The attributes for a control whose availability can change without a redraw (typing in the source editor, a save):
 *  its action name and its current answer. `refreshAvailability` keeps them current. */
export function availabilityAttributes(state, action, attempt) {
    return ` data-availability="${action}"${disabledAttributes(availability(state, action, attempt))}`;
}
/** Updates every control marked with data-availability in place, after an input that does not redraw the view. */
export function refreshAvailability(root, state, attempt) {
    for (const control of root.querySelectorAll('[data-availability]')) {
        const action = control.dataset.availability;
        if (!isAction(action))
            continue;
        const answer = availability(state, action, attempt);
        if (answer.state === 'disabled') {
            control.setAttribute('aria-disabled', 'true');
            control.dataset.disabledReason = answer.reason;
            control.title = answer.reason;
        }
        else if (control.getAttribute('aria-disabled') === 'true') {
            control.removeAttribute('aria-disabled');
            delete control.dataset.disabledReason;
            control.removeAttribute('title');
        }
    }
}
