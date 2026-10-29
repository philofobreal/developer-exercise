/** Reachability over ordering edges: the one place in the core that knows how the transitive
 * closure is computed (Kahn order and per-token descendant bitsets). Callers ask whether a
 * token must precede another, list a token's descendants or ancestors, or read its
 * topological rank. A cyclic graph is reported, never half-computed: `acyclic` is false and
 * no token reaches another, so a caller cannot mistake a partial closure for the whole one. */
export interface Reachability {
  readonly acyclic: boolean;
  /** Position of each token in one topological order (acyclic graphs only). */
  readonly rank: Int32Array;
  reaches(from: number, to: number): boolean;
  /** Tokens reachable from `token`, ascending. */
  descendants(token: number): readonly number[];
  /** Tokens that reach `token`, ascending. */
  ancestors(token: number): readonly number[];
}

export function reachability(n: number, edges: readonly (readonly [number, number])[]): Reachability {
  const words = (n + 31) >>> 5, next = Array.from({ length: n }, () => [] as number[]), indegree = new Int32Array(n);
  for (const [before, after] of edges) { next[before]!.push(after); indegree[after]!++; }
  const order: number[] = [];
  for (let i = 0; i < n; i++) if (!indegree[i]) order.push(i);
  for (let head = 0; head < order.length; head++) for (const after of next[order[head]!]!) if (!--indegree[after]!) order.push(after);
  const acyclic = order.length === n, rank = new Int32Array(n), below = new Uint32Array(acyclic ? n * words : 0);
  order.forEach((token, i) => { rank[token] = i; });
  if (acyclic) for (let k = n - 1; k >= 0; k--) {
    const token = order[k]!, base = token * words;
    for (const after of next[token]!) { below[base + (after >>> 5)]! |= 1 << (after & 31); for (let w = 0; w < words; w++) below[base + w]! |= below[after * words + w]!; }
  }
  const down: (number[] | undefined)[] = new Array(n);
  let up: number[][] | undefined;
  function descendants(token: number): readonly number[] {
    if (!acyclic) return [];
    let list = down[token];
    if (!list) {
      list = [];
      for (let w = 0, base = token * words; w < words; w++) for (let bits = below[base + w]!; bits; bits &= bits - 1) list.push(w * 32 + 31 - Math.clz32(bits & -bits));
      down[token] = list;
    }
    return list;
  }
  return {
    acyclic, rank, descendants,
    reaches: (from, to) => acyclic && ((below[from * words + (to >>> 5)]! >>> (to & 31)) & 1) === 1,
    ancestors(token) {
      if (!up) { up = Array.from({ length: n }, () => []); for (let from = 0; from < n; from++) for (const to of descendants(from)) up[to]!.push(from); }
      return up[token]!;
    }
  };
}
