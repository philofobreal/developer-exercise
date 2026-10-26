/** Typed author-time entry point. ASTs and parser infrastructure stay inside adapters. */
import { applyRuleEdits, codeLineDigest, compileCodeLineExercise, compileCodeLineExerciseV3, evidenceStatus, mergeAuthorRules, prepareRenderPlan, upgradeCodeLineExerciseV2, verifyModel } from '../../dist/index.js';
import {reconcileDependencies} from './dependency-refresh.js';
import type { CodeLineExercise, CodeLineExerciseV3, CompiledRules, IndentPolicy, LanguageIR, ModelVerification, RefreshReport, RenderPlan, RuleEdit, RuleEditResult, VerificationInput } from '../../dist/index.js';

export interface AuthorSource { source: string; title?: string; description?: string; }
export interface FormatResult { code: string; }
export interface LanguagePlugin {
  contractVersion: 1;
  id: string;
  adapterVersion: string;
  capabilities: { analysis: 'native-ir' | 'legacy-v2'; format: boolean };
  indentPolicy: IndentPolicy;
  analyze(input: AuthorSource): LanguageIR | Promise<LanguageIR>;
  format?: (source: string) => FormatResult | Promise<FormatResult>;
}
export class AdapterContractError extends Error {
  constructor(message: string) { super(message); this.name = 'AdapterContractError'; }
}

/** Explicit trusted-code registration only; no learner plugin loading or global mutable registry. */
export class LanguageEngine {
  private readonly plugins = new Map<string, Readonly<LanguagePlugin>>();

  register(plugin: LanguagePlugin): void {
    if (!plugin || plugin.contractVersion !== 1 || typeof plugin.id !== 'string' || !plugin.id || plugin.id.length > 140 || this.plugins.has(plugin.id) || typeof plugin.adapterVersion !== 'string' || !plugin.adapterVersion || typeof plugin.analyze !== 'function') throw new AdapterContractError('Érvénytelen, inkompatibilis vagy ismétlődő adapter.');
    if (!plugin.capabilities || !['native-ir', 'legacy-v2'].includes(plugin.capabilities.analysis) || typeof plugin.capabilities.format !== 'boolean' || plugin.capabilities.format !== (typeof plugin.format === 'function')) throw new AdapterContractError('Hibás adapter capability.');
    const policy = plugin.indentPolicy;
    if (!policy || !['presentation', 'semantic'].includes(policy.mode) || !['adapter', 'preserve'].includes(policy.display) || !Number.isInteger(policy.tabWidth) || policy.tabWidth < 1 || policy.tabWidth > 16 || policy.mode === 'semantic' && policy.display !== 'preserve') throw new AdapterContractError('Hibás adapter indent policy.');
    this.plugins.set(plugin.id, Object.freeze({ ...plugin, analyze: plugin.analyze.bind(plugin), ...(plugin.format ? { format: plugin.format.bind(plugin) } : {}), capabilities: Object.freeze({ ...plugin.capabilities }), indentPolicy: Object.freeze({ ...policy }) }));
  }

  languages(): string[] { return [...this.plugins.keys()]; }

  private plugin(language: string): Readonly<LanguagePlugin> {
    const plugin = this.plugins.get(language);
    if (!plugin) throw new AdapterContractError('Nem támogatott nyelv: ' + language);
    return plugin;
  }

  async generate(language: string, input: AuthorSource, identity: { id: string; revision: number } = { id: 'draft', revision: 1 }): Promise<{ model: CodeLineExerciseV3; compiled: CompiledRules; renderPlan: RenderPlan }> {
    const plugin = this.plugin(language);
    if (!input || typeof input.source !== 'string' || input.source.length > 50_000) throw new AdapterContractError('Legfeljebb 50 KB szerzői forrás támogatott.');
    const source = input.source.replace(/\r\n?/g, '\n');
    if (!source.trim() || /[\u2028\u2029]/.test(source)) throw new AdapterContractError('Üres forrás vagy nem támogatott sorhatár.');
    const ir = structuredClone(await plugin.analyze({ ...input, source }));
    const model: CodeLineExerciseV3 = { schemaVersion: 3, id: identity.id, revision: identity.revision, title: input.title ?? 'Saját feladat', description: input.description ?? 'Rendezd sorba a programkódot.', ir };
    const checked = compileCodeLineExerciseV3(model);
    if ('status' in checked) throw new AdapterContractError(checked.message);
    if (ir.language !== language || ir.source !== source || ir.analysis.sourceOrigin !== 'original' || ir.analysis.strategy !== (plugin.capabilities.analysis === 'legacy-v2' ? 'legacy-v2-projection' : 'native') || ir.indentPolicy.mode !== plugin.indentPolicy.mode || ir.indentPolicy.tabWidth !== plugin.indentPolicy.tabWidth || ir.indentPolicy.display !== plugin.indentPolicy.display) throw new AdapterContractError('Az adapter eredménye eltér a nyelvi/source/capability szerződéstől.');
    const renderPlan = prepareRenderPlan(model);
    if ('status' in renderPlan) throw new AdapterContractError(renderPlan.message);
    return { model, compiled: checked.compiled, renderPlan };
  }

