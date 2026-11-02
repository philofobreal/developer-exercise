import { namesMatch, unspelledNames } from './property-names.js';
/** Built-ins that, on valid plain data, call no callback, write nothing and cannot throw. */
const GLOBAL_FUNCTIONS = new Set(['Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite']);
const STATIC_FUNCTIONS = {
    Math: ['abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'sqrt', 'cbrt', 'pow', 'max', 'min', 'hypot', 'log', 'log2', 'log10', 'exp'],
    Number: ['isInteger', 'isFinite', 'isNaN', 'isSafeInteger', 'parseInt', 'parseFloat'],
    Object: ['keys', 'values', 'entries'],
    Array: ['isArray', 'from']
};
const BUILTIN_METHODS = new Set(['join', 'slice', 'indexOf', 'lastIndexOf', 'includes', 'at', 'concat', 'flat', 'charAt', 'charCodeAt', 'codePointAt', 'startsWith', 'endsWith', 'trim', 'trimStart', 'trimEnd', 'toUpperCase', 'toLowerCase', 'padStart', 'padEnd', 'repeat', 'split', 'substring', 'toFixed', 'has', 'get']);
/** Source text that lets a program change what property access, iteration or conversion does. */
const HOOKS = /\bProxy\b|\bReflect\b|defineProperty|defineProperties|setPrototypeOf|__proto__|__define[GS]etter__|\.prototype\b|\bSymbol\.|\beval\b|\bFunction\b|\bwith\s*\(/;
const CONVERSIONS = /\b(?:valueOf|toString|toPrimitive|toJSON)\b/;
export function inputFacts(file, compiler, inputs = 'any') {
    const accessors = new Set(), defined = new Set();
    let computedAccessor = false, generators = false;
    const plain = (name) => !!name && (compiler.isIdentifier(name) || compiler.isPrivateIdentifier(name) || compiler.isStringLiteral(name) || compiler.isNumericLiteral(name));
    const auto = (node) => compiler.isPropertyDeclaration(node) && (compiler.getModifiers(node) ?? []).some(modifier => modifier.kind === compiler.SyntaxKind.AccessorKeyword);
    const visit = (node) => {
        // A member, an object literal key or an assigned property: a call by that name may run the program's own function.
        if ((compiler.isClassElement(node) || compiler.isObjectLiteralElementLike(node) || compiler.isTypeElement(node)) && plain(node.name))
            defined.add(node.name.text);
        if (compiler.isBinaryExpression(node) && compiler.isPropertyAccessExpression(node.left))
            defined.add(node.left.name.text);
        if (compiler.isGetAccessorDeclaration(node) || compiler.isSetAccessorDeclaration(node) || auto(node)) {
            const name = node.name;
            if (plain(name))
                accessors.add(name.text);
            else
                computedAccessor = true;
        }
        if ((compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isMethodDeclaration(node)) && node.asteriskToken)
            generators = true;
        compiler.forEachChild(node, visit);
    };
    const asked = inputs === 'valid';
    if (asked)
        visit(file);
    // ADR-052, ADR-053: names the program reaches without spelling them out count as named.
    const applies = asked && !computedAccessor && !namesMatch(file, unspelledNames(file, compiler), HOOKS);
    return {
        applies, unavailable: asked && !applies, conversions: applies && !CONVERSIONS.test(file.text),
        accessor: name => accessors.has(name), anyAccessor: accessors.size > 0, generators,
        builtinFunction: name => GLOBAL_FUNCTIONS.has(name),
        // Array.from calls a second argument back and iterates a generator.
        builtinStatic: (owner, name, count) => !!STATIC_FUNCTIONS[owner]?.includes(name) && !(owner === 'Array' && (generators || name === 'from' && count !== 1)),
        builtinMethod: name => BUILTIN_METHODS.has(name) && !defined.has(name),
        builtinConstructor: (name, count) => (name === 'Set' || name === 'Map') && count <= 1 && (count === 0 || !generators)
    };
}
//# sourceMappingURL=input-contract.js.map