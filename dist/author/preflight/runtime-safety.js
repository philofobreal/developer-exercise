import { referenceFacts } from './flow-paths.js';
import { bindingSafetyOf } from './binding-safety.js';
import { objectStateOf } from './object-state.js';
export function runtimeSafety(compiler, source, language, options) {
    const facts = referenceFacts(compiler, source, language);
    const parts = [bindingSafetyOf(facts), ...(options.objectState === 'local' ? [objectStateOf(facts)] : [])];
    return {
        completeness: parts.some(part => part.completeness === 'budget-exceeded') ? 'budget-exceeded' : 'within-supported-scope',
        findings: parts.flatMap(part => part.findings).sort((a, b) => a.line - b.line)
    };
}
//# sourceMappingURL=runtime-safety.js.map