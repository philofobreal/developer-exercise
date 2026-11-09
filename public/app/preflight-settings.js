import { escapeHtml as esc } from './ui-utilities.js';
/** ADR-106: the environment a new reference starts from (the author's choice): plain valid inputs, key order not
 * observed, standard class fields. A model brought in by JSON, a session or an admission keeps its own settings. */
export const NEW_DRAFT_SETTINGS = { inputs: 'valid', keyOrder: 'ignored', classFields: 'define' };
/** The groups of the plan (§6); the pedagogical ordering group waits for its analyzer (ADR-108, deviation 2). */
const GROUPS = [
    { title: 'Elemzési környezet', intro: 'Milyen környezetben fut a referencia: ettől függ, mely sorok cserélhetők fel.', settings: [
            { path: 'importEmit', label: 'Importok kibocsátása', language: 'typescript', start: 'verbatim', hint: 'A buildbeállításod szerint: verbatimModuleSyntax / preserveValueImports esetén verbatim. Az import-sorok szabadsága ettől függ.', choices: [
                    { value: 'verbatim', label: 'verbatim · minden import megmarad', short: 'verbatim' }, { value: 'elide-unused', label: 'elide-unused · a csak típusként használt import kimarad', short: 'elide-unused' }
                ] },
            { path: 'inputs', label: 'Bemenetek', start: NEW_DRAFT_SETTINGS.inputs, legacy: 'any', hint: 'Érvényes adatnál a bemenetek olvasása és a beépített, nem módosító műveletek (például join, Math.max) egymáshoz képest szabadok; a hibás vagy trükkös bemenetet ekkor nem vizsgáljuk. Ha a program maga módosíthatja a tulajdonságolvasást (Proxy, prototípus), az elemzés szigorú marad.', choices: [
                    { value: 'any', label: 'Szigorú · bármilyen érték, trükkös objektumok is', short: 'szigorú bemenet' }, { value: 'valid', label: 'Érvényes egyszerű adat · számok, szövegek, tömbök, sima objektumok', short: 'érvényes adat' }
                ] },
            { path: 'keyOrder', label: 'Objektumkulcsok sorrendje', start: NEW_DRAFT_SETTINGS.keyOrder, legacy: 'observed', hint: 'Object.keys, JSON.stringify, for…in. Nem számít esetén a kulcsokat létrehozó sorok egymáshoz képest cserélhetők, mint a toEqual vagy deepStrictEqual összehasonlításnál. Ne válaszd, ha a program a kulcsok sorrendjéből számol.', choices: [
                    { value: 'observed', label: 'Számít · a kulcsok létrehozási sorrendje a megoldás része', short: 'kulcssorrend számít' }, { value: 'ignored', label: 'Nem számít · a kulcsokat sorrendjüktől függetlenül hasonlítjuk', short: 'kulcssorrend nem számít' }
                ] },
            { path: 'classFields', label: 'Osztálymezők létrehozása', start: NEW_DRAFT_SETTINGS.classFields, legacy: 'either', hint: 'A régi értékadásos módban egy mező létrehozása lefuttatja az ős azonos nevű setterét, ezért az ilyen mezők sorrendje kötött. Ne válaszd, ha a kódot régebbi célra fordítják.', choices: [
                    { value: 'either', label: 'Mindkét mód · szabványos definíció és régi értékadás is', short: 'mindkét mezőmód' }, { value: 'define', label: 'Csak szabványos · natív osztálymezők, useDefineForClassFields: true', short: 'szabványos mezők' }
                ] }
        ] },
    { title: 'Forrás biztonságossága', intro: 'Mit ellenőriz a Modell készítése, mielőtt a forrásból sorok és szabályok lesznek.', settings: [
            { path: 'tsDiagnostics', label: 'TypeScript-diagnosztika', language: 'typescript', start: 'baseline', hint: 'A szigorú mód a strict fordítóbeállításokkal ellenőriz; a hibái biztos fordítási hibák, és megállítják a modellkészítést.', choices: [
                    { value: 'baseline', label: 'Alap · a fordító alapbeállításai' }, { value: 'strict', label: 'Szigorú · strict fordítóbeállítások' }
                ] },
            { path: 'jsCheck', label: 'JavaScript típusellenőrzés', language: 'javascript', start: 'off', hint: 'Bekapcsolva a TypeScript fordító checkJs módban is átnézi a forrást. Amit csak ez talál, lehetséges hiba: figyelmeztet, vagy a „Nem eldönthető eredmények” beállítás szerint megállít.', choices: [
                    { value: 'off', label: 'Ki' }, { value: 'on', label: 'Be · checkJs' }
                ] },
            { path: 'objectState', label: 'Helyi objektumállapot', start: 'local', hint: 'Biztos TypeError, amelyet egy helyi változó deklarált értéke okoz: tagelérés null vagy undefined értéken, vagy egy nem függvény meghívása.', choices: [
                    { value: 'local', label: 'Ellenőrzi · biztos null/undefined elérés és nem függvény hívása' }, { value: 'off', label: 'Ki' }
                ] },
            { path: 'unknownPolicy', label: 'Nem eldönthető eredmények', start: 'warn', hint: 'Ha egy ellenőrzés nem tud dönteni (lehetséges hiba, kimerült keret, hiányzó könyvtár), az nem „hibás program”. Figyelmeztetésnél továbbléphetsz, tiltásnál nem. A biztos hiba mindig megállít.', choices: [
                    { value: 'warn', label: 'Figyelmeztet · továbbléphetsz' }, { value: 'block', label: 'Tilt · csak eldöntött eredménnyel lehet továbblépni' }
                ] }
        ] },
    { title: 'Haladó profil', intro: 'Előre beállított, együtt mozgó értékek.', settings: [
            { path: 'portability', label: 'Hordozhatóság', start: 'configured', hint: 'A konzervatív profil a környezeti beállításokat a legszigorúbb értékükre zárja: a megoldásnak minden környezetben helyes sorrendet kell adnia. A választásaid megmaradnak, és a profil kikapcsolásakor visszaállnak.', choices: [
                    { value: 'configured', label: 'Beállított környezet · a fenti választások szerint' }, { value: 'conservative', label: 'Konzervatív · minden környezeti beállítás a legszigorúbb értéken' }
                ] }
        ] }
];
const SETTINGS = GROUPS.flatMap(group => group.settings);
const TOP_LEVEL = new Set(['inputs', 'keyOrder', 'classFields', 'importEmit']);
const settingOf = (path) => SETTINGS.find(setting => setting.path === path);
const applies = (setting, language) => !setting.language || setting.language === language;
/** The value the author asked for (an absent one is the value an older model is read with). */
function requested(author, setting) {
    const value = TOP_LEVEL.has(setting.path) ? author[setting.path] : author.policy?.[setting.path];
    return value ?? setting.legacy ?? setting.start;
}
/** Records one choice from a control of this module; an unknown option or value changes nothing. */
export function setPreflightOption(author, path, value) {
    const setting = settingOf(path);
    if (!setting || !setting.choices.some(choice => choice.value === value))
        return false;
    if (TOP_LEVEL.has(setting.path))
        author[setting.path] = value;
    else
        author.policy = { ...author.policy, [setting.path]: value };
    return true;
}
/** The nested part of the request (`policy`), with the values a new exercise starts from left out. */
export function preflightRequest(author) {
    const entries = Object.entries(author.policy ?? {}).filter(([path, value]) => { const setting = settingOf(path); return setting && value !== setting.start && applies(setting, author.language); });
    return entries.length ? Object.fromEntries(entries) : undefined;
}
/** The settings part of a generation request: the source-contract options at the top level, where they differ
 * from the compatibility value (the import emit only for TypeScript, ADR-013), the preflight options under `policy`. */
