import { evidenceStale } from './author-workspace.js';
import { renderFindingGroups } from './preflight-settings.js';
import { escapeHtml as esc } from './ui-utilities.js';
import { icon } from './icons.js';
import { renderInfo } from './help-topics.js';
/** Above this many rows a task is long for a learner to sort (the author's decision of 2026-11-09). */
export const LONG_TASK_ROWS = 100;
const RANK = { ok: 0, warning: 1, error: 2 };
const worst = (tones) => tones.reduce((a, b) => RANK[b] > RANK[a] ? b : a, 'ok');
const count = (n, noun) => `${n} ${noun}`;
/** The first gate's findings for the source the applied model was made from; none for another text. */
function modelSourceFindings(state) {
    const record = state.sourceGate, base = state.authorBaseline;
    return record && base && record.source === base.source ? record.gate.diagnostics : [];
}
/** One sentence on the undecided findings: those for missing project context (unresolved imports, undeclared globals)
 * leave the order analysis untouched; the rest are counted. */
function undecided(findings) {
    const open = findings.filter(item => item.certainty === 'unknown'), context = open.filter(item => item.origin === 'environment').length, other = open.length - context;
    const parts = [context ? `${count(context, 'sor')} a projekten kívüli modulra vagy névre hivatkozik, ezért a típusai nem ellenőrizhetők; a sorrend elemzését ez nem érinti` : '', other ? `${count(other, 'lelet')} nem dőlt el` : ''].filter(Boolean);
    return parts.length ? `A forrás vizsgálata nem dőlt el teljesen: ${parts.join('; ')}.` : '';
}
function fillable(state, verification, rows) {
    const base = { id: 'fillable', question: 'Kitölthető?' }, { checks } = verification;
    if (checks.admission === 'failed')
        return { ...base, tone: 'error', text: verification.findings[0] ?? 'A modell nem fogadható be.' };
    if (checks.reference === 'rejected')
        return { ...base, tone: 'error', text: 'A modell a saját referenciasorrendjét sem fogadja el.' };
    const findings = modelSourceFindings(state), gateOpen = state.sourceGate?.gate.verdict === 'inconclusive' && findings.length > 0;
    const warnings = [
        checks.reference === 'indeterminate' ? 'A referenciasorrend elfogadása a kereten belül nem dőlt el.' : '',
        gateOpen ? undecided(findings) : '',
        rows > LONG_TASK_ROWS ? `Hosszú feladat: ${rows} sor. ${LONG_TASK_ROWS} sor fölött a rendezés nehezen gyakorolható; érdemes egy osztályt vagy függvényt külön feladatba emelni.` : ''
    ].filter(Boolean);
    return warnings.length ? { ...base, tone: 'warning', text: [checks.reference === 'accepted' ? 'A referencia elfogadott.' : '', ...warnings].filter(Boolean).join(' ') } : { ...base, tone: 'ok', text: `A referencia elfogadott; ${rows} sor.` };
}
function checkable(verification) {
    const base = { id: 'checkable', question: 'Ellenőrizhető?' }, { checks } = verification;
    if (verification.publishable)
        return { ...base, tone: 'ok', text: 'Minden tanulói sorrendre eldönthető a válasz; a feladat publikálható.' };
    if (checks.admission === 'failed' || checks.reference === 'rejected')
        return { ...base, tone: 'error', text: 'Nem publikálható: a referencia nem fogadható el.' };
    if (checks.audit === 'errors')
        return { ...base, tone: 'error', text: 'Nem publikálható: a referencia nyelvi hibát tartalmaz.' };
    return { ...base, tone: 'warning', text: 'Nem minden tanulói sorrendre dönthető el a válasz a kereten belül: a tanuló „Nem eldönthető” eredményt kaphat, és a feladat nem publikálható.' };
}
function fair(state, verification) {
    const base = { id: 'fair', question: 'Igazságos?' }, { checks } = verification, meanings = state.authorInsight?.rules?.meanings ?? {};
    switch (verification.status) {
        case 'analysis-verified': return { ...base, tone: 'ok', text: 'Nem utasít el helyes sorrendet: elemzéssel igazolt.' };
        case 'conservative': {
            const kinds = Object.keys(checks.fallbacks.codes).map(code => meanings[code] ?? code);
            const parts = [checks.fallbacks.count ? `${count(checks.fallbacks.count, 'óvatos szabály')}: ${kinds.join(', ')}` : '', checks.projectionLoss ? `${count(checks.projectionLoss, 'sorpárt')} a sorokra bontás köt sorrendbe, bár az elemzés szabadon hagyta` : ''].filter(Boolean);
            return { ...base, tone: 'warning', text: `Néhány helyes sorrendet is elutasíthat (${parts.join('; ')}).`, ...(checks.fallbacks.count && state.authorInsight?.rules ? { action: 'rule-kinds' } : {}) };
        }
        case 'author-modified': {
            const parts = [checks.authorRules ? count(checks.authorRules, 'szűkítő szabály') : '', checks.fixed ? count(checks.fixed, 'rögzített sor') : '', checks.profiles ? count(checks.profiles, 'OR-profil') : '', checks.relaxations.conservative + checks.relaxations.overrides ? count(checks.relaxations.conservative + checks.relaxations.overrides, 'feloldott szabály') : ''].filter(Boolean);
            return { ...base, tone: 'warning', text: `A szerző döntése szerint${parts.length ? ` (${parts.join(', ')})` : ''}: ezt az elemzés nem igazolja.` };
        }
        case 'unverified': return { ...base, tone: 'warning', text: `Nem igazolt: ${verification.findings[0] ?? 'a modellhez nincs elemzési bizonyíték.'}` };
    }
}
/** The status of the applied author model; undefined without one, or while the source or settings changed since it was made. */
export function taskStatus(state) {
    const verification = state.authorInsight?.verification, model = state.authorModel;
    if (!verification || !model || evidenceStale(state))
        return undefined;
    const answers = [fillable(state, verification, model.lines.length), checkable(verification), fair(state, verification)];
    const gate = state.authorInsight?.tryGate, refused = !!gate && !gate.admitted, tone = refused ? 'error' : worst(answers.map(answer => answer.tone));
    const next = refused ? { text: gate.message, action: 'source' }
        : tone === 'error' ? { text: 'Javítsd a forrást, és készítsd újra a modellt.', action: 'source' }
            : tone === 'warning' ? { text: 'A figyelmeztetések nem akadályozzák a próbát: döntsd el, javítasz-e rajtuk, vagy így próbálod ki tanulóként.', action: 'try' }
                : { text: 'Próbáld ki tanulóként.', action: 'try' };
    return { tone, answers, next };
}
/** The stepper's word for the Rules step: the card's overall tone. */
export const TONE_WORD = { ok: 'Kész', warning: 'Figyelem', error: 'Hiba' };
const VERDICT = { ok: 'Igen', warning: 'Részben', error: 'Nem' };
const SHOW_RULE_KINDS = `<button type="button" class="btn" data-show-rule-kinds>${icon('link')}<span>Megmutatom</span></button>`;
/** The card at the top of the Rules step: three answers and the source findings grouped by cause. The next step is the
 * step's action bar (ADR-123), which reads `taskStatus` too. */
export function renderTaskStatus(state) {
    const status = taskStatus(state);
    if (!status)
        return '';
    const answers = status.answers.map(answer => `<li class="task-answer tone-${answer.tone}" data-task-answer="${answer.id}"><div class="task-question"><b>${answer.question}</b>${renderInfo(answer.id, answer.question)}</div><span class="task-verdict"><span class="status-dot" aria-hidden="true"></span>${VERDICT[answer.tone]}</span><span class="task-text">${esc(answer.text)}</span>${answer.action ? SHOW_RULE_KINDS : ''}</li>`).join('');
    const findings = modelSourceFindings(state);
    const details = findings.length ? `<details class="task-findings" data-memory="task-findings"><summary>Részletek: a forrás leletei okonként</summary>${renderFindingGroups(findings)}</details>` : '';
    return `<section class="task-status tone-${status.tone}" data-task-status aria-labelledby="task-status-title"><h3 id="task-status-title">A feladat állapota</h3><ul class="task-answers">${answers}</ul>${details}</section>`;
}
