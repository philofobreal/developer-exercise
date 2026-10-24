/** Fixed trusted stdlib query; caller source is passed to _ng_audit as data. */
export const PYTHON_AUDIT_BOOTSTRAP = String.raw`
import ast as _ast, io as _io, json as _json, sys as _sys
import symtable as _symtable, tokenize as _tokenize, token as _token, warnings as _warnings

def _ng_node(value, depth=0):
    if depth > 150:
        raise RecursionError('AST projection depth exceeded')
    if isinstance(value, _ast.AST):
        start = {'line': value.lineno, 'column': value.col_offset} if hasattr(value, 'lineno') else None
        end = {'line': value.end_lineno, 'column': value.end_col_offset} if getattr(value, 'end_lineno', None) is not None else None
        return {'kind': type(value).__name__, 'fields': {key: _ng_node(item, depth + 1) for key, item in _ast.iter_fields(value)}, 'start': start, 'end': end}
    if isinstance(value, list):
        return [_ng_node(item, depth + 1) for item in value]
    if value is None or isinstance(value, (str, bool)):
        return value
    return {'literalType': type(value).__name__, 'value': repr(value)}

def _ng_scopes(table, result, parent=None):
    if len(result) >= 500:
        raise RecursionError('Scope projection limit exceeded')
    identity = 'scope-' + str(len(result))
    predicates = ('referenced', 'parameter', 'global', 'nonlocal', 'local', 'free', 'imported', 'assigned', 'namespace', 'declared_global')
    symbols = [{'name': symbol.get_name(), 'flags': [name for name in predicates if getattr(symbol, 'is_' + name)()]} for symbol in table.get_symbols()]
    result.append({'id': identity, 'parentId': parent, 'kind': table.get_type().value, 'name': table.get_name(), 'line': table.get_lineno(), 'symbols': symbols})
    for child in table.get_children():
        _ng_scopes(child, result, identity)

def _ng_audit(source):
    try:
        # Bound lexical nesting before CPython compilation: WASM hosts have different stacks.
        tokens = []
        nesting = 0
        for item in _tokenize.generate_tokens(_io.StringIO(source).readline):
            if item.type == _token.INDENT or item.type == _token.OP and item.string in ('(', '[', '{'):
                nesting += 1
            elif item.type == _token.DEDENT or item.type == _token.OP and item.string in (')', ']', '}'):
                nesting = max(0, nesting - 1)
            if nesting > 64 or len(tokens) >= 50_000:
                raise RecursionError('Author lexical nesting/token budget exceeded')
            tokens.append({'kind': _token.tok_name[item.type], 'exactKind': _token.tok_name[item.exact_type], 'text': item.string, 'start': {'line': item.start[0], 'column': item.start[1]}, 'end': {'line': item.end[0], 'column': item.end[1]}})
        with _warnings.catch_warnings():
            _warnings.simplefilter('ignore')
            compile(source, '<author>', 'exec', dont_inherit=True, optimize=0)
            tree = _ast.parse(source, filename='<author>', mode='exec', feature_version=(3, 14))
            table = _symtable.symtable(source, '<author>', 'exec')
        scopes = []
        _ng_scopes(table, scopes)
        return _json.dumps({'ok': True, 'audit': {'protocolVersion': 1, 'grammarVersion': '3.14', 'runtimeVersion': _sys.version.split()[0], 'source': source, 'tree': _ng_node(tree), 'tokens': tokens, 'scopes': scopes}}, ensure_ascii=True, allow_nan=False)
    except (SyntaxError, IndentationError, TabError) as error:
        position = {'line': max(1, error.lineno or 1), 'column': max(0, (error.offset or 1) - 1)}
        return _json.dumps({'ok': False, 'error': {'code': 'syntax_error', 'message': str(error)[:1800], 'position': position}})
    except (RecursionError, MemoryError) as error:
        return _json.dumps({'ok': False, 'error': {'code': 'resource_limit', 'message': str(error)[:1800]}})
    except _tokenize.TokenError as error:
        line, column = error.args[1]
        return _json.dumps({'ok': False, 'error': {'code': 'syntax_error', 'message': str(error.args[0])[:1800], 'position': {'line': max(1, line), 'column': max(0, column)}}})
`;
