import { statementOrdering } from './statement-ordering.js';
import { typeMemberOrdering } from './type-member-ordering.js';
import { combineOrderingRelations } from './ordering-relations.js';
export function jsTsOrderingRelations(file, compiler) {
    const statements = statementOrdering(file, compiler), members = typeMemberOrdering(file, compiler);
    return combineOrderingRelations([
        { entries: statements.entries, protectedInputs: statements.protectedInputs, spans: statements.units.map(({ first, last }) => ({ first, last })), note: '' },
        { entries: members.entries, protectedInputs: new Map(), spans: members.spans, note: members.note }
    ]);
}
//# sourceMappingURL=js-ts-ordering.js.map