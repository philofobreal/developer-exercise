/** ADR-149: which language versions a reference source needs. For each language the answer is the version of
 * the newest element the source uses, so the label of an exercise is measured, not typed in.
 *
 * Hidden here:
 *  - the table from syntax to ECMAScript edition and to TypeScript release (read from the source's own tree,
 *    never from compiled output);
 *  - how a standard library element gets its edition: the type checker follows the name to its declaration, and
 *    the declaring library file names the edition (`lib.es2023.array.d.ts`);
 *  - what to do where the checker cannot follow (an untyped receiver in JavaScript): the member's name decides,
 *    by the oldest edition that declares a member of that name, unless the source declares that name itself.
 *
 * Limits, recorded in ADR-149: a novelty that lives in the type checker's behaviour and not in syntax is not seen;
 * a name-based answer is a lower bound; without the standard library only the syntax is measured. */
import type ts from 'typescript';
import type {Technology} from '../../dist/index.js';
import type {LibraryPort} from './reference-audit.js';

export interface TechnologyProfiler {
 /** The technologies of `source`, each with the version of the newest element the source uses: ECMAScript always
  * (`5` for anything older than ES2015), TypeScript for a TypeScript source (`1.0` for anything older). */
 profile(source: string, language: 'javascript' | 'typescript'): Technology[];
}

/** The newest standard library the compiler ships, without the browser's. */
const NEWEST_LIB = 'lib.esnext.d.ts';
const OLDEST_EDITION = 5;
/** The edition after the last one the compiler's library files number. */
const NEXT_EDITION = 2026;
/** Library files the compiler has not numbered yet, by the edition that standardised them. */
const UNNUMBERED: Readonly<Record<string, number>> = {collection: 2025, iterator: 2025, promise: 2025, float16: 2025};
/** Names the checker knows without a declaration. */
const INTRINSIC: Readonly<Record<string, number>> = {globalThis: 2020};
/** Utility types of the standard library, by the TypeScript release that added them. */
const UTILITY_TYPES: Readonly<Record<string, number>> = {
 Partial: 2001, Readonly: 2001, Record: 2001, Pick: 2001, Exclude: 2008, Extract: 2008, NonNullable: 2008, ReturnType: 2008, InstanceType: 2008,
 Required: 2008, Parameters: 3001, ConstructorParameters: 3001, ThisParameterType: 3003, OmitThisParameter: 3003, Omit: 3005,
 Uppercase: 4001, Lowercase: 4001, Capitalize: 4001, Uncapitalize: 4001, Awaited: 4005, NoInfer: 5004
};
const OLDEST_TYPESCRIPT = 1000;
/** A TypeScript release as one number: 4.9 is 4009. */
const release = (major: number, minor: number): number => major * 1000 + minor;

function libraryEdition(fileName: string): number | undefined {
 const name = fileName.slice(fileName.lastIndexOf('/') + 1);
 const numbered = /^lib\.es(\d+)\./.exec(name);
 if (numbered) {const edition = Number(numbered[1]); return edition === 6 ? 2015 : edition;}
 const unnumbered = /^lib\.esnext\.([a-z0-9]+)\.d\.ts$/.exec(name);
 // Decorator metadata is in no edition; it does not date the code.
 return unnumbered && unnumbered[1] !== 'decorators' ? UNNUMBERED[unnumbered[1] ?? ''] ?? NEXT_EDITION : undefined;
}

