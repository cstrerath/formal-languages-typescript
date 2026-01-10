import { RecursiveSet, Value } from "recursive-set";
import { DFA, NFA, State, Char, key, DFAState } from "./01-NFA-2-DFA";

export function pySetStr(s: RecursiveSet<Value> | Set<Value>): string {
    let elements: Value[];

    if (s instanceof RecursiveSet) {
        if (s.isEmpty()) return "{}";
        elements = s.raw as Value[];
    } else {
        if (s.size === 0) return "{}";
        elements = Array.from(s);
    }

    const sortedStrings = elements.map(String).sort();
    return `{${sortedStrings.join(", ")}}`;
}

export function dfa2string(dfa: DFA): string {
    const { Q, Sigma, delta, q0, A } = dfa;
    let result: string = "";

    const stateToName = new Map<string, string>();
    const statesList = Q.raw;

    let n = 0;
    for (const q of statesList) {
        stateToName.set(q.toString(), `S${n++}`);
    }

    result += `states: {S0, ..., S${n - 1}}\n\n`;

    const startName = stateToName.get(q0.toString()) ?? "UNKNOWN";
    result += `start state: ${startName}\n\n`;

    result += "state encoding:\n";
    for (const q of statesList) {
        result += `${stateToName.get(q.toString())} = ${pySetStr(q)}\n`;
    }

    result += "\ntransitions:\n";
    for (const q of statesList) {
        const sourceName = stateToName.get(q.toString())!;

        for (const rawC of Sigma) {
            const c = rawC as string;
            const k = key(q, c);

            const target = delta.get(k);

            if (target) {
                const targetName = stateToName.get(target.toString());

                if (targetName) {
                    result += `delta(${sourceName}, ${c}) = ${targetName}\n`;
                }
            }
        }
    }

    result += "\nset of accepting states: {";
    const acceptingNames: string[] = [];

    for (const q of statesList) {
        if (A.has(q)) {
            acceptingNames.push(stateToName.get(q.toString())!);
        }
    }
    result += acceptingNames.join(", ");
    result += "}\n";

    return result;
}

export function dfa2dot(dfa: DFA): {
    dot: string;
    statesToNames: Map<DFAState, string>;
} {
    const { Q, Sigma, delta, q0, A } = dfa;
    const lines: string[] = [];

    lines.push('digraph "Deterministic FSM" {');
    lines.push("  rankdir=LR;");

    const stateToNameStr = new Map<string, string>();
    const stateToNameObj = new Map<DFAState, string>();
    const statesList = Q.raw;

    let n = 0;
    for (const q of statesList) {
        const name = `S${n++}`;
        stateToNameStr.set(q.toString(), name);
        stateToNameObj.set(q, name);
    }

    const startName = stateToNameStr.get(q0.toString()) ?? "ERR";

    lines.push(
        '  "start_ghost" [label="", width="0.1", height="0.1", style="filled", color="blue"];',
    );
    lines.push(`  "start_ghost" -> "${startName}";`);

    for (const q of statesList) {
        const name = stateToNameStr.get(q.toString())!;
        if (A.has(q)) {
            lines.push(`  "${name}" [peripheries="2"];`);
        } else {
            lines.push(`  "${name}";`);
        }
    }

    for (const q of statesList) {
        const sourceName = stateToNameStr.get(q.toString())!;

        for (const rawC of Sigma) {
            const c = rawC as string;
            const target = delta.get(key(q, c));

            if (target) {
                const targetName = stateToNameStr.get(target.toString());
                if (targetName) {
                    lines.push(
                        `  "${sourceName}" -> "${targetName}" [label="${c}"];`,
                    );
                }
            }
        }
    }

    lines.push("}");
    return { dot: lines.join("\n"), statesToNames: stateToNameObj };
}

export function nfa2string(nfa: NFA): string {
    const { Q, Sigma, delta, q0, A } = nfa;
    let result: string = "";

    result += `states: ${pySetStr(Q)}\n\n`;
    result += `start state: ${q0}\n\n`;
    result += "transitions:\n";

    const sortedStates = Array.from(Q).map(String).sort();
    const sortedSigma = Array.from(Sigma).map(String).sort();

    for (const qStr of sortedStates) {
        const q = (isNaN(Number(qStr)) ? qStr : Number(qStr)) as State;

        for (const c of sortedSigma) {
            const targets = delta.get(key(q, c));
            if (targets && !targets.isEmpty()) {
                for (const p of targets) {
                    result += `[${q}, ${c}] |-> ${p}\n`;
                }
            }
        }

        const targetsEps = delta.get(key(q, "ε"));
        if (targetsEps && !targetsEps.isEmpty()) {
            for (const p of targetsEps) {
                result += `[${q}, ""] |-> ${p}\n`;
            }
        }
    }

    result += `\nset of accepting states: ${pySetStr(A)}\n`;
    return result;
}

export function nfa2dot(nfa: NFA): string {
    const { Q, Sigma, delta, q0, A } = nfa;
    const lines: string[] = [];

    lines.push('digraph "Non-Deterministic FSM" {');
    lines.push("  rankdir=LR;");

    const startName = q0.toString();
    const statesList = Array.from(Q);

    lines.push(
        '  "start_ghost" [label="", width="0.1", height="0.1", style="filled", color="blue"];',
    );
    lines.push(`  "start_ghost" -> "${startName}";`);

    for (const q of statesList) {
        if (A.has(q)) {
            lines.push(`  "${q}" [peripheries="2"];`);
        } else {
            lines.push(`  "${q}";`);
        }
    }

    for (const q of statesList) {
        const targets = delta.get(key(q, "ε"));
        if (targets) {
            for (const p of targets) {
                lines.push(`  "${q}" -> "${p}" [label="ε", weight="0.1"];`);
            }
        }
    }

    for (const q of statesList) {
        for (const rawC of Sigma) {
            const c = rawC as string;
            const targets = delta.get(key(q, c));
            if (targets) {
                for (const p of targets) {
                    lines.push(
                        `  "${q}" -> "${p}" [label="${c}", weight="10"];`,
                    );
                }
            }
        }
    }

    lines.push("}");
    return lines.join("\n");
}
