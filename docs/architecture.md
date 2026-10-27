# Architecture

The application has explicit authoring, compilation, evaluation and presentation boundaries. It contains no Angular runtime.

| Boundary | Public contract | Hidden responsibility |
| --- | --- | --- |
| Language adapters | parse, format, tokenize, structure, whitespace, optional analyzeDependencies/orderingRelations (language-independent relations, [ADR-011](adr/011-language-independent-ordering-relations.md); JS/TS typed effect summaries, [ADR-008](adr/008-effect-based-statement-ordering.md); sealed multi-row units and throw-free reads, [ADR-009](adr/009-sealed-units-and-throw-free-reads.md); reflectable property order, [ADR-010](adr/010-reflective-property-order.md); class evaluation phases and accessor pairs, [ADR-012](adr/012-class-evaluation-phases-and-accessor-pairs.md); local writes, clause chains and import emit, [ADR-013](adr/013-local-writes-clause-chains-and-imports.md)) | JS grammar, TS AST, binding identity and literal safety |
| Generator | source → CodeLineExercise | physical-row mapping, AST intervals, representable hierarchy, limited fallback; projects the adapter's OrderingRelations (sealing and reduction from ordering-relations.ts) without language knowledge |
| Reference audit | auditReference(model, parser); createReferenceAuditor(ts, library?).audit(source, language) | author syntax and exact-whitespace requirements (admission gate); single-file TypeScript program with the standard library through a port: ok / errors / unverifiable (missing project context) / not-run, reported with every admission, never stored in or trusted from a model ([ADR-016](adr/016-reference-language-audit.md)) |
| Constraint explanation | explainConstraints(model), evidenceStatus(model) | admission first; per-line direct and transitive constraints, provenance categories and editability classes from `authoring.provenance` and the block hierarchy; provenance counts only while `authoring.evidence` binds it to the lines (digest defined only in the core); never a grading input ([ADR-014](adr/014-constraint-provenance.md), [ADR-015](adr/015-evidence-binding-and-analysis-environment.md)) |
| Rule editing | applyRuleEdits(model, edits); editAuthorModel(model, edits, ports); refreshAuthorModel(model, ports) | atomic typed author edits (rules, notes, fixed, profiles), editability-based removal safety with recorded relaxations, effect reports proven by inclusion or a validator-graded witness, gate requalification, refresh that carries author rules over with a report; no model mutation in views ([ADR-018](adr/018-typed-rule-editing.md)) |
| Model verification | verifyModel(model, input); verifyAuthorModel(model, ports, input) | re-derivation against a fresh regeneration, projection loss, search-budget fitness, fallbacks, audit; status analysis-verified / conservative / author-modified / unverified, publishable flag and checked/tested/not-established claims; never executes code or changes a verdict ([ADR-017](adr/017-model-verification-gate.md)) |
| Diagnostics | diagnoseSubmission(compiled, submission, options), codeLineDiagnosticReasons(model) | proof-based explanation of the unchanged validator verdict over the validator's own content candidates (`matchContent`): a conflict is named only when it holds under every content-consistent assignment; ambiguity, single-profile failure and budget exhaustion fall back to general text; verified/partial/guidance fixes via the sorter's insert semantics; disclosure level per diagnostic ([ADR-023](adr/023-explainable-validation-diagnostics.md)) |
| Model compilation | compileCodeLineExercise | generated JSON Schema check, referential integrity, DAG, scopes, ownership, fixed positions |
| Validator | validateSubmission | content bijection, multiplicity, profiles, assigned-prefix scope pruning and bounded search |
| Catalog | createDraft, preview, evaluate | trusted references, immutable admission snapshots and expiring previews |
| Attempt | insertFromPool, moveInAnswer, applyText, formattedAnswer | stable identities, fixed slots, atomic editor changes and blank positions |
| Author lifecycle | installPreview | compatible attempts and atomic preview replacement |
| Persistence | exportSession, restoreAttempt | versioned author/attempt files, identity audits, report exclusion |
| Input adapter | createInsertionDrag | native/pointer/touch/keyboard, marker, midpoint, animation compensation, focus and announcement |
| Presentation | render, field registry | escaped HTML, Prism, editors and extensible hierarchy |
| API adapters | author/preview/evaluate contracts | server calls or explicitly local Pages demonstration |
| Deployment | one verify job → reusable deploy | exact tested artifact, failure gating, restricted publication permission |

These are deep modules in Ousterhout's sense: a small interface hides a coherent policy. Separating persistence and author lifecycle removes policy from event handlers; splitting files alone is not the architectural objective. The learner DOM never receives the trusted dependency graph. Author preview models may display their own dependency tables; successful grading returns a content-verified token witness, without disclosing trusted ordering edges. The core does not know browsers, parsers, CSS or formatting libraries.

