export function ast2dot(input: unknown): string {
    let nodeCount = 0;
    const lines: string[] = [
        "digraph AST {",
        '  node [shape=box, style=filled, fontname="Courier", fontsize=10];',
        '  edge [arrowsize=0.7];'
    ];

    function visit(thing: unknown, parentId: string | null = null): void {
        if (thing === null || thing === "") return;

        // 1. Terminals
        if (typeof thing === "string" || typeof thing === "number") {
            const id = `n${nodeCount++}`;
            const label = thing.toString().replace(/"/g, '\\\\"');
            lines.push(`  ${id} [label="${label}", shape=ellipse, fillcolor="#fffbe6", margin=0.05];`);
            
            if (parentId) {
                lines.push(`  ${parentId} -> ${id};`);
            }
            return;
        }

        // 2. Composite Nodes
        if (Array.isArray(thing)) {
            const [tag, ...children] = thing;

            // --- Invisible List Node ---
            if (tag === '.') {
                const [head, tail] = children;
                visit(head, parentId);
                visit(tail, parentId);
                return;
            }

            // --- Standard Nodes ---
            const id = `n${nodeCount++}`;
            
            let label = tag;
            let shape = "box";
            let color = "#eeeeee";

            if (tag === "block") {
                label = "BLOCK"; 
                color = "#e6ffe6"; 
            } else if (tag === "Call") {
                shape = "octagon";
                color = "#ffe6e6"; 
            } else if (["IF", "WHILE", "FOR"].includes(tag)) {
                shape = "diamond";
                color = "#e6f2ff"; 
            } 
            // Hier habe ich ^, % und die Vergleiche ergänzt:
            else if ([":=", "+", "-", "*", "/", "%", "^", "<", ">", "<=", ">=", "==", "!="].includes(tag)) {
                shape = "circle";
                label = tag; 
            }

            lines.push(`  ${id} [label="${label}", shape="${shape}", fillcolor="${color}"];`);

            if (parentId) {
                lines.push(`  ${parentId} -> ${id};`);
            }

            for (const child of children) {
                visit(child, id);
            }
        }
    }

    visit(input);
    lines.push("}");
    return lines.join("\n");
}