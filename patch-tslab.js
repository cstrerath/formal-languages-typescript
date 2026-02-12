/**
 * @file patch-tslab.js
 * @description Automates the configuration of the tslab kernel for the Formal Languages course.
 * Performs two main tasks:
 * 1. Patches the tslab converter to enable strict TypeScript compiler flags.
 * 2. Installs a custom CSS file into the user's global Jupyter configuration (~/.jupyter/custom)
 * to ensure consistent styling across Jupyter Notebook and nbclassic.
 * * @requires node
 * @requires npm
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- CONFIGURATION ---

const TARGET_PACKAGE = 'tslab';
const CSS_SOURCE_PATH = path.join(__dirname, 'style.css');

/**
 * The strict compiler flags to be injected into the tslab converter.
 */
const STRICT_FLAGS = `
        // --- PATCH START (Auto-Injected Strict Flags) ---
        strictNullChecks: true,
        strict: true,
        noImplicitAny: true,
        // --- PATCH END ---`;

// --- HELPER FUNCTIONS ---

/**
 * Locates the installation path of the tslab package.
 * Checks the local 'node_modules' first, then falls back to the global npm root.
 * * @returns {string} The absolute path to the tslab package.
 * @throws {Error} If tslab cannot be found locally or globally.
 */
function findTslabRoot() {
    // 1. Check local node_modules (e.g., if installed via npm install without -g)
    const localPath = path.join(__dirname, 'node_modules', TARGET_PACKAGE);
    if (fs.existsSync(localPath)) {
        return localPath;
    }

    // 2. Check global npm root
    try {
        const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
        const globalPath = path.join(globalRoot, TARGET_PACKAGE);
        if (fs.existsSync(globalPath)) {
            return globalPath;
        }
    } catch (error) {
        // Fallback to error throwing below
    }

    throw new Error(`Could not locate '${TARGET_PACKAGE}'. Please ensure it is installed (npm install -g tslab).`);
}

/**
 * Patches the 'dist/converter.js' file inside tslab to enable strict mode.
 * This is necessary because tslab does not read tsconfig.json by default in all contexts.
 */
function applyStrictFlags() {
    console.log('[INFO] Checking tslab strict mode configuration...');
    
    try {
        const tslabRoot = findTslabRoot();
        const filePath = path.join(tslabRoot, 'dist', 'converter.js');
        // The specific line of code where we inject our flags
        const ANCHOR = 'const host = ts.createWatchCompilerHost(Array.from(rootFiles), {';

        if (!fs.existsSync(filePath)) {
            console.warn(`[WARN] File not found: ${filePath}. Skipping strict mode patch.`);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('strictNullChecks: true')) {
            console.log('[INFO] tslab is already patched for strict mode.');
        } else if (content.includes(ANCHOR)) {
            const patchedContent = content.replace(ANCHOR, ANCHOR + STRICT_FLAGS);
            fs.writeFileSync(filePath, patchedContent, 'utf8');
            console.log('[SUCCESS] Strict mode flags successfully injected.');
        } else {
            console.error('[ERROR] Injection anchor not found in converter.js. The tslab version might be incompatible.');
        }
    } catch (error) {
        console.error(`[ERROR] Failed to patch tslab: ${error.message}`);
    }
}

/**
 * Installs the custom CSS file to the user's global Jupyter configuration directory.
 * Target: ~/.jupyter/custom/custom.css
 */
function installGlobalStyle() {
    console.log('[INFO] Installing custom CSS styling...');

    try {
        const homeDir = os.homedir();
        const targetDir = path.join(homeDir, '.jupyter', 'custom');
        const targetFile = path.join(targetDir, 'custom.css');

        // Ensure the source file exists
        if (!fs.existsSync(CSS_SOURCE_PATH)) {
            console.error(`[ERROR] Source CSS file not found at: ${CSS_SOURCE_PATH}`);
            return;
        }

        // Ensure the destination directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`[INFO] Created directory: ${targetDir}`);
        }

        // Copy the file
        fs.copyFileSync(CSS_SOURCE_PATH, targetFile);
        console.log(`[SUCCESS] Custom CSS installed to: ${targetFile}`);

    } catch (error) {
        console.error(`[ERROR] Failed to install custom CSS: ${error.message}`);
    }
}

// --- MAIN EXECUTION ---

/**
 * Main entry point of the script.
 */
function main() {
    console.log('--- Starting Environment Setup ---');
    
    applyStrictFlags();
    installGlobalStyle();
    
    console.log('--- Setup Complete ---');
    console.log('NOTE: If you just installed the CSS, please restart your Jupyter Notebook server for changes to take effect.');
}

main();