export function settingsRequest(author) {
    const { importEmit, inputs, keyOrder, classFields } = author, policy = preflightRequest(author);
    return { ...(author.language === 'typescript' && importEmit === 'elide-unused' ? { importEmit } : {}), ...(inputs === 'valid' ? { inputs } : {}), ...(keyOrder === 'ignored' ? { keyOrder } : {}), ...(classFields === 'define' ? { classFields } : {}), ...(policy ? { policy } : {}) };
}
/** ADR-108 (E8): the settings recorded in a session file, as a request. A file is untrusted: an option or value the
 * controls do not offer refuses the import (it is never dropped silently); the resolver checks the rest again. */
export function readSettings(value) {
    const record = (item) => typeof item === 'object' && item !== null && !Array.isArray(item);
    const refuse = (what) => { throw Error(`Érvénytelen elemzési beállítás a munkamenetben: ${what}.`); };
    if (!record(value))
        return refuse('nem objektum');
    const author = { title: '', description: '', language: 'typescript', source: '', message: '' };
    const take = (path, item) => { if (typeof item !== 'string' || !setPreflightOption(author, path, item))
        refuse(`${path}=${String(item)}`); };
    for (const [path, item] of Object.entries(value)) {
        if (path === 'policy') {
            if (!record(item))
                refuse('policy');
            else
                for (const [nested, option] of Object.entries(item)) {
                    if (TOP_LEVEL.has(nested))
                        refuse(`policy.${nested}`);
                    take(nested, option);
                }
        }
        else if (TOP_LEVEL.has(path))
            take(path, item);
        else
            refuse(path);
    }
    const { importEmit, inputs, keyOrder, classFields, policy } = author;
    return { ...(importEmit ? { importEmit } : {}), ...(inputs ? { inputs } : {}), ...(keyOrder ? { keyOrder } : {}), ...(classFields ? { classFields } : {}), ...(policy ? { policy } : {}) };
}
/** ADR-108 (E8): what the author should know about settings that were not their own choices in this session. */
export function renderSettingsOrigin(origin) {
    if (origin === 'partial')
        return '<p class="settings-origin" data-settings-origin="partial" role="note">A betöltött modell nem rögzítette minden elemzési beállítását (régebbi munkamenet vagy JSON-modell). A modell saját környezeti adatait használtuk, a többit az új feladat kezdőértékével ellenőriztük. Az eredeti forrás és a beállítások hitelessége ezért részleges; ha mást szeretnél, állítsd be és készítsd újra a modellt.</p>';
    if (origin === 'recorded')
        return '<p class="settings-origin" data-settings-origin="recorded" role="note">Az elemzési beállítások a betöltött munkamenetből származnak; a modellt ezekkel újra ellenőriztük.</p>';
    return '';
}
/** Equal for two drafts exactly when a resolution of one is a resolution of the other. */
export const settingsKey = (author) => JSON.stringify([author.language, settingsRequest(author)]);
/** Whether `resolution` answers the author's current request (the resolver echoes what it was asked). */
function answers(resolution, author) {
    if (!resolution || resolution.language !== (author.language === 'typescript' ? 'typescript' : 'javascript'))
        return false;
    const { policy, ...top } = settingsRequest(author), asked = { ...top, ...policy };
    // A refused value is not echoed; its conflict names the path instead.
    const refused = new Set(resolution.conflicts.map(conflict => conflict.path.replace(/^policy\./, '')));
    const keys = new Set([...Object.keys(asked), ...Object.keys(resolution.requested)]);
    return [...keys].every(key => refused.has(key) || asked[key] === resolution.requested[key]);
}
const choiceLabel = (setting, value) => setting.choices.find(choice => choice.value === value)?.label.split(' · ')[0] ?? value;
const suffix = (setting, value) => value === setting.start ? ' (új feladat kezdőértéke)' : value === setting.legacy ? ' (régi modellek kompatibilitási értéke)' : '';
const controlId = (path) => `preflight-${path}`;
/** `environment`: the values not offered where the analysis runs (C16), whatever the request; `resolution` answers it. */
function control(setting, author, resolution, environment) {
    const lock = resolution?.locks.find(item => item.path === setting.path), asked = requested(author, setting), shown = lock ? lock.effective : asked;
    const off = environment.filter(item => item.path === setting.path), inactive = resolution?.inactive.find(item => item.path === setting.path);
    const options = setting.choices.map(choice => { const unavailable = off.some(item => item.value === choice.value); return `<option value="${esc(choice.value)}"${choice.value === shown ? ' selected' : ''}${unavailable ? ' disabled' : ''}>${esc(choice.label + suffix(setting, choice.value) + (unavailable ? ' (csak szerveren)' : ''))}</option>`; }).join('');
    const hintId = `${controlId(setting.path)}-hint`, whyId = `${controlId(setting.path)}-why`;
    const notes = [inactive?.reason, ...off.filter(item => item.value !== shown || !inactive).map(item => item.reason)].filter((note, index, all) => !!note && all.indexOf(note) === index);
    const why = lock ? `<details class="lock-why" data-lock-why="${esc(setting.path)}"><summary>Miért?</summary><p id="${whyId}">${esc(lock.reason)} Feloldás: állítsd a Hordozhatóságot „Beállított környezet” értékre${asked !== lock.effective ? `; ekkor a választásod („${esc(choiceLabel(setting, asked))}”) visszaáll` : ''}.</p></details>` : '';
    return `<div class="preflight-setting${lock ? ' locked' : ''}" data-preflight-setting="${esc(setting.path)}"><label for="${controlId(setting.path)}">${esc(setting.label)}${lock ? ' <span class="lock-label">zárolva</span>' : ''}</label><select id="${controlId(setting.path)}" data-preflight="${esc(setting.path)}" aria-describedby="${lock ? whyId + ' ' : ''}${hintId}" ${lock ? 'disabled' : ''}>${options}</select>${why}<small class="inline-hint" id="${hintId}">${esc(setting.hint)}</small>${notes.map(note => `<small class="inline-hint server-only" data-server-only="${esc(setting.path)}">${esc(note)}</small>`).join('')}</div>`;
}
/** One line: the environment as the analysis will run it, the source checks, how unknowns are treated, the profile and locks. */
function summary(author, resolution) {
    const value = (path) => { const setting = settingOf(path); return resolution?.locks.find(lock => lock.path === path)?.effective ?? requested(author, setting); };
    const short = (path) => { const setting = settingOf(path), current = value(path); return setting.choices.find(choice => choice.value === current)?.short ?? current; };
    const typescript = author.language === 'typescript';
    const environment = ['inputs', 'keyOrder', 'classFields', ...(typescript ? ['importEmit'] : [])].map(short);
    const checks = ['kötések', value('objectState') === 'local' ? 'objektumállapot' : '', typescript ? (value('tsDiagnostics') === 'strict' ? 'strict TS' : '') : (value('jsCheck') === 'on' ? 'checkJs' : '')].filter(Boolean);
    const locks = resolution?.locks.length ?? 0;
    return [...environment, 'ellenőrzés: ' + checks.join(', '), value('unknownPolicy') === 'block' ? 'bizonytalan: tilt' : 'bizonytalan: figyelmeztet', value('portability') === 'conservative' ? 'konzervatív profil' : '', locks ? `${locks} zárolt` : ''].filter(Boolean).join(' · ');
}
/** The folded settings block of the Source step, from the author's request and its last resolution. */
export function renderPreflightSettings(author, resolution, origin) {
    const current = answers(resolution, author) ? resolution : undefined;
    // What the environment does not offer depends on the language only, so a resolution for an earlier request still says it.
    const environment = resolution && resolution.language === (author.language === 'typescript' ? 'typescript' : 'javascript') ? resolution.unavailable ?? [] : [];
    const conflicts = current?.conflicts.filter(conflict => conflict.blocking) ?? [];
    const groups = GROUPS.map(group => { const settings = group.settings.filter(setting => applies(setting, author.language)); return settings.length ? `<fieldset class="preflight-group"><legend>${esc(group.title)}</legend><p class="inline-hint">${esc(group.intro)}</p><div class="options-grid">${settings.map(setting => control(setting, author, current, environment)).join('')}</div></fieldset>` : ''; }).join('');
    return `<details class="analysis-options" data-memory="analysis-options"><summary><b>Elemzési beállítások</b><span data-preflight-summary>${esc(summary(author, current))}</span></summary>${renderSettingsOrigin(origin)}${conflicts.length ? `<ul class="preflight-conflicts" role="alert">${conflicts.map(conflict => `<li>${esc(conflict.message)}</li>`).join('')}</ul>` : ''}${groups}</details>`;
}
const CERTAINTY = { definite: 'Biztos hiba', possible: 'Lehetséges hiba', unknown: 'Nem eldönthető' };
const ORIGIN = { compiler: 'fordító', 'runtime-order': 'futási sorrend', 'runtime-value': 'futási érték', environment: 'környezet' };
/** The first gate's findings for the source they were made from; for another text, a note that they may be out of date. */
export function renderSourceDiagnostics(gate, stale) {
    if (!gate || !gate.diagnostics.length)
        return '';
    const title = gate.verdict === 'blocked' ? 'A modell nem készült el: a forrás hibás' : gate.verdict === 'inconclusive' ? 'A forrás vizsgálata nem dőlt el teljesen' : 'Megjegyzések a forráshoz';
    const items = gate.diagnostics.map(item => `<li class="diagnostic certainty-${item.certainty}" data-diagnostic="${esc(item.code)}"><span class="diagnostic-kind">${esc(CERTAINTY[item.certainty])}</span><button type="button" class="diagnostic-line" data-goto-line="${item.line}" aria-label="Ugrás a(z) ${item.line}. sorra a forrásban">${item.line}. sor</button><span class="diagnostic-message">${esc(item.message)}</span><small class="diagnostic-origin">${esc(ORIGIN[item.origin])} · ${esc(item.code)}</small></li>`).join('');
    return `<section class="source-diagnostics verdict-${gate.verdict}" data-source-diagnostics aria-labelledby="source-diagnostics-title"><h3 id="source-diagnostics-title">${esc(title)}</h3>${stale ? '<p class="inline-hint" data-diagnostics-stale>A forrás azóta változott; a lista a legutóbbi ellenőrzéshez tartozik.</p>' : ''}<ol>${items}</ol></section>`;
}
