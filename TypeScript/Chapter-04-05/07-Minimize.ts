// ---------------------------------------------------------------------------
// 07-Minimize.ts
// Minimizes a deterministic finite automaton (DFA) by merging equivalent states.
// Implements the DFA minimization algorithm from the lecture.
// Fully equivalent to the Python notebook version.
// ---------------------------------------------------------------------------
// ---------- Type Definitions -----------------------------------------------

export type Char = string;
export type State = number;

// Transition relation δ: Map<State, Map<Char, State>>
export type TransRel = Map<State, Map<Char, State>>;

// DFA definition (Q, Σ, δ, q0, F)
export interface DFA {
  Q: Set<State>;
  Sigma: Set<Char>;
  delta: TransRel;
  q0: State;
  F: Set<State>;
}

// Pair of states
export type Pair = [State, State];

// SetState = equivalence class (set of original states)
export type SetState = ReadonlySet<State>;

// Transition relation for minimized DFA: (SetState, Char) → SetState
export type TransRelSet = Map<string, SetState>;

// Minimized DFA (Q', Σ, δ', q0', F')
export interface MinDFA {
  Q: Set<SetState>;
  Sigma: Set<Char>;
  delta: TransRelSet;
  q0: SetState;
  F: Set<SetState>;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

// Returns an arbitrary element from a non-empty set
export function arb<S>(M: Set<S> | ReadonlySet<S>): S {
  for (const x of M) return x;
  throw new Error('Error: arb called with empty set!');
}

// Computes the Cartesian product A × B
export function cartProd<S, T>(A: Set<S>, B: Set<T>): Set<[S, T]> {
  const result = new Set<[S, T]>();
  for (const a of A) {
    for (const b of B) {
      result.add([a, b]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// separate(Pairs, States, Σ, δ)
// ---------------------------------------------------------------------------
//
// Computes the set of separable pairs (q1, q2) such that there exists a
// character c in Σ with δ(q1, c) = p1, δ(q2, c) = p2, and (p1, p2) ∈ Pairs.
//

export function separate(
  Pairs: Set<Pair>,
  States: Set<State>,
  Sigma: Set<Char>,
  delta: TransRel
): Set<Pair> {
  const Result = new Set<Pair>();

  const hasPair = (p1: State | undefined, p2: State | undefined): boolean => {
    if (p1 === undefined || p2 === undefined) return false;
    for (const [x, y] of Pairs) {
      if (x === p1 && y === p2) return true;
    }
    return false;
  };

  for (const q1 of States) {
    for (const q2 of States) {
      for (const c of Sigma) {
        const next1 = delta.get(q1)?.get(c);
        const next2 = delta.get(q2)?.get(c);
        if (hasPair(next1, next2)) {
          Result.add([q1, q2]);
        }
      }
    }
  }

  return Result;
}

// ---------------------------------------------------------------------------
// findEquivalenceClass(p, Partition)
// ---------------------------------------------------------------------------

export function findEquivalenceClass(
  p: State,
  Partition: Set<SetState>
): SetState {
  for (const C of Partition) {
    if (C.has(p)) return C;
  }
  throw new Error(`State ${p} not found in any equivalence class!`);
}

// ---------------------------------------------------------------------------
// reachable(q0, Σ, δ)
// ---------------------------------------------------------------------------

export function reachable(
  q0: State,
  Sigma: Set<Char>,
  delta: TransRel
): Set<State> {
  const Result = new Set<State>([q0]);

  while (true) {
    const NewStates = new Set<State>();

    for (const p of Result) {
      const transitions = delta.get(p);
      if (!transitions) continue;
      for (const c of Sigma) {
        const next = transitions.get(c);
        if (next !== undefined) {
          NewStates.add(next);
        }
      }
    }

    let allKnown = true;
    for (const s of NewStates) {
      if (!Result.has(s)) {
        allKnown = false;
        Result.add(s);
      }
    }

    if (allKnown) return Result; // fixed point reached
  }
}

// ---------------------------------------------------------------------------
// allSeparable(Q, A, Σ, δ)
// ---------------------------------------------------------------------------

export function allSeparable(
  Q: Set<State>,
  A: Set<State>,
  Sigma: Set<Char>,
  delta: TransRel
): Set<Pair> {
  const nonAccepting = new Set([...Q].filter((q) => !A.has(q)));

  let Separable = new Set<Pair>([
    ...cartProd(nonAccepting, A),
    ...cartProd(A, nonAccepting),
  ]);

  while (true) {
    const NewPairs = separate(Separable, Q, Sigma, delta);

    let isSubset = true;
    for (const pair of NewPairs) {
      if (![...Separable].some(([x, y]) => x === pair[0] && y === pair[1])) {
        isSubset = false;
        break;
      }
    }

    if (isSubset) return Separable; // fixed point reached

    for (const pair of NewPairs) {
      Separable.add(pair);
    }
  }
}

// ---------------------------------------------------------------------------
// minimize(F)
// ---------------------------------------------------------------------------
//
// Minimizes a DFA and returns the resulting minimized DFA.
//

export function minimize(F: DFA): MinDFA {
  let { Q, Sigma, delta, q0, F: Accepting } = F;

  // 1️⃣ Remove unreachable states
  Q = reachable(q0, Sigma, delta);

  // 2️⃣ Find separable pairs
  const Separable = allSeparable(Q, Accepting, Sigma, delta);

  // 3️⃣ Compute equivalent pairs (Q×Q \ Separable)
  const Equivalent = new Set<Pair>();
  for (const [p, q] of cartProd(Q, Q)) {
    if (![...Separable].some(([x, y]) => x === p && y === q)) {
      Equivalent.add([p, q]);
    }
  }

  // 4️⃣ Build equivalence classes
  const EquivClasses = new Set<SetState>();
  for (const q of Q) {
    const cls = new Set<State>();
    for (const p of Q) {
      if ([...Equivalent].some(([x, y]) => x === p && y === q)) {
        cls.add(p);
      }
    }
    if (cls.size > 0) EquivClasses.add(cls);
  }

  // 5️⃣ Determine new start state
  const newQ0 = arb(new Set([...EquivClasses].filter((C) => C.has(q0))));

  // 6️⃣ Determine new accepting states
  const newAccept = new Set<SetState>(
    [...EquivClasses].filter((C) => {
      const rep = arb(C);
      return Accepting.has(rep);
    })
  );

  // 7️⃣ Build new transition function
  const newDelta: TransRelSet = new Map();

  for (const q of Q) {
    const classOfQ = findEquivalenceClass(q, EquivClasses);
    for (const c of Sigma) {
      const next = delta.get(q)?.get(c);
      const classOfP =
        next !== undefined
          ? findEquivalenceClass(next, EquivClasses)
          : new Set<State>();
      newDelta.set(JSON.stringify([Array.from(classOfQ), c]), classOfP);
    }
  }

  // 8️⃣ Return minimized DFA
  return {
    Q: EquivClasses,
    Sigma,
    delta: newDelta,
    q0: newQ0,
    F: newAccept,
  };
}

// ---------------------------------------------------------------------------
// Visualization using viz.js
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Utility: Mapping-Erzeugung
// ---------------------------------------------------------------------------

// Erstellt Mapping für normalen DFA (Zustände: 0 → S0, 1 → S1, ...)
export function createMappingForDFA(Q: Set<State>): Record<string, string> {
  const mapping: Record<string, string> = {};
  let index = 0;
  for (const state of Q) {
    mapping[`{${state}}`] = `S${index++}`;
  }
  return mapping;
}

// Erstellt Mapping für minimierten DFA (Zustände als Sets)
export function createMappingForMinDFA(
  Q: Set<SetState>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  let index = 0;
  for (const cls of Q) {
    mapping[`{${[...cls].join(',')}}`] = `S${index++}`;
  }
  return mapping;
}

export function dfaToDot(
  F: DFA | MinDFA,
  title = 'DFA',
  mapping?: Record<string, string>
): string {
  const { delta, q0, F: Accepting } = F as any;

  let dot = `digraph G {\n`;
  dot += `  label="${title}"; labelloc=top; rankdir=LR;\n`;
  dot += `  node [shape=none]; "";\n`;

  const labelOf = (s: string | number | Set<number>): string => {
    const key =
      s instanceof Set
        ? `{${[...s].join(',')}}`
        : typeof s === 'string'
        ? `{${s}}`
        : `{${s}}`;
    return mapping?.[key] ?? String(s);
  };

  dot += `  node [shape=doublecircle]; ${[...Accepting]
    .map((x) => `"${labelOf(x as any)}"`)
    .join(' ')};\n`;
  dot += `  node [shape=circle];\n`;
  dot += `  "" -> "${labelOf(q0 as any)}";\n`;

  const firstKey = [...(delta as any).keys()][0];

  if (typeof firstKey === 'number') {
    for (const [state, transitions] of delta as Map<State, Map<Char, State>>) {
      for (const [symbol, next] of transitions) {
        dot += `  "${labelOf(state)}" -> "${labelOf(
          next
        )}" [label="${symbol}"];\n`;
      }
    }
  } else {
    for (const [key, value] of delta as Map<string, Set<State>>) {
      let from = '';
      let label = '';
      try {
        const [state, c] = JSON.parse(key);
        from = Array.isArray(state) ? state.join(',') : String(state);
        label = String(c);
      } catch {
        from = String(key);
      }
      const to = Array.from(value ?? []).join(',');
      dot += `  "${labelOf(from)}" -> "${labelOf(to)}" [label="${label}"];\n`;
    }
  }

  dot += '}';
  return dot;
}