  async format(language: string, source: string): Promise<FormatResult> {
    const plugin = this.plugin(language);
    if (!plugin.capabilities.format || !plugin.format) throw new AdapterContractError('Az adapter nem kínál szerzői formázást.');
    // Validate both inputs and formatted output through the author contract.
    await this.generate(language, { source });
    const formatted = await plugin.format(source);
    if (!formatted || typeof formatted.code !== 'string') throw new AdapterContractError('Hibás formázóeredmény.');
    await this.generate(language, { source: formatted.code });
    return { ...formatted };
  }
}

/** Narrow transitional ports; this does not claim the legacy MJS is type checked. */
export interface LegacyJSTSPorts {
  generate(input: AuthorSource & { language: 'javascript' | 'typescript'; importEmit?: 'verbatim' | 'elide-unused' }): CodeLineExercise | Promise<CodeLineExercise>;
  audit(model: CodeLineExercise): void | Promise<void>;
  format(source: string, language: 'javascript' | 'typescript'): FormatResult | Promise<FormatResult>;
}

/** Explicit author reanalysis: preserve reference identity/content, fixed slots and manual edges/profiles. */
export async function refreshLegacyDependencies(input: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate' | 'audit'>): Promise<CodeLineExercise> {
 return (await refreshAuthorModel(input, ports)).model;
}

/** Explicit author reanalysis that carries the author's rules, relaxations and notes over to
 * the regenerated constraints and reports every one it could not carry (ADR-018). */
export async function refreshAuthorModel(input: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate' | 'audit'>): Promise<{model: CodeLineExercise; report: RefreshReport}> {
 const snapshot = structuredClone(input), initial = compileCodeLineExercise(snapshot);
 if ('status' in initial) throw new AdapterContractError(initial.message);
 await ports.audit(snapshot);
 const generated = await ports.generate({source: snapshot.lines.map(line => line.code).join('\n'), language: snapshot.language, title: snapshot.title, description: snapshot.description});
 const checked = compileCodeLineExercise(generated);
 if ('status' in checked) throw new AdapterContractError(checked.message);
 await ports.audit(generated);
 const refreshed = reconcileDependencies(snapshot, generated);
 // The regenerated provenance now names the original line IDs: bind it to them (ADR-015).
 const evidence = generated.authoring?.evidence;
 if (evidence) refreshed.authoring = {...refreshed.authoring, evidence: {...evidence, sourceDigest: codeLineDigest(refreshed.lines)}};
 let merged: {model: CodeLineExercise; report: RefreshReport};
 try { merged = mergeAuthorRules(snapshot, refreshed); } catch (error) { throw new AdapterContractError(error instanceof Error ? error.message : 'A szerzői szabályok nem vihetők át.'); }
 const result = compileCodeLineExercise(merged.model);
 if ('status' in result) throw new AdapterContractError(result.message);
 return merged;
}

/** A batch of typed rule edits (ADR-018), requalified by the verification gate (ADR-017):
 * the edited model is never presented as analysed when an edit cannot be justified. */
export async function editAuthorModel(model: CodeLineExercise, edits: readonly RuleEdit[], ports: Pick<LegacyJSTSPorts, 'generate'>, input: Pick<VerificationInput, 'audit' | 'maxStates' | 'neighbours'> = {}): Promise<{result: RuleEditResult; verification?: ModelVerification}> {
 const result = applyRuleEdits(model, edits);
 return result.ok ? {result, verification: await verifyAuthorModel(result.model, ports, input)} : {result};
}

