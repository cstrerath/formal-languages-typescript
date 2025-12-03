import { RecursiveSet } from 'recursive-set';
import { State, Char, DFA, NFA, nfa2dfa, key as fsmKey } from './01-NFA-2-DFA';
import { RegExp, RegExp2NFA } from './03-Regexp-2-NFA';

// ============================================================
// 1. Typ-Definitionen
// ============================================================

/**
 * Generischer DFA. S ist der Typ der Zustände.
 */
type GenericDFA<S> = {
	Q: RecursiveSet<S>;
	Sigma: RecursiveSet<Char>;
	delta: Map<string, S>;
	q0: S;
	A: RecursiveSet<S>;
};

// ============================================================
// 2. Hilfsfunktionen
// ============================================================

/**
 * Entpackt ein Kuratowski-Paar {{x}, {x, y}} in [x, y].
 */
function unwrapPair<S>(pair: RecursiveSet<any>): [S, S] {
	const elements = Array.from(pair) as RecursiveSet<S>[];

	// Fall 1: {{x}} => (x, x)
	if (elements.length === 1) {
		const singleton = elements[0];
		const x = Array.from(singleton)[0] as S;
		return [x, x];
	}

	// Fall 2: {{x}, {x, y}}
	let singleton: RecursiveSet<S>;
	let doubleton: RecursiveSet<S>;

	if (elements[0].size === 1) {
		singleton = elements[0];
		doubleton = elements[1];
	} else {
		singleton = elements[1];
		doubleton = elements[0];
	}

	const x = Array.from(singleton)[0] as S;
	const ySet = doubleton.difference(singleton);
	const y = Array.from(ySet)[0] as S;

	return [x, y];
}

/**
 * Generiert den Lookup-Key.
 * Erwartet c als strikten String (Char).
 */
function genKey<S>(state: S, c: Char): string {
	return `${String(state)},${c}`;
}

// ============================================================
// 3. Implementierung der Notebook-Funktionen
// ============================================================

export function cartesian_product<S, T>(
	A: RecursiveSet<S>,
	B: RecursiveSet<T>
): RecursiveSet<any> {
	return A.cartesianProduct(B);
}

export function regexp2DFA(r: RegExp, Sigma: RecursiveSet<Char>): DFA {
	const converter = new RegExp2NFA(Sigma);
	const nfa = converter.toNFA(r);
	return nfa2dfa(nfa);
}

export function fsm_complement<S>(
	F1: GenericDFA<S>,
	F2: GenericDFA<S>
): GenericDFA<any> {
	// Direkte Zuweisung statt Destructuring, um "exports"-Fehler im Notebook zu umgehen
	const Q1 = F1.Q;
	const Sigma = F1.Sigma;
	const delta1 = F1.delta;
	const q1 = F1.q0;
	const A1 = F1.A;

	const Q2 = F2.Q;
	const delta2 = F2.delta;
	const q2 = F2.q0;
	const A2 = F2.A;

	const newStates = cartesian_product(Q1, Q2);
	const newDelta = new Map<string, any>();

	for (const statePair of newStates) {
		const [p1, p2] = unwrapPair<S>(statePair);

		// WICHTIG: Expliziter Cast von 'element' zu 'Char'
		for (const element of Sigma) {
			const c = element as Char;

			const next1 = delta1.get(genKey(p1, c));
			const next2 = delta2.get(genKey(p2, c));

			if (next1 !== undefined && next2 !== undefined) {
				const s1 = new RecursiveSet(next1);
				const s2 = new RecursiveSet(next1, next2);
				const nextPair = new RecursiveSet(s1, s2);

				newDelta.set(genKey(statePair, c), nextPair);
			}
		}
	}

	const startPair = new RecursiveSet(
		new RecursiveSet(q1),
		new RecursiveSet(q1, q2)
	);

	const diffSet = Q2.difference(A2);
	const newAccepting = cartesian_product(A1, diffSet);

	return {
		Q: newStates,
		Sigma: Sigma,
		delta: newDelta,
		q0: startPair,
		A: newAccepting,
	};
}

export function is_empty<S>(F: GenericDFA<S>): boolean {
	const { Sigma, delta, q0, A } = F;

	let reachable = new RecursiveSet<S>(q0);

	while (true) {
		const newFound = new RecursiveSet<S>();

		for (const q of reachable) {
			// WICHTIG: Expliziter Cast von 'element' zu 'Char'
			for (const element of Sigma) {
				const c = element as Char;

				const target = delta.get(genKey(q, c));
				if (target !== undefined) {
					newFound.add(target);
				}
			}
		}

		if (newFound.isSubset(reachable)) {
			break;
		}
		reachable = reachable.union(newFound);
	}

	return reachable.intersection(A).isEmpty();
}

export function regExpEquiv(
	r1: RegExp,
	r2: RegExp,
	Sigma: RecursiveSet<Char>
): boolean {
	const F1 = regexp2DFA(r1, Sigma);
	const F2 = regexp2DFA(r2, Sigma);

	const r1MinusR2 = fsm_complement(F1, F2);
	const r2MinusR1 = fsm_complement(F2, F1);

	return is_empty(r1MinusR2) && is_empty(r2MinusR1);
}
