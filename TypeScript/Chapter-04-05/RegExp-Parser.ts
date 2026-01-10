import { Tuple } from 'recursive-set';
// Wir importieren die strikten Typen aus Modul 03
import { RegExp, UnaryOp, BinaryOp, EmptySet, Epsilon } from "./03-RegExp-2-NFA";

// === Types ===

type ParseResult = [RegExp, string[]];

// === Helpers ===

function error(msg: string, tokens: string[]): never {
    throw new Error(`Parse Error: ${msg}. Remaining tokens: ${JSON.stringify(tokens)}`);
}

function tokenize(s: string): string[] {
    // Erkennt Operatoren, Klammern, Buchstaben, Leere Menge (∅) und Epsilon (ε)
    const tokenRegex = /[+*()]|[a-zA-Z]|∅|ε/g;
    const matches = s.match(tokenRegex);
    return matches ? matches : [];
}

// Helper für "Is start of a new atom?" (für implizite Konkatenation)
function isAtomStart(t: string): boolean {
    return /^[a-zA-Z(∅ε]$/.test(t);
}

// === Recursive Descent Parser Functions ===

/**
 * Parses Union: A + B
 * Grammar: regExp → product ('+' product)*
 */
function parseRegExp(tokens: string[]): ParseResult {
    let [result, rest] = parseProduct(tokens);

    while (rest.length > 0 && rest[0] === '+') {
        const nextTokens = rest.slice(1);
        const [right, rightRest] = parseProduct(nextTokens);
        
        // Strict Tuple Construction
        result = new Tuple<[RegExp, BinaryOp, RegExp]>(
            result, 
            '+', 
            right
        );
        rest = rightRest;
    }

    return [result, rest];
}

/**
 * Parses Concatenation (Implicit): AB
 * Grammar: product → factor factor*
 */
function parseProduct(tokens: string[]): ParseResult {
    let [result, rest] = parseFactor(tokens);

    while (rest.length > 0 && isAtomStart(rest[0])) {
        const [right, rightRest] = parseFactor(rest);
        
        // Strict Tuple Construction
        result = new Tuple<[RegExp, BinaryOp, RegExp]>(
            result, 
            '⋅', 
            right
        );
        rest = rightRest;
    }

    return [result, rest];
}

/**
 * Parses Kleene Star: A*
 * Grammar: factor → atom '*'?
 */
function parseFactor(tokens: string[]): ParseResult {
    let [atom, rest] = parseAtom(tokens);

    if (rest.length > 0 && rest[0] === '*') {
        // Strict Tuple Construction
        atom = new Tuple<[RegExp, UnaryOp]>(atom, '*');
        rest = rest.slice(1);
    }

    return [atom, rest];
}

/**
 * Parses Atoms: (A), ∅, ε, a
 * Grammar: atom → '(' regExp ')' | LETTER | 'ε' | '∅'
 */
function parseAtom(tokens: string[]): ParseResult {
    if (tokens.length === 0) {
        error("Unexpected end of input", tokens);
    }

    const t = tokens[0];
    const rest = tokens.slice(1);

    // 1. Parentheses
    if (t === '(') {
        const [expr, afterExpr] = parseRegExp(rest);
        
        if (afterExpr.length === 0 || afterExpr[0] !== ')') {
            error("Expected ')'", afterExpr);
        }
        return [expr, afterExpr.slice(1)];
    }

    // 2. Empty Set (Literal 0)
    // Cast to EmptySet needed if type inference is strict on 'number'
    if (t === '∅') return [0 as EmptySet, rest];
    
    // 3. Epsilon
    if (t === 'ε') return ['ε' as Epsilon, rest];

    // 4. Character
    if (/^[a-zA-Z]$/.test(t)) return [t, rest];

    error(`Unexpected token '${t}'`, tokens);
    // Unreachable, but satisfies TS return type check
    return [0, []];
}

// === Main Export ===

export function parse(s: string): RegExp {
    const tokens = tokenize(s);
    const [result, rest] = parseRegExp(tokens);
    
    if (rest.length > 0) {
        error("Unexpected trailing tokens", rest);
    }
    
    return result;
}
