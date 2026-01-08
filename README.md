# Formal Languages - TypeScript Edition

TypeScript translation of the Jupyter notebooks for the "Formal Languages" course, originally created by Karl Stroetmann in Python.

This repository contains educational materials covering lexical analysis, parsing, context-free grammars, and interpreter implementation using modern TypeScript and the Chevrotain parser toolkit.

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

## Prerequisites

You need a Conda distribution to manage the Python environment and Jupyter, and Node.js for the TypeScript kernel.

### 1. Install Conda (Choose one)

**Option A: Miniforge (Recommended)**
Lightweight, faster, and uses `conda-forge` by default.
- Download: [https://github.com/conda-forge/miniforge](https://github.com/conda-forge/miniforge)

**Option B: Anaconda (Classic)**
Standard distribution, includes a GUI.
- Download: [https://www.anaconda.com/download](https://www.anaconda.com/download)

---

### 2. Setup Environment & TypeScript Kernel

We recommend creating a dedicated environment named `fl-ts` (Formal Languages TypeScript) to avoid conflicts with other projects.

Open your terminal (or Anaconda Prompt on Windows) and run:

```bash
# 1. Create a clean environment with Python and Node.js
conda create -n fl-ts python=3.12 nodejs -y

# 2. Activate the environment
conda activate fl-ts

# 3. Install Jupyter Notebook Classic and core tools
conda install -c conda-forge nbclassic jupyter_core -y

# 4. Install tslab (TypeScript kernel) globally within the environment
npm install -g tslab

# 5. Register tslab with Jupyter
tslab install

```

### 3. Install Dependencies

This project uses a package.json file to manage TypeScript dependencies (Chevrotain, Viz.js, Recursive-Set).

1. Navigate to the root of this repository (where package.json is located).
2. Run the installation command:

```
npm install
```

## Usage

1. Clone this repository
2. Ensure your environment is active: `conda activate fl-ts`
3. Navigate to the repository directory
4. Start Jupyter Notebook: `jupyter nbclassic`
5. Open any notebook in the `TypeScript/` directory
6. Ensure the kernel is set to **TypeScript** (usually automatic, or select via Kernel -> Change Kernel).

## Libraries Used

This project utilizes a specific technology stack to ensure type safety and computational efficiency:

* **[recursive-set (v7)](https://www.npmjs.com/package/recursive-set)**: A high-performance Set implementation designed for ZFC set theory operations.
* **[tslab](https://github.com/yunabe/tslab)**: An interactive TypeScript kernel for Jupyter, enabling the execution of TypeScript code within the notebook environment and providing integration with standard Jupyter features.
* **[Chevrotain](https://chevrotain.io/)**: A parser building toolkit used for lexical analysis and parsing of context-free grammars.
* **[@viz-js/viz](https://github.com/mdaines/viz-js)**: A WebAssembly port of Graphviz, used to render automata and syntax trees directly within the browser client.

## Key Differences from Original

* **Static Typing:** The codebase leverages TypeScript's type system to enforce strict typing structures.
* **Unified Set Structure:** The project utilizes `recursive-set` to manage collections, replacing the distinction between `set` (mutable) and `frozenset` (immutable) found in Python.

The educational content and examples remain as close to the original as possible.

## Contributing

**Note:** This is an ongoing academic project. While the repository is publicly available for educational purposes, we cannot accept external contributions (issues, pull requests) until the project is completed and graded.

**Current Status:** Active development (expected completion: April 2026)

**What you can do:**
- ⭐ Star the repository if you find it useful
- 👀 Watch for updates
- 🍴 Fork it for your own educational use (GPL-2.0)

**After project completion**, we welcome:
- 🐛 Bug reports via issues
- 💡 Feature suggestions
- 🔧 Pull requests with improvements

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

This is a derivative work based on Karl Stroetmann's original "Formal Languages" repository, which is also licensed under GPL-2.0.

## Acknowledgments

Special thanks to Prof. Dr. Karl Stroetmann for creating the original educational materials that made this translation possible.
