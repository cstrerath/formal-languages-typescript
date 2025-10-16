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

### 1. Install Anaconda

Download and install Anaconda from:
[https://www.anaconda.com/download](https://www.anaconda.com/download)

### 2. Set Up TypeScript Kernel for Jupyter

After installing Anaconda, follow these steps to install the TypeScript kernel:

```
# Activate base environment
conda activate base

# Install Node.js via conda
conda install nodejs

# Install tslab globally
npm install -g tslab

# Register tslab with Jupyter
tslab install

# Install Jupyter Notebook Classic
conda install nbclassic

# Start Jupyter Notebook
jupyter nbclassic

```

### 3. Install Dependencies

The notebooks will automatically install Chevrotain when first run, or you can install it manually:

```
npm install chevrotain
```

## Usage

1. Clone this repository
2. Navigate to the repository directory
3. Start Jupyter Notebook: `jupyter nbclassic`
4. Open any notebook in the `TypeScript/` directory
5. Select the "TypeScript" kernel when prompted

## Libraries Used

- **[Chevrotain](https://chevrotain.io/)**: Parser Building Toolkit for JavaScript/TypeScript
- **[tslab](https://github.com/yunabe/tslab)**: Interactive TypeScript programming with Jupyter

## Differences from Original

This TypeScript version uses:
- **Chevrotain** instead of Ply for lexical analysis and parsing
- **TypeScript** type system for enhanced type safety
- Modern JavaScript/TypeScript patterns and syntax

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