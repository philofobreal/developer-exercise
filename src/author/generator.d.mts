/** Narrow legacy port for build tools; the MJS implementation is not migrated/type checked. */
import type ts from 'typescript';
import type {CodeLineExercise} from '../../dist/index.js';
export function generateCodeLineExercise(input: {source: string; language?: 'javascript' | 'typescript'; title?: string; description?: string; importEmit?: 'verbatim' | 'elide-unused'}, compiler: typeof ts): CodeLineExercise;
export class AuthoringError extends Error {}
