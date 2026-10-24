/** Declarative model. The trusted reference lives on the server. */
export type Language = 'javascript' | 'typescript' | (string & {});
/**
 * `indent`: leading spaces/tabs are presentation-only for a SAFE single-line token.
 * `exact`: all code units matter (e.g. template literals, JSX whitespace).
 */
export type Normalization = 'indent' | 'exact';

export interface CodeToken {
  /** Unique within the trusted exercise. Never trusted as semantic identity. */
  id: string;
  /** Exactly one physical line. Compound statements must be pre-split by the author. */
  code: string;
  /** Null = top-level; otherwise the lexical block containing this line. */
  scope: string | null;
  /** Direct or transitive predecessors (not necessarily adjacent). */
  after?: string[];
  /** Indentation normalization MUST be verified safe when authoring. */
  normalization?: Normalization;
  /** Optional absolute zero-based submission position; does not partition other tokens. */
  fixedPosition?: number;
}

export interface LexicalBlock {
  id: string;
  /** Token opening the block, e.g. `function f() {` or `for (...) {`. */
  open: string;
  /** Token closing the block, often text `}`. */
  close: string;
  /** Parent block ID, or null for top-level block. */
  parent: string | null;
}

export interface OrderingEdge {
  before: string;
  after: string;
}

/** At least one alternate profile must be satisfiable. Empty list = base only. */
export interface OrderingProfile {
  id: string;
  edges: OrderingEdge[];
}

export interface ExerciseDefinition {
  schemaVersion: 1;
  id: string;
  revision: number;
  language: Language;
  title: string;
  description: string;
  tokens: CodeToken[];
  blocks: LexicalBlock[];
  /** Optional additional mandatory constraints. */
  edges?: OrderingEdge[];
  /** OR between profiles; AND within each profile. */
  profiles?: OrderingProfile[];
}

/** User-supplied code is DATA. Never execute it, parse it on the server, or eval it. */
export interface Submission {
  exerciseId: string;
  revision: number;
  /** Each physical line, optionally carrying display indent. Token IDs are NOT required. */
  lines: string[];
}

export interface ValidationOptions {
  /** Deterministic maximum number of search states across all profiles combined. */
  maxStates?: number;
}
export type ValidationStatus = 'accepted' | 'rejected' | 'indeterminate' | 'invalid_reference';
export type ValidationReason =
  | 'wrong_length' | 'unknown_content' | 'wrong_multiplicity' | 'rule_violation'
  | 'search_budget' | 'invalid_model' | 'invalid_submission';
export interface ValidationResult {
  status: ValidationStatus;
  accepted: boolean;
  reason: ValidationReason | null;
  message: string;
  /** Zero-based diagnostic positions, NEVER supplied token IDs. */
  positions?: number[];
  /** Author profile used for the successful witness. */
  matchedProfile?: string;
  /** Server-computed witness: submitted position -> trusted token ID. Not client identity. */
  matchedTokenIds?: string[];
  /** Search iterations used, not a timing-based resource budget. */
  exploredStates: number;
}
