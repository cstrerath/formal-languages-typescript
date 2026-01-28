import { Value, Structural, RecursiveSet, RecursiveMap, Tuple } from "recursive-set";
import { NFA, Char } from "./01-NFA-2-DFA";

// ============================================================================
// 1. GENERIC DFA INTERFACE
// ============================================================================

/**
 * Interface representing any deterministic automaton.
 * S is the type of the state (e.g. number, Set<number>, Set<Set<number>>).
 */
export interface GenericDFA<S extends Structural> {
    Q: RecursiveSet<S>;
    Σ: RecursiveSet<Char>;
    δ: RecursiveMap<Tuple<[S, Char]>, S>;
    q0: S;
    A: RecursiveSet<S>;
}

// ============================================================================
// 2. DFA VISUALIZATION (String & Dot)
// ============================================================================

export function dfa2string<S extends Structural>(dfa: GenericDFA<S>): string {
    const { Q, Σ, δ, q0, A } = dfa;
    let result = "";

    const stateToName = new RecursiveMap<S, string>();
    
    // Sort states for deterministic output
    const sortedStates = [...Q].sort(RecursiveSet.compareVisual);
    
    let n = 0;
    for (const q of sortedStates) {
        stateToName.set(q, `S${n++}`);
    }

    result += `states: {S0, ..., S${n - 1}}\n\n`;

    const startName = stateToName.get(q0) ?? "UNKNOWN";
    result += `start state: ${startName}\n\n`;

    result += "state encoding:\n";
    for (const q of sortedStates) {
        result += `${stateToName.get(q)} = ${q.toString()}\n`;
    }

    result += "\ntransitions:\n";
    for (const q of sortedStates) {
        const sourceName = stateToName.get(q)!;

        // Sort characters for deterministic output
        const sortedSigma = [...Σ].sort();

        for (const c of sortedSigma) {
            const target = δ.get(new Tuple(q, c));

            if (target) {
                const targetName = stateToName.get(target);
                if (targetName) {
                    result += `δ(${sourceName}, ${c}) = ${targetName}\n`;
                }
            }
        }
    }

    result += "\nset of accepting states: {";
    const acceptingNames: string[] = [];

    for (const q of sortedStates) {
        if (A.has(q)) {
            acceptingNames.push(stateToName.get(q)!);
        }
    }
    result += acceptingNames.join(", ");
    result += "}\n";

    return result;
}

