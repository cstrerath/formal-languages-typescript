import { RecursiveSet, RecursiveMap, Tuple, Value } from "recursive-set";
import { DFA, NFA, State, Char, DFAState } from "./01-NFA-2-DFA";

// ============================================================================
// DFA VISUALIZATION (DOT) - FIXED
// ============================================================================
function dfa2dot(dfa: DFA): string {
    const { Q, Σ, δ, q0, A } = dfa;
    const lines: string[] = [];

    lines.push('digraph "Deterministic FSM" {');
    lines.push('  rankdir=LR;');
    lines.push('  node [fontname="Arial"];');

    // Mapping erstellen: State -> "S0", "S1"...
    const stateToName = new RecursiveMap<DFAState, string>();
    let n = 0;
    for (const q of Q) {
        stateToName.set(q, `S${n++}`);
    }

    // Start-Pfeil (Ghost Node)
    const startName = stateToName.get(q0);
    if (startName) {
        lines.push('  "start_ghost" [label="", shape=none, width=0, height=0];');
        lines.push(`  "start_ghost" -> "${startName}";`);
    }

    // Knoten definieren
    for (const q of Q) {
        const name = stateToName.get(q)!;
        // WICHTIG: Das Label zeigt den echten Inhalt (z.B. {q0, q1})
        // Wir escapen Anführungszeichen, falls q.toString() welche enthält.
        const labelText = q.toString().replace(/"/g, '\\"');
        const shape = A.has(q) ? "doublecircle" : "circle";
        
        lines.push(`  "${name}" [label="${labelText}", shape="${shape}"];`);
    }

    // Kanten definieren
    for (const q of Q) {
        const sourceName = stateToName.get(q)!;

        for (const c of Σ) {
            const target = δ.get(new Tuple(q, c));
            
            // Nur zeichnen, wenn Ziel existiert
            if (target) {
                const targetName = stateToName.get(target);
                if (targetName) {
                    lines.push(`  "${sourceName}" -> "${targetName}" [label="${c}"];`);
                }
            }
        }
    }

    lines.push("}");
    return lines.join("\n");
}

// ============================================================================
// NFA VISUALIZATION (DOT) - POLISHED
// ============================================================================
function nfa2dot(nfa: NFA): string {
    const { Q, Σ, δ, q0, A } = nfa;
    const lines: string[] = [];

    lines.push('digraph "Non-Deterministic FSM" {');
    lines.push('  rankdir=LR;');
    lines.push('  node [fontname="Arial"];');

    // Start-Pfeil
    lines.push('  "start_ghost" [label="", shape=none, width=0, height=0];');
    // Sicherstellen, dass q0 als String sicher ist (z.B. bei komplexen IDs)
    lines.push(`  "start_ghost" -> "${q0}";`);

    // Knoten
    for (const q of Q) {
        const shape = A.has(q) ? "doublecircle" : "circle";
        const labelText = q.toString().replace(/"/g, '\\"');
        
        lines.push(`  "${q}" [label="${labelText}", shape="${shape}"];`);
    }

    // Kanten
    for (const q of Q) {
        // 1. Epsilon-Übergänge
        const targetsEps = δ.get(new Tuple(q, "ε"));
        if (targetsEps) {
            for (const p of targetsEps) {
                lines.push(`  "${q}" -> "${p}" [label="ε", style="dashed", color="gray"];`);
            }
        }

        // 2. Normale Übergänge
        for (const c of Σ) {
            const targets = δ.get(new Tuple(q, c));
            if (targets) {
                for (const p of targets) {
                    lines.push(`  "${q}" -> "${p}" [label="${c}"];`);
                }
            }
        }
    }

    lines.push("}");
    return lines.join("\n");
}

export { dfa2dot, nfa2dot };