`docs/schema.json` remains the v2 shape contract. The opt-in v3 and Language IR v1 contracts are `docs/codeline-v3.schema.json` and `docs/language-ir.schema.json`. `scripts/sync-schema.mjs` uses pinned Ajv to generate all three into `src/core/schema-check.ts`, the same browser-safe runtime checker for Node and Pages. Semantic graph checks remain handwritten TypeScript. `scripts/sync-vendor.mjs` copies pinned formatter/parser assets and their licenses before compilation.

The existing v2 generator retains AST intervals with unique physical boundary rows as explicit blocks. Shared close/open rows such as `} else {` cannot represent two independent events in v2. Only those intervals receive mandatory original-order edges; representable enclosing and nested blocks remain. `authoring.omittedBlocks` and the reason explicitly expose this limit. Function ownership refers to retained function scopes. The JS/TS v3 bridge preserves those decisions; native IR producers may use the explicit v3 boundary-event representation instead of inventing v2 structure.

The frontend only commits a preview after server/local admission succeeds. Newer author requests supersede older ones; dependency-only updates preserve compatible attempts and reevaluate them. No persisted report or imported rule can replace a trusted server record.

The stylesheet has one ordered set of design tokens, base components, IDE/editor components, input states, fullscreen, token styling and responsive rules. There are no version-stacked `!important` patches. Real browser checks cover full width, alternate rows, operators, gutters, fullscreen, scrolling and input behavior.

Reference identity, original physical source location and current solution position are separate concepts. Dependencies reference immutable IDs within one exercise revision. Optional sourceLine is diagnostic metadata; matchedTokenIds is a server-computed positional witness. Legacy CodeLine v2 models remain valid and their rules are not regenerated on import.


## Typed workbench and governance

The authoritative presentation sources now live in src/workbench. View contracts expose exercise/attempt snapshots and a small text/fixed/formattedAnswer port; they do not expose parser or search implementations. Interaction policy owns tabs, draft continuity, source-file staging and busy feedback; continuity owns focus/selection/details replacement behavior. The renderer has one public render operation and owns contextual HTML, escaping and UI hierarchy.

The pre-existing controller, attempt, persistence, clipboard/input, author and server modules remain explicitly inventoried JS/MJS. Native TypeScript declarations describe the transitional ports; they do not certify the legacy modules as type checked. New presentation and governance implementation is strict native TypeScript with noEmitOnError, noUncheckedIndexedAccess and no handwritten any/ts-ignore. The core explicitly excludes Node ambient types.

`docs/architecture-policy.json` records legacy exceptions and TypeScript-owned generated browser modules. `scripts/architecture-rules.ts` and `scripts/verify-architecture.ts` enforce import directions, forbidden production execution/DOM leakage, typed-source rules and source/emit consistency. Negative tests exercise the gates. Cohesion, small public interfaces and deep modules still require architectural review; they cannot all be established by static string/AST checks.

Read [AI governance](ai-governance.md), [ADR-001](adr/001-typescript-workbench-and-boundaries.md) and the [workflow design](ui-ux-workflows.md) for responsibilities, prioritization and remaining migration stages.

The fixed constraint is positional, not an ordering partition: [ADR-002](adr/002-fixed-positions.md). Product-to-code traceability, indentation and insertion contracts: [business and technical contract](business-technical-contract.md).

## Opt-in language engine

[ADR-003](adr/003-language-ir-and-codeline-v3.md) adds versioned physical spans, atomic multiline units, independent syntactic containers and binding scopes, ordered virtual boundaries and explicit indent policy. The v3 compiler lowers into the existing bounded content validator, with optional unit placement and container-event checks. The v2 path, trusted catalog, UI and persistence remain unchanged. New author orchestration lives in strict TypeScript `src/author/engine.ts`; only that entry point may import the runtime core. Legacy parser/generator/audit implementations remain behind narrow injected ports. Render preparation emits display data without grading rules. [Contracts and usage](language-engine-contract.md), [migration tasks and Python handoff](language-engine-migration.md).

The first Python slice adds a strict author DTO port and isolated Node process/browser worker infrastructure under `src/python`. It runs a fixed stdlib audit query against source-as-data, with pinned local Pyodide assets in a separate test host. Product catalog/evaluation/UI paths cannot import it yet; the published Pages artifact excludes the runtime. It does not generate Python IR. [ADR-005](adr/005-isolated-python-parser-port.md), [evidence and remaining tasks](python-parser-platform.md).