export function dfa2dot<S extends Structural>(dfa: GenericDFA<S>): string {
    const { Q, Σ, δ, q0, A } = dfa;
    const lines: string[] = [];

    lines.push('digraph "Deterministic FSM" {');
    lines.push('  rankdir=LR;');
    lines.push('  node [fontname="Arial", fontsize=12, shape=circle];');

    const stateToName = new RecursiveMap<S, string>();
    const sortedStates = [...Q].sort(RecursiveSet.compareVisual);

    let n = 0;
    for (const q of sortedStates) {
        stateToName.set(q, `S${n++}`);
    }

    const startName = stateToName.get(q0);
    if (startName) {
        lines.push('  "start_ghost" [label="", width=0.1, height=0.1, style=filled, color=blue];');
        lines.push(`  "start_ghost" -> "${startName}";`);
    }

    for (const q of sortedStates) {
        const name = stateToName.get(q)!;
        const shape = A.has(q) ? "doublecircle" : "circle";
        lines.push(`  "${name}" [shape="${shape}"];`);
    }

    for (const q of sortedStates) {
        const sourceName = stateToName.get(q)!;
        const sortedSigma = [...Σ].sort();

        for (const c of sortedSigma) {
            const target = δ.get(new Tuple(q, c));

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

/**
 * Generates an HTML Table mapping the short IDs back to the real state content.
 * Styled to be compact and properly aligned.
 */
export function renderLegend<S extends Structural>(dfa: GenericDFA<S>): string {
    const sortedStates = [...dfa.Q].sort(RecursiveSet.compareVisual);
    
    // UPDATE: 
    // - width: auto (statt 100%) -> Tabelle schrumpft auf Inhaltsgröße
    // - margin: 0 auto -> Tabelle zentriert sich im Container
    // - box-shadow -> Sieht "wertiger" aus
    let html = `<table style="font-family: 'Segoe UI', monospace; border-collapse: collapse; font-size: 0.85em; width: auto; margin: 10px auto; border: 1px solid #ddd; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">`;
    
    html += `<thead style="background: #f4f4f4; border-bottom: 2px solid #ccc;">
                <tr>
                    <th style="padding: 8px 12px; text-align: center; border-right: 1px solid #e0e0e0;">ID</th>
                    <th style="padding: 8px 12px; text-align: left;">State Content</th>
                    <th style="padding: 8px 12px; text-align: center; width: 40px;">Start</th>
                    <th style="padding: 8px 12px; text-align: center; width: 40px;">Final</th>
                </tr>
             </thead><tbody>`;

    let n = 0;
    for (const q of sortedStates) {
        const id = n++; // Einfache Nummerierung 0, 1, 2...
        
        const isStart = q.equals(dfa.q0) ? "🟢" : "";
        const isFinal = dfa.A.has(q) ? "⭐" : "";
        
        let content = q.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Optional: Wrap sehr lange Sets um, damit die Tabelle nicht explodiert
        if (content.length > 80) {
            content = `<span style="display:inline-block; max-width: 400px; word-wrap: break-word;">${content}</span>`;
        }

        html += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 6px 12px; text-align: center; font-weight: bold; color: #555; background: #fafafa; border-right: 1px solid #e0e0e0;">${id}</td>
                    
                    <td style="padding: 6px 12px; text-align: left; color: #333;">${content}</td>
                    
                    <td style="padding: 6px 12px; text-align: center;">${isStart}</td>
                    <td style="padding: 6px 12px; text-align: center;">${isFinal}</td>
                 </tr>`;
    }
    html += `</tbody></table>`;
    return html;
}

/**
 * Erstellt das HTML Grid Layout für den visuellen Vergleich.
 */
export function renderComparisonLayout(
    s1: string, svg1: string, legend1: string,
    s2: string, svg2: string, legend2: string
): string {
    return `
    <div style="display: flex; flex-direction: column; gap: 20px; font-family: sans-serif;">
        <div style="display: flex; gap: 20px; border: 1px solid #ccc; background: white; padding: 15px; border-radius: 5px;">
            <div style="flex: 1; min-width: 0;">
                <h4 style="margin: 0 0 10px 0; border-bottom: 2px solid #ddd; padding-bottom: 5px;">
                    RegExp 1: <code style="color: #d63384;">${s1}</code>
                </h4>
                <div style="text-align: center; margin-bottom: 10px;">${svg1}</div>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee;">${legend1}</div>
            </div>
            <div style="border-left: 1px solid #ddd;"></div>
            <div style="flex: 1; min-width: 0;">
                <h4 style="margin: 0 0 10px 0; border-bottom: 2px solid #ddd; padding-bottom: 5px;">
                    RegExp 2: <code style="color: #d63384;">${s2}</code>
                </h4>
                <div style="text-align: center; margin-bottom: 10px;">${svg2}</div>
                <div style="max-height: 200px; overflow-y: auto; border: 1px solid #eee;">${legend2}</div>
            </div>
        </div>
    </div>`;
}

// ============================================================================
// 3. NFA VISUALIZATION
// ============================================================================

export function nfa2string(nfa: NFA): string {
    const { Q, Σ, δ, q0, A } = nfa;
    let result = "";

    // Sort states for deterministic output
    const sortedStates = [...Q].sort(RecursiveSet.compareVisual);

    result += `states: {${sortedStates.join(', ')}}\n\n`;
    result += `start state: ${q0}\n\n`;
    result += "transitions:\n";

    for (const q of sortedStates) {
        // 1. Explicit Transitions (Sigma)
        const sortedSigma = [...Σ].sort();
        for (const c of sortedSigma) {
            const targets = δ.get(new Tuple(q, c));
            
            if (targets && !targets.isEmpty()) {
                const sortedTargets = [...targets].sort(RecursiveSet.compareVisual);
                // Format: δ(1, a) = {2, 3}
                result += `δ(${q}, ${c}) = {${sortedTargets.join(', ')}}\n`;
            }
        }

        // 2. Epsilon Transitions
        const targetsEps = δ.get(new Tuple(q, "ε"));
        if (targetsEps && !targetsEps.isEmpty()) {
            const sortedTargets = [...targetsEps].sort(RecursiveSet.compareVisual);
            // Format: δ(1, ε) = {2}
            result += `δ(${q}, ε) = {${sortedTargets.join(', ')}}\n`;
        }
    }

    // Sort accepting states
    const sortedA = [...A].sort(RecursiveSet.compareVisual);
    result += `\nset of accepting states: {${sortedA.join(', ')}}\n`;
    return result;
}

export function nfa2dot(nfa: NFA): string {
    const { Q, Σ, δ, q0, A } = nfa;
    const lines: string[] = [];

    lines.push('digraph "Non-Deterministic FSM" {');
    lines.push('  rankdir=LR;');
    lines.push('  node [fontname="Arial", fontsize=12, shape=circle];');

    // Ghost Node
    lines.push('  "start_ghost" [label="", width=0.1, height=0.1, style=filled, color=blue];');
    lines.push(`  "start_ghost" -> "${q0}";`);

    const sortedStates = [...Q].sort(RecursiveSet.compareVisual);

    // Nodes
    for (const q of sortedStates) {
        const label = String(q);
        const shape = A.has(q) ? "doublecircle" : "circle";
        lines.push(`  "${label}" [shape="${shape}"];`);
    }

    // Edges
    for (const q of sortedStates) {
        // Epsilon
        const targetsEps = δ.get(new Tuple(q, "ε"));
        if (targetsEps) {
            const sortedTargets = [...targetsEps].sort(RecursiveSet.compareVisual);
            for (const p of sortedTargets) {
                lines.push(`  "${q}" -> "${p}" [label="ε", weight="0.1"];`);
            }
        }

        // Chars
        const sortedSigma = [...Σ].sort();
        for (const c of sortedSigma) {
            const targets = δ.get(new Tuple(q, c));
            if (targets) {
                const sortedTargets = [...targets].sort(RecursiveSet.compareVisual);
                for (const p of sortedTargets) {
                    // weight="10" pulls non-epsilon transitions tighter
                    lines.push(`  "${q}" -> "${p}" [label="${c}", weight="10"];`);
                }
            }
        }
    }

    lines.push("}");
    return lines.join("\n");
}