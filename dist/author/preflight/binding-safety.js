import { referenceFacts } from './flow-paths.js';
import { withArticle } from '../../../dist/index.js';
const MAX_CALL_DEPTH = 8;
export function bindingSafety(compiler, source, language) {
    return bindingSafetyOf(referenceFacts(compiler, source, language));
}
export function bindingSafetyOf(facts) {
    const { compiler, file, checker } = facts, S = compiler.SyntaxKind;
    const declarations = [];
    const find = (node) => {
        if (compiler.isVariableStatement(node) && (node.declarationList.flags & (compiler.NodeFlags.Let | compiler.NodeFlags.Const)) && !(node.declarationList.flags & compiler.NodeFlags.Using)) {
            const block = facts.blockOf(node);
            if (block)
                for (const declaration of node.declarationList.declarations)
                    if (compiler.isIdentifier(declaration.name)) {
                        const symbol = checker.getSymbolAtLocation(declaration.name);
                        if (symbol)
                            declarations.push({ symbol, name: declaration.name.text, block, statement: node, node: declaration });
                    }
        }
        else if (compiler.isClassDeclaration(node) && node.name && !compiler.getModifiers(node)?.some(m => m.kind === S.DeclareKeyword)) {
            const block = facts.blockOf(node), symbol = checker.getSymbolAtLocation(node.name);
            if (block && symbol)
                declarations.push({ symbol, name: node.name.text, block, statement: node, node });
        }
        compiler.forEachChild(node, find);
    };
    find(file);
    /** Within the declaration's own statement: is `access` evaluated before the binding is initialized? */
    const beforeInOwn = (access, declaration) => {
        if (compiler.isClassDeclaration(declaration.node))
            return (declaration.node.heritageClauses ?? []).some(clause => access.pos >= clause.pos && access.end <= clause.end);
        const declarators = declaration.statement.declarationList.declarations, target = declarators.indexOf(declaration.node);
        const at = declarators.findIndex(declarator => !!declarator.initializer && access.pos >= declarator.initializer.pos && access.end <= declarator.initializer.end);
        return at >= 0 && at <= target;
    };
    const assigned = (symbol) => (facts.references.get(symbol) ?? []).some(id => facts.isWrite(id));
    const strip = (node) => compiler.isParenthesizedExpression(node) ? strip(node.expression) : node;
    const callee = (call) => {
        if ((call.flags & compiler.NodeFlags.OptionalChain) !== 0)
            return undefined;
        const target = strip(call.expression);
        if (compiler.isFunctionExpression(target) || compiler.isArrowFunction(target))
            return target;
        if (!compiler.isIdentifier(target))
            return undefined;
        const symbol = checker.getSymbolAtLocation(target);
        if (!symbol || assigned(symbol))
            return undefined;
        const bodies = (symbol.declarations ?? []).filter((d) => compiler.isFunctionDeclaration(d) && !!d.body);
        if (bodies.length === 1 && symbol.declarations?.every(d => compiler.isFunctionDeclaration(d)))
            return bodies[0];
        const variable = symbol.valueDeclaration;
        if (variable && compiler.isVariableDeclaration(variable) && variable.initializer && (variable.parent.flags & compiler.NodeFlags.Const)) {
            const init = strip(variable.initializer);
            if ((compiler.isArrowFunction(init) || compiler.isFunctionExpression(init)) && variable.end <= call.pos)
                return init;
        }
        return undefined;
    };
    const accessOf = (declaration) => (node) => compiler.isIdentifier(node) && node !== declaration.node.name && facts.isValueReference(node) && facts.symbolOf(node) === declaration.symbol;
    /** The access to the declaration's binding that a call of `fn` certainly reaches, if any. */
    const reaches = (fn, declaration, depth, seen) => {
        if (depth > MAX_CALL_DEPTH || seen.has(fn) || facts.spend())
            return undefined;
        if (declaration.node.pos >= fn.pos && declaration.node.end <= fn.end)
            return undefined;
        seen.add(fn);
        let witness;
        const wanted = (node) => {
            if (accessOf(declaration)(node)) {
                witness = node;
                return true;
            }
            if (!compiler.isCallExpression(node))
                return false;
            const target = callee(node), hit = target && reaches(target, declaration, depth + 1, seen);
            if (hit) {
                witness = hit;
                return true;
            }
            return false;
        };
        const body = fn.body;
        if (!body)
            return undefined;
        if (!compiler.isBlock(body)) {
            let found = false;
            const visit = (node) => { if (found || facts.spend())
                return; if (wanted(node) && facts.transparentTo(node, body)) {
                found = true;
                return;
            } if (compiler.isFunctionLike(node))
                return; compiler.forEachChild(node, visit); };
            visit(body);
            return found ? witness : undefined;
        }
        for (const statement of body.statements) {
            if (facts.mustEvaluate(statement, wanted))
                return witness;
            if (facts.mayExit(statement))
                return undefined;
        }
        return undefined;
    };
    const findings = [];
    const reported = new Set();
    const report = (finding) => { const key = `${finding.line}:${finding.binding}`; if (!reported.has(key)) {
        reported.add(key);
        findings.push(finding);
    } };
    const callText = (call) => { const text = call.expression.getText(file); return `„${text.length > 40 ? text.slice(0, 37) + '…' : text}()”`; };
    for (const declaration of declarations) {
        if (facts.spent())
            break;
        const where = facts.lineOf(declaration.node), own = declaration.block.statements.indexOf(declaration.statement);
        for (const statement of declaration.block.statements.slice(0, own + 1)) {
            if (facts.spent() || !facts.reachable(statement, declaration.block))
                break;
            const ownStatement = statement === declaration.statement;
            // Direct accesses, also on every branch of an if/else and in the first pass of a loop that runs once.
            const direct = facts.mustEvaluate(statement, node => accessOf(declaration)(node) && (!ownStatement || beforeInOwn(node, declaration)));
            if (direct) {
                const lines = [...new Set(direct.map(node => facts.lineOf(node)))];
                report({ line: lines[0], code: 'BS001', certainty: 'definite', origin: 'runtime-order', binding: declaration.name,
                    message: `${withArticle('„' + declaration.name + '”', true)} a deklarációja (${where}. sor) előtt kerül kiolvasásra vagy írásra${lines.length > 1 ? ` minden ágon (${lines.map(line => line + '.').join(', ')} sor)` : ''}; ez futáskor biztosan ReferenceError (TDZ).` });
                continue;
            }
            // Calls whose callee certainly reaches an access.
            let access;
            const calls = facts.mustEvaluate(statement, node => {
                if (!compiler.isCallExpression(node) || ownStatement && !beforeInOwn(node, declaration))
                    return false;
                const target = callee(node), hit = target && reaches(target, declaration, 1, new Set());
                if (hit)
                    access = hit;
                return !!hit;
            });
            if (calls && access)
                report({ line: facts.lineOf(calls[0]), code: 'BS002', certainty: 'definite', origin: 'runtime-order', binding: declaration.name,
                    message: `${withArticle(callText(calls[0]), true)} hívás olyan függvényt futtat, amely ${withArticle('„' + declaration.name + '”')} értékét ${withArticle(facts.lineOf(access))}. sorban a deklarációja (${where}. sor) előtt használja; ez futáskor biztosan ReferenceError (TDZ).` });
        }
    }
    findings.sort((a, b) => a.line - b.line);
    return { completeness: facts.spent() ? 'budget-exceeded' : 'within-supported-scope', findings };
}
//# sourceMappingURL=binding-safety.js.map