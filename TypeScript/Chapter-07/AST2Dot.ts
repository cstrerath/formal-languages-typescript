export function astToDot(input: unknown): string {
    let nodeCount = 0;
    const lines: string[] = [
        "digraph AST {",
        '  node [shape=box, style=filled, fillcolor="#fcfcfc", fontname="Courier", fontsize=10];',
        '  edge [arrowsize=0.7];'
    ];

    function visit(thing: unknown, parentId: string | null = null): void {
        if (thing === null) return;

        if (typeof thing === "string" || typeof thing === "number") {
            const id = `n${nodeCount++}`;
            const label = thing.toString().replace(/"/g, '\\"');
            lines.push(`  ${id} [label="${label}", shape=circle, margin=0.05];`);
            if (parentId) lines.push(`  ${parentId} -> ${id};`);
            return;
        }

        if (Array.isArray(thing)) {
            const first = thing[0];

            if (Array.isArray(first)) {
                const [head, tail] = thing;
                visit(head, parentId);
                visit(tail, parentId);
                return;
            }

            if (typeof first === "string" || typeof first === "number") {
                const id = `n${nodeCount++}`;
                lines.push(`  ${id} [label="${first}", fillcolor="#eeeeee", style="filled,bold"];`);
                if (parentId) lines.push(`  ${parentId} -> ${id};`);

                for (let i = 1; i < thing.length; i++) {
                    visit(thing[i], id);
                }
                return;
            }
        }
    }

    visit(input);
    lines.push("}");
    return lines.join("\n");
}