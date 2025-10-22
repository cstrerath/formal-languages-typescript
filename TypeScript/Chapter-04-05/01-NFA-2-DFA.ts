// 01-NFA-2-DFA.ts
// DFA-Konstruktion aus NFA mit ε-Übergängen (speichersicher & ohne Duplikate)

export type State = string | number;
export type Char = string;

// Transitionen als String-Key "q,c"
export type TransRel = Map<string, Set<State>>;
export type TransRelDet = Map<string, Set<State>>;

export type NFA = {
  Q: Set<State>;
  Sigma: Set<Char>;
  delta: TransRel;
  q0: State;
  A: Set<State>;
};

export type DFA = {
  Q: Set<Set<State>>; // Menge der DFA-Zustände (jeder ist eine Menge von NFA-Zuständen)
  Sigma: Set<Char>;
  delta: TransRelDet; // "setKey(M),c" -> N
  q0: Set<State>;
  A: Set<Set<State>>;
};

// ------------------------------------------------------------
// Utilities
// ------------------------------------------------------------

function key(q: State, c: Char): string {
  return `${q},${c}`;
}

function toSortedArray(s: Set<State>): (string | number)[] {
  // States können number oder string sein -> stabil als string vergleichen
  return Array.from(s).sort((a, b) => String(a).localeCompare(String(b)));
}

function setKey(s: Set<State>): string {
  return JSON.stringify(toSortedArray(s));
}

export function bigUnion<T>(sets: Set<Set<T>>): Set<T> {
  const result = new Set<T>();
  for (const subset of sets) {
    for (const x of subset) result.add(x);
  }
  return result;
}

// ------------------------------------------------------------
// Kernfunktionen
// ------------------------------------------------------------

export function epsClosure(s: State, delta: TransRel): Set<State> {
  let result = new Set<State>([s]);
  while (true) {
    const newStates = new Set<State>();
    for (const q of result) {
      const targets = delta.get(key(q, 'ε'));
      if (targets) for (const t of targets) newStates.add(t);
    }
    const combined = new Set([...result, ...newStates]);
    if (combined.size === result.size) return result;
    result = combined;
  }
}

export function deltaHat(s: State, c: Char, delta: TransRel): Set<State> {
  const reachable = new Set<State>();
  const targets = delta.get(key(s, c));
  if (targets) {
    for (const q of targets) {
      const clos = epsClosure(q, delta);
      for (const r of clos) reachable.add(r);
    }
  }
  return reachable;
}

export function capitalDelta(
  M: Set<State>,
  c: Char,
  delta: TransRel
): Set<State> {
  const partials = new Set<Set<State>>();
  for (const q of M) partials.add(deltaHat(q, c, delta));
  return bigUnion(partials);
}

// WICHTIG: keine Set<Set<...>>-Vereinigungen mehr in der Fixpunkt-Schleife.
// Wir verwenden BFS mit Kanonisierung (setKey).
export function allStates(
  Q0: Set<State>,
  delta: TransRel,
  Sigma: Set<Char>
): Set<Set<State>> {
  const seen = new Map<string, Set<State>>();
  const queue: Set<State>[] = [];

  const startKey = setKey(Q0);
  seen.set(startKey, Q0);
  queue.push(Q0);

  while (queue.length > 0) {
    const M = queue.shift()!;
    for (const c of Sigma) {
      const N = capitalDelta(M, c, delta); // kann leer sein – ist ok
      const k = setKey(N);
      if (!seen.has(k)) {
        seen.set(k, N);
        queue.push(N);
      }
    }
  }
  // Rückgabe als Set<Set<State>>
  return new Set(seen.values());
}

export function nfa2dfa(nfa: NFA): DFA {
  const { Sigma, delta, q0, A } = nfa;

  const newStart = epsClosure(q0, delta);
  const newStates = allStates(newStart, delta, Sigma);

  const newDelta: TransRelDet = new Map();
  for (const M of newStates) {
    const Mk = setKey(M);
    for (const c of Sigma) {
      const N = capitalDelta(M, c, delta);
      newDelta.set(`${Mk},${c}`, N);
    }
  }

  const newFinal = new Set<Set<State>>();
  for (const M of newStates) {
    for (const a of A) {
      if (M.has(a)) {
        newFinal.add(M);
        break;
      }
    }
  }

  return { Q: newStates, Sigma, delta: newDelta, q0: newStart, A: newFinal };
}