/** Model Verification Gate for a JS/TS v2 model (ADR-017). The generated constraints are
 * re-derived from the model's own source under its recorded import emit: they must equal
 * the regeneration, less the recorded relaxations (ADR-018), exactly (dependencies per line,
 * non-author edges and reasons), so neither a hand
 * edit nor forged provenance passes as analysis. The regeneration also supplies the
 * current analyser version and the projection loss; the core gate does the rest. */
export async function verifyAuthorModel(model: CodeLineExercise, ports: Pick<LegacyJSTSPorts, 'generate'>, input: Pick<VerificationInput, 'audit' | 'maxStates' | 'neighbours'> = {}): Promise<ModelVerification> {
 let rederivation: 'match' | 'differs' = 'differs', currentAnalyzer, projectionLoss;
 try {
  const importEmit = model.authoring?.evidence?.environment?.importEmit;
  const generated = await ports.generate({source: model.lines.map(line => line.code).join('\n'), language: model.language, title: model.title, description: model.description, ...(importEmit ? {importEmit} : {})});
  currentAnalyzer = generated.authoring?.evidence?.analyzer;
  projectionLoss = generated.authoring?.evidence?.projectionLoss?.pairs;
  reconcileDependencies(model, generated);
  const id = (generatedId: number): number => model.lines[generatedId - 1]!.id;
  const relaxed = new Set((model.authoring?.relaxations ?? []).map(entry => entry.before + ':' + entry.after)), kept = (edge: {before: number; after: number}): boolean => !relaxed.has(edge.before + ':' + edge.after);
  const author = new Set(evidenceStatus(model) === 'current' ? (model.authoring?.provenance ?? []).filter(entry => entry.category === 'author').map(entry => entry.before + ':' + entry.after) : []);
  const pairs = (edges: {before: number; after: number}[]): string => edges.map(edge => edge.before + ':' + edge.after).sort().join();
  const sameDependencies = generated.lines.every((line, index) => pairs(line.dependencies.map(before => ({before: id(before), after: model.lines[index]!.id})).filter(kept)) === pairs(model.lines[index]!.dependencies.map(before => ({before, after: model.lines[index]!.id}))));
  const sameEdges = pairs((generated.edges ?? []).map(edge => ({before: id(edge.before), after: id(edge.after)})).filter(kept)) === pairs((model.edges ?? []).filter(edge => !author.has(edge.before + ':' + edge.after)));
  const reasons = (entries: {before: number; after: number; category: string; code: string}[]): string => entries.map(entry => [entry.before, entry.after, entry.category, entry.code].join(':')).sort().join();
  const sameProvenance = reasons((generated.authoring?.provenance ?? []).map(entry => ({...entry, before: id(entry.before), after: id(entry.after)})).filter(kept)) === reasons((model.authoring?.provenance ?? []).filter(entry => entry.category !== 'author'));
  if (sameDependencies && sameEdges && sameProvenance) rederivation = 'match';
 } catch { rederivation = 'differs'; }
 return verifyModel(model, {...input, rederivation, ...(currentAnalyzer ? {currentAnalyzer} : {}), ...(projectionLoss === undefined ? {} : {projectionLoss})});
}

export function createLegacyJSTSBridge(language: 'javascript' | 'typescript', ports: LegacyJSTSPorts): LanguagePlugin {
  if (!['javascript', 'typescript'].includes(language) || !ports || ['generate', 'audit', 'format'].some(method => typeof ports[method as keyof LegacyJSTSPorts] !== 'function')) throw new AdapterContractError('Hibás JS/TS bridge port.');
  return {
    contractVersion: 1, id: language, adapterVersion: 'legacy-v2-bridge/1', capabilities: { analysis: 'legacy-v2', format: true },
    indentPolicy: { mode: 'presentation', tabWidth: 5, display: 'adapter' },
    async analyze(input) {
      const model = await ports.generate({ ...input, language });
      if (model.language !== language) throw new AdapterContractError('A bridge eltérő nyelvű modellt kapott.');
      await ports.audit(model);
      const upgraded = upgradeCodeLineExerciseV2(model, input.source);
      if ('status' in upgraded) throw new AdapterContractError(upgraded.message);
      return upgraded.ir;
    },
    format: source => ports.format(source, language)
  };
}