/** Editions of what a regular expression literal uses: flags, named groups, lookbehind, property escapes, modifiers. */
function regularExpressionEdition(text: string): number {
 const end = text.lastIndexOf('/'), pattern = text.slice(1, end), flags = text.slice(end + 1);
 let edition = OLDEST_EDITION;
 const mark = (value: number): void => {if (value > edition) edition = value;};
 if (/[uy]/.test(flags)) mark(2015);
 if (flags.includes('s') || /(?<!\\)\(\?<[=!A-Za-z_$]/.test(pattern) || /\\[pP]\{/.test(pattern)) mark(2018);
 if (flags.includes('d')) mark(2022);
 if (flags.includes('v')) mark(2024);
 if (/(?<!\\)\(\?[a-z]*(?:-[a-z]+)?:/.test(pattern.replace(/\(\?:/g, ''))) mark(2025);
 return edition;
}

export function createTechnologyProfiler(compiler: typeof ts, library?: LibraryPort): TechnologyProfiler {
 const S = compiler.SyntaxKind;
 const libraries = new Map<string, ts.SourceFile | undefined>();
 const libraryFile = (fileName: string): ts.SourceFile | undefined => {
  const name = fileName.slice(fileName.lastIndexOf('/') + 1);
  if (!library || !/^lib\.[a-z0-9.]+\.d\.ts$/.test(name)) return undefined;
  if (!libraries.has(name)) {const text = library(name); libraries.set(name, text === undefined ? undefined : compiler.createSourceFile(name, text, compiler.ScriptTarget.ESNext));}
  return libraries.get(name);
 };
 /** The oldest edition that declares an interface member of each name, over the whole library. */
 let memberEditions: Map<string, number> | undefined;
 const membersOf = (program: ts.Program): Map<string, number> => {
  if (memberEditions) return memberEditions;
  const found = new Map<string, number>();
  for (const file of program.getSourceFiles()) {
   const edition = libraryEdition(file.fileName);
   if (edition === undefined) continue;
   for (const statement of file.statements) {
    if (!compiler.isInterfaceDeclaration(statement)) continue;
    for (const member of statement.members) {
     const name = member.name && (compiler.isIdentifier(member.name) || compiler.isStringLiteral(member.name)) ? member.name.text : undefined;
     if (name !== undefined && edition < (found.get(name) ?? Infinity)) found.set(name, edition);
    }
   }
  }
  return memberEditions = found;
 };

 function profile(source: string, language: 'javascript' | 'typescript'): Technology[] {
  const typed = language === 'typescript', fileName = 'reference.' + (typed ? 'ts' : 'js');
  const file = compiler.createSourceFile(fileName, source, compiler.ScriptTarget.ESNext, true, typed ? compiler.ScriptKind.TS : compiler.ScriptKind.JS);
  let edition = OLDEST_EDITION, typescript = OLDEST_TYPESCRIPT;
  const ecma = (value: number): void => {if (value > edition) edition = value;};
  const typeScript = (major: number, minor: number): void => {if (release(major, minor) > typescript) typescript = release(major, minor);};

  const inFunction = (node: ts.Node): boolean => {for (let at = node.parent; at; at = at.parent) if (compiler.isFunctionLike(at)) return true; return false;};
  const modifiers = (node: ts.Node): readonly ts.Modifier[] => compiler.canHaveModifiers(node) ? compiler.getModifiers(node) ?? [] : [];
  const has = (node: ts.Node, kind: ts.SyntaxKind): boolean => modifiers(node).some(modifier => modifier.kind === kind);

  /** What the node's own syntax needs. */
  const syntax = (node: ts.Node): void => {
   for (const modifier of modifiers(node)) {
    if (modifier.kind === S.AsyncKeyword) ecma(2017);
    else if (modifier.kind === S.ExportKeyword && compiler.isSourceFile(node.parent)) ecma(2015);
    else if (modifier.kind === S.ProtectedKeyword) typeScript(1, 3);
    else if (modifier.kind === S.AbstractKeyword) typeScript(1, 6);
    else if (modifier.kind === S.ReadonlyKeyword) typeScript(2, 0);
    else if (modifier.kind === S.OverrideKeyword) typeScript(4, 3);
    else if (modifier.kind === S.AccessorKeyword) typeScript(4, 9);
    else if (modifier.kind === S.ConstKeyword && compiler.isTypeParameterDeclaration(node)) typeScript(5, 0);
    else if ((modifier.kind === S.InKeyword || modifier.kind === S.OutKeyword) && compiler.isTypeParameterDeclaration(node)) typeScript(4, 7);
   }
   if (compiler.isVariableDeclarationList(node)) {
    const scope = node.flags & compiler.NodeFlags.BlockScoped;
    if (scope === compiler.NodeFlags.Using || scope === compiler.NodeFlags.AwaitUsing) {ecma(NEXT_EDITION); typeScript(5, 2);}
    else if (scope) ecma(2015);
   }
   else if (compiler.isArrowFunction(node) || compiler.isClassLike(node) || compiler.isTemplateExpression(node) || compiler.isNoSubstitutionTemplateLiteral(node) || compiler.isTaggedTemplateExpression(node)
    || compiler.isObjectBindingPattern(node) || compiler.isArrayBindingPattern(node) || compiler.isSpreadElement(node) || compiler.isYieldExpression(node) || compiler.isComputedPropertyName(node)
    || compiler.isShorthandPropertyAssignment(node) || compiler.isExportAssignment(node) && !node.isExportEquals) ecma(2015);
   else if (compiler.isParameter(node)) {if (node.initializer || node.dotDotDotToken) ecma(2015);}
   else if (compiler.isBindingElement(node)) {if (node.dotDotDotToken && compiler.isObjectBindingPattern(node.parent)) ecma(2018);}
   else if (compiler.isSpreadAssignment(node)) ecma(2018);
   else if (compiler.isForOfStatement(node)) ecma(node.awaitModifier ? 2018 : 2015);
   else if (compiler.isMethodDeclaration(node) && compiler.isObjectLiteralExpression(node.parent)) ecma(2015);
   else if (compiler.isAwaitExpression(node)) ecma(inFunction(node) ? 2017 : 2022);
   else if (compiler.isCatchClause(node)) {if (!node.variableDeclaration) ecma(2019);}
   else if (compiler.isBigIntLiteral(node)) ecma(2020);
   else if (compiler.isNumericLiteral(node)) {const text = node.getText(file); if (text.includes('_')) ecma(2021); else if (/^0[bBoO]/.test(text)) ecma(2015);}
   else if (node.kind === S.RegularExpressionLiteral) ecma(regularExpressionEdition(node.getText(file)));
   else if (compiler.isPrivateIdentifier(node) || compiler.isClassStaticBlockDeclaration(node)) ecma(2022);
   else if (compiler.isPropertyDeclaration(node)) {if (!typed) ecma(2022); else if (node.exclamationToken) typeScript(2, 7);}
   else if (compiler.isVariableDeclaration(node)) {if (node.exclamationToken) typeScript(2, 7);}
   else if (compiler.isMetaProperty(node)) ecma(node.keywordToken === S.ImportKeyword ? 2020 : 2015);
   else if (compiler.isImportDeclaration(node)) {
    if (node.importClause?.isTypeOnly) typeScript(3, 8); else ecma(2015);
    if (node.attributes) ecma(2025);
   }
   else if (compiler.isExportDeclaration(node)) {
    if (node.isTypeOnly) typeScript(3, 8); else ecma(node.exportClause && compiler.isNamespaceExport(node.exportClause) ? 2020 : 2015);
    if (node.attributes) ecma(2025);
   }
   else if (compiler.isImportSpecifier(node) || compiler.isExportSpecifier(node)) {if (node.isTypeOnly) typeScript(4, 5);}
   else if (compiler.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (operator === S.AsteriskAsteriskToken || operator === S.AsteriskAsteriskEqualsToken) ecma(2016);
    else if (operator === S.QuestionQuestionToken) ecma(2020);
    else if (operator === S.QuestionQuestionEqualsToken || operator === S.BarBarEqualsToken || operator === S.AmpersandAmpersandEqualsToken) ecma(2021);
    else if (operator === S.EqualsToken && (compiler.isArrayLiteralExpression(node.left) || compiler.isObjectLiteralExpression(node.left))) ecma(2015);
   }
   else if (compiler.isCallExpression(node)) {if (node.expression.kind === S.ImportKeyword) ecma(2020);}
   else if (compiler.isDecorator(node)) typeScript(1, 5);
   else if (compiler.isTupleTypeNode(node)) typeScript(1, 3);
   else if (compiler.isUnionTypeNode(node) || compiler.isTypeAliasDeclaration(node)) typeScript(1, 4);
   else if (compiler.isIntersectionTypeNode(node)) typeScript(1, 6);
   else if (compiler.isTypePredicateNode(node)) {if (node.assertsModifier) typeScript(3, 7); else typeScript(1, 6);}
   else if (compiler.isLiteralTypeNode(node)) {if (compiler.isStringLiteral(node.literal)) typeScript(1, 8); else typeScript(2, 0);}
   else if (node.kind === S.NeverKeyword || compiler.isNonNullExpression(node)) typeScript(2, 0);
   else if (compiler.isTypeOperatorNode(node)) {if (node.operator === S.KeyOfKeyword) typeScript(2, 1); else if (node.operator === S.UniqueKeyword) typeScript(2, 7); else typeScript(3, 4);}
   else if (compiler.isMappedTypeNode(node)) {if (node.nameType) typeScript(4, 1); else typeScript(2, 1);}
   else if (compiler.isIndexedAccessTypeNode(node)) typeScript(2, 1);
   else if (node.kind === S.ObjectKeyword) typeScript(2, 2);
   else if (compiler.isConditionalTypeNode(node) || compiler.isInferTypeNode(node)) typeScript(2, 8);
   else if (node.kind === S.UnknownKeyword || compiler.isRestTypeNode(node) || compiler.isOptionalTypeNode(node)) typeScript(3, 0);
   else if (node.kind === S.BigIntKeyword) typeScript(3, 2);
   else if (compiler.isAsExpression(node)) {if (compiler.isTypeReferenceNode(node.type) && compiler.isIdentifier(node.type.typeName) && node.type.typeName.text === 'const') typeScript(3, 4);}
   else if (compiler.isNamedTupleMember(node)) typeScript(4, 0);
   else if (compiler.isTemplateLiteralTypeNode(node)) typeScript(4, 1);
   else if (compiler.isSatisfiesExpression(node)) typeScript(4, 9);
   if ((compiler.isFunctionDeclaration(node) || compiler.isFunctionExpression(node) || compiler.isMethodDeclaration(node)) && node.asteriskToken) ecma(has(node, S.AsyncKeyword) ? 2018 : 2015);
   if ((compiler.isPropertyAccessExpression(node) || compiler.isElementAccessExpression(node) || compiler.isCallExpression(node)) && node.questionDotToken) ecma(2020);
  };

  /** Names the source declares at its top level: in a script they would merge with the library's globals, and the
   * source's own `Map` or `Partial` is not the library's. */
  const ownGlobals = new Set<string>();
  for (const statement of file.statements) {
   if (compiler.isVariableStatement(statement)) {for (const declaration of statement.declarationList.declarations) if (compiler.isIdentifier(declaration.name)) ownGlobals.add(declaration.name.text);}
   else if ((compiler.isFunctionDeclaration(statement) || compiler.isClassDeclaration(statement) || compiler.isInterfaceDeclaration(statement) || compiler.isTypeAliasDeclaration(statement)
    || compiler.isEnumDeclaration(statement) || compiler.isModuleDeclaration(statement)) && statement.name && compiler.isIdentifier(statement.name)) ownGlobals.add(statement.name.text);
  }
  /** Names the source gives to members of its own objects: a member of that name is not the library's. */
  const ownMembers = new Set<string>();
  const collect = (node: ts.Node): void => {
   const name = compiler.isPropertyAssignment(node) || compiler.isShorthandPropertyAssignment(node) || compiler.isMethodDeclaration(node) || compiler.isPropertyDeclaration(node) || compiler.isAccessor(node)
    || compiler.isPropertySignature(node) || compiler.isMethodSignature(node) || compiler.isEnumMember(node) ? node.name
    : compiler.isBinaryExpression(node) && node.operatorToken.kind === S.EqualsToken && compiler.isPropertyAccessExpression(node.left) ? node.left.name : undefined;
   if (name && (compiler.isIdentifier(name) || compiler.isStringLiteral(name))) ownMembers.add(name.text);
   compiler.forEachChild(node, collect);
  };

  const checker = ((): {checker: ts.TypeChecker; members: Map<string, number>} | undefined => {
   if (!libraryFile(NEWEST_LIB)) return undefined;
   const host: ts.CompilerHost = {
    getSourceFile: name => name === fileName ? file : libraryFile(name),
    getDefaultLibFileName: () => NEWEST_LIB, getDefaultLibLocation: () => '', writeFile: () => undefined, getCurrentDirectory: () => '', getDirectories: () => [],
    getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
    fileExists: name => name === fileName || !!libraryFile(name), readFile: () => undefined
   };
   const program = compiler.createProgram([fileName], {target: compiler.ScriptTarget.ESNext, module: compiler.ModuleKind.ESNext, moduleResolution: compiler.ModuleResolutionKind.Bundler, allowJs: true, noEmit: true, types: [], skipDefaultLibCheck: true, lib: [NEWEST_LIB]}, host);
   return {checker: program.getTypeChecker(), members: membersOf(program)};
  })();

  /** What the name needs from the standard library. */
  const libraryUse = (node: ts.Identifier): void => {
   if (!checker) return;
   const member = compiler.isPropertyAccessExpression(node.parent) && node.parent.name === node;
   if (!member && ownGlobals.has(node.text)) return;
   const symbol = checker.checker.getSymbolAtLocation(node);
   if (!symbol) {
    if (member) {
     // An untyped receiver: the member's name decides, unless the source declares a member of that name.
     const untyped = (checker.checker.getTypeAtLocation((node.parent as ts.PropertyAccessExpression).expression).flags & compiler.TypeFlags.Any) !== 0;
     if (untyped && !ownMembers.has(node.text)) ecma(checker.members.get(node.text) ?? OLDEST_EDITION);
    } else ecma(INTRINSIC[node.text] ?? OLDEST_EDITION);
    return;
   }
   const declarations = symbol.declarations ?? [];
   if (!declarations.length) {ecma(INTRINSIC[node.text] ?? OLDEST_EDITION); return;}
   if (declarations.some(declaration => declaration.getSourceFile() === file)) return;
   // A name can be a type in one library file and a value in a newer one (`interface Promise` in ES5's, the
   // `Promise` constructor in ES2015's): the use decides which declarations date it.
   const asType = compiler.isPartOfTypeNode(node);
   const meant = declarations.filter(declaration => asType ? !compiler.isVariableDeclaration(declaration) && !compiler.isFunctionDeclaration(declaration) : !compiler.isInterfaceDeclaration(declaration) && !compiler.isTypeAliasDeclaration(declaration));
   let oldest = Infinity;
   for (const declaration of meant.length ? meant : declarations) {
    const declared = libraryEdition(declaration.getSourceFile().fileName);
    if (declared !== undefined && declared < oldest) oldest = declared;
   }
   if (oldest !== Infinity) ecma(oldest);
   const utility = UTILITY_TYPES[node.text];
   if (utility !== undefined && compiler.isTypeReferenceNode(node.parent)) typeScript(Math.floor(utility / 1000), utility % 1000);
  };

  collect(file);
  const visit = (node: ts.Node): void => {
   syntax(node);
   if (compiler.isIdentifier(node)) libraryUse(node);
   compiler.forEachChild(node, visit);
  };
  visit(file);
  const technologies: Technology[] = [{id: 'ecmascript', version: String(edition)}];
  if (typed) technologies.push({id: 'typescript', version: `${Math.floor(typescript / 1000)}.${typescript % 1000}`});
  return technologies;
 }
 return {profile};
}
