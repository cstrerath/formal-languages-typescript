# Formal Languages & Compiler Construction - TypeScript Edition

TypeScript translation of the Jupyter notebooks for the "Formal Languages" course, originally created by Karl Stroetmann in Python.

This repository contains educational materials covering lexical analysis, Automata Theory (FSM), parsing, and a full interpreter implementation using modern TypeScript and the **Lezer** parser generator.

## About This Project

This repository is part of a university project (Studienarbeit) at DHBW Mannheim, translating Karl Stroetmann's Python-based course materials to TypeScript.

**Project Team:**
- Ertan Ertas - GitHub: @ertan998
- Christian Strerath - GitHub: @cstrerath

**Supervised by:** Prof. Dr. Karl Stroetmann

**Project Duration:** October 2025 - April 2026

## Original Repository

This project is a TypeScript translation of the original Python notebooks:
- Original: [Formal-Languages (Python)](https://github.com/karlstroetmann/Formal-Languages)
- Author: Karl Stroetmann

## Key Features & Differences

* **Modern Parser Generation:** Uses **Lezer** (a modern, incremental LR parser generator) instead of legacy tools like Yacc/Bison or PLY.
* **Value Semantics:** Utilizes `recursive-set` to treat AST nodes and Environment states as immutable values with structural equality. This simplifies hashing and comparison significantly compared to Python's mutable lists/dicts.
* **In-Browser Visualization:** Automatic rendering of Finite Automata and Abstract Syntax Trees (AST) using `@viz-js/viz` (WebAssembly port of Graphviz), requiring no local Graphviz installation.
* **Type Safety:** Leverages TypeScript's static type system to enforce strict structures for ASTs and State Machines.

## Project Structure

The course is divided into logical chapters:

### Chapter 03: Lexical Analysis
Introduction to text processing and scanning.
* **Scanning:** Basic tokenization using Lezer.
* **HTML to Text:** A state-machine based converter using the `entities` library.

### Chapter 04-05: Automata Theory (FSM)
A complete pipeline for handling Finite State Machines.
* **RegExp to NFA to DFA:** Algorithms for converting and transforming automata.
* **Minimization:** Hopcroft's algorithm utilizing value semantics for state identification.
* **Equivalence:** Testing if two automata accept the same language.
* **Visualization:** Tools to render FSMs as Graphviz diagrams.

### Chapter 06: Parsing Fundamentals
Introduction to syntactic analysis.
* **Top-Down Parsing:** Recursive Descent implementation.
* **EBNF:** Parsing Extended Backus-Naur Form.

### Chapter 07: Applications (The Interpreter)
The capstone project: building a runtime for a custom language (`.sl`).
* **Symbolic Computation:** Calculator and Differentiator.
* **The Interpreter:** A full runtime supporting Control Flow (`if`, `while`), Functions, and Scoped Memory.

### Chapter 10: Advanced Parsing with Lezer
Handling complex grammar scenarios.
* **Conflict Resolution:** Resolving Shift/Reduce conflicts using Precedence Declarations and Stratified Grammars.

## Prerequisites & Installation

You need a Conda distribution to manage the Jupyter environment, and Node.js for the TypeScript kernel.

### 1. Install Conda (Choose one)

**Option A: Anaconda**
Standard distribution, includes a GUI.
- Download: [https://www.anaconda.com/download](https://www.anaconda.com/download)

**Option B: Miniforge**
Lightweight, faster, and uses `conda-forge` by default.
- Download: [https://github.com/conda-forge/miniforge](https://github.com/conda-forge/miniforge)

---

### 2. Setup Environment

We recommend creating a dedicated environment named `fl-ts`. The `-c conda-forge` flag ensures that packages are compatible, regardless of which Conda distribution you use.

Open your terminal (or Anaconda Prompt on Windows) and run:

```bash
# 1. Create a clean environment with Python and Node.js
conda create -n fl-ts -c conda-forge python=3.12 nodejs -y

# 2. Activate the environment
conda activate fl-ts

# 3. Install Jupyter Notebook Classic and core tools
conda install -c conda-forge nbclassic jupyter_core -y

# 4. Install tslab (TypeScript kernel) globally within the environment
npm install -g tslab

# 5. Register tslab with Jupyter
tslab install
```

### 3. Install Dependencies & Configure Kernel

Navigate to the root of this repository and install the required packages. Afterward, execute the patch script to enforce strict typing rules (`noImplicitAny`, `strictNullChecks`, etc.) in the Jupyter kernel.

```bash
# 1. Install dependencies
npm install

# 2. Patch tslab configuration for strict mode
node patch-tslab.js
```

## Libraries Used

This project utilizes a specific technology stack to ensure type safety and computational efficiency:

* **[@lezer/generator](https://lezer.codemirror.net/)**: A modern, error-tolerant LR parser generator used for lexical analysis and parsing.
* **[recursive-set (v8)](https://www.npmjs.com/package/recursive-set)**: A high-performance Set/Map implementation designed for Value Semantics (Structural Equality).
* **[@viz-js/viz](https://github.com/mdaines/viz-js)**: A WebAssembly port of Graphviz for rendering automata and syntax trees.
* **[tslab](https://github.com/yunabe/tslab)**: Interactive TypeScript kernel for Jupyter.
* **[entities](https://www.npmjs.com/package/entities)**: Used for decoding HTML entities in the Lexical Analysis chapter.

## Usage

1. Clone this repository.
2. Ensure your environment is active: `conda activate fl-ts`.
3. Start Jupyter: `jupyter nbclassic`.
4. Open any notebook in the `TypeScript/` directory.
5. Ensure the kernel is set to **TypeScript**.

## Contributing

**Note:** This is an ongoing academic project. While the repository is publicly available for educational purposes, we cannot accept external contributions (issues, pull requests) until the project is completed and graded.

**Current Status:** Active development (expected completion: April 2026)

**What you can do:**
- Star the repository if you find it useful.
- Fork it for your own educational use (GPL-2.0).

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

This is a derivative work based on Karl Stroetmann's original "Formal Languages" repository, which is also licensed under GPL-2.0.

## Acknowledgments

Special thanks to Prof. Dr. Karl Stroetmann for creating the original educational materials that made this translation possible.
