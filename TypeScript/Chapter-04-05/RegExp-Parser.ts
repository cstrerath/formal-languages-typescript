import { Tuple } from 'recursive-set';
import { RegExp, UnaryOp, BinaryOp } from "./03-RegExp-2-NFA";


// ============================================================
// 1. Type Definitions
// ============================================================

/**
 * The ParseTree uses the same structure as our RegExp type.
 * We align it with our RegExp definition from module 03.
 */
export type ParseTree = RegExp; 

/** 
 * A helper type for the parser result: 
 * [ParsedObject, RemainingTokens]
 */
type ParseResult = [ParseTree, string[]];

// ============================================================
// 2. Tokenizer
// ============================================================

/**
 * Tokenizes the input string into a list of significant tokens.
 * Recognizes: +, *, (, ), ∅, ε, and single letters.
 * Discards whitespace.
 */
export function tokenize(s: string): string[] {
    // Regex to match all valid tokens
    const tokenRegex = /[+*()]|[a-zA-Z]|∅|ε/g; 
    const matches = s.match(tokenRegex);
    
    return matches ? matches : [];
}

// ============================================================
// 3. Parser Functions (Recursive Descent)
// ============================================================

/**
 * Helper to throw readable parse errors
 */
function error(msg: string, tokens: string[]): never {
    throw new Error(`Parse Error: ${msg}. Remaining tokens: ${JSON.stringify(tokens)}`);
}

/**
 * Main Parse Function
 */
export function parse(s: string): ParseTree {
    const tokens = tokenize(s);
    const [result, rest] = parseRegExp(tokens);
    
    if (rest.length > 0) {
        error("Unexpected trailing tokens", rest);
    }
    
    return result;
}

/**
 * Parses: regExp -> product ('+' product)*
 */
function parseRegExp(tokens: string[]): ParseResult {
    let [result, rest] = parseProduct(tokens);

    // While next token is '+', consume it and parse next product
    while (rest.length > 0 && rest[0] === '+') {
        const nextTokens = rest.slice(1);
        const [right, rightRest] = parseProduct(nextTokens);
        
        // Use Tuple for Union
        result = new Tuple<[RegExp, BinaryOp, RegExp]>(
            result, 
            '+' as BinaryOp, 
            right
        );
        rest = rightRest;
    }

    return [result, rest];
}

/**
 * Parses: product -> factor factor*
 * Note: In our regex syntax, concatenation is implicit (e.g., "ab").
 * We interpret this as (factor '⋅' factor '⋅' factor...)
 */
function parseProduct(tokens: string[]): ParseResult {
    let [result, rest] = parseFactor(tokens);

    // Helper to check if a token can start a new factor (Atom)
    const isAtomStart = (t: string) => /^[a-zA-Z(∅ε]$/.test(t);

    while (rest.length > 0 && isAtomStart(rest[0])) {
        const [right, rightRest] = parseFactor(rest);
        
        // Use Tuple for Concatenation
        result = new Tuple<[RegExp, BinaryOp, RegExp]>(
            result, 
            '⋅' as BinaryOp, 
            right
        );
        rest = rightRest;
    }

    return [result, rest];
}

/**
 * Parses: factor -> atom '*'?
 */
function parseFactor(tokens: string[]): ParseResult {
    let [atom, rest] = parseAtom(tokens);

    // Check for Kleene Star '*'
    if (rest.length > 0 && rest[0] === '*') {
        // Use Tuple for Kleene Star
        atom = new Tuple<[RegExp, UnaryOp]>(atom, '*' as UnaryOp);
        rest = rest.slice(1);
    }

    return [atom, rest];
}

/**
 * Parses: atom -> '(' regExp ')' | '∅' | 'ε' | LETTER
 */
function parseAtom(tokens: string[]): ParseResult {
    if (tokens.length === 0) {
        error("Unexpected end of input", tokens);
    }

    const t = tokens[0];
    const rest = tokens.slice(1);

    // Case 1: Parentheses
    if (t === '(') {
        const [expr, afterExpr] = parseRegExp(rest);
        
        if (afterExpr.length === 0 || afterExpr[0] !== ')') {
            error("Expected ')'", afterExpr);
        }
        
        return [expr, afterExpr.slice(1)]; // Consume ')'
    }

    // Case 2: Empty Set
    if (t === '∅') {
        return [0, rest]; // 0 represents ∅ (matches RegExp = number | ...)
    }

    // Case 3: Epsilon
    if (t === 'ε') {
        return ['ε', rest];
    }

    // Case 4: Letter (a-z, A-Z)
    if (/^[a-zA-Z]$/.test(t)) {
        return [t, rest];
    }

    // Error
    error(`Unexpected token '${t}'`, tokens);
    return [0, []]; // Unreachable
}

