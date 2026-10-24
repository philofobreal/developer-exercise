/** Reference IDs and server-computed witnesses; no inference from UI drag IDs. */
import { escapeHtml as esc } from './ui-utilities.js';
const snippet = (code) => esc(code.length > 160 ? code.slice(0, 157) + '…' : code);
const dependencies = (line) => line?.dependencies?.map(id => '#' + id).join(', ') || '—';
export function renderDependencyTable(model) {
    if (!model)
        return '';
    return `<details class="dependency-details" data-dependency-table data-memory="dependencies"><summary>Függőségek és eredeti forrássorok</summary><p>A dependencies sorazonosítókra hivatkozik. Minden felsorolt sor korábban álljon; közéjük más sorok is kerülhetnek. Az ID átrendezéskor megmarad, a forrássorszám tájékoztató adat.</p><div class="dependency-scroll"><table><thead><tr><th>Sor-ID</th><th>Eredeti forrássor</th><th>Kód</th><th>Előzmény-ID-k (mind szükséges)</th></tr></thead><tbody>${model.lines.map(line => `<tr data-reference-line="${line.id}"><td>#${line.id}</td><td>${line.sourceLine ?? '—'}</td><td><code>${snippet(line.code)}</code></td><td>${dependencies(line)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
export function renderWitness(report, exercise, model) {
    if (report?.status !== 'accepted' || !Array.isArray(report.matchedTokenIds))
        return '';
    const byToken = new Map(exercise.lines.map(line => ['n:' + line.id, line]));
    return `<details class="dependency-details" data-validation-witness data-memory="witness"><summary>Kiértékelés: soronkénti megfeleltetés</summary><p>A kiértékelő által talált érvényes megfeleltetés. Azonos tartalmú soroknál több érvényes megfeleltetés is létezhet.</p><div class="dependency-scroll"><table><thead><tr><th>Megoldássor</th><th>Referencia-ID</th><th>Eredeti forrássor</th><th>Kód</th>${model ? '<th>Előzmény-ID-k</th>' : ''}</tr></thead><tbody>${report.matchedTokenIds.map((token, index) => { const line = byToken.get(token); return `<tr data-witness-position="${index + 1}"><td>${index + 1}</td><td>${line ? '#' + line.id : esc(token)}</td><td>${line?.sourceLine ?? '—'}</td><td><code>${snippet(line?.code ?? '')}</code></td>${model ? `<td>${dependencies(model.lines.find(x => x.id === line?.id))}</td>` : ''}</tr>`; }).join('')}</tbody></table></div></details>`;
}
