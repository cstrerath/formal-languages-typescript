/**
 * @file patch-tslab.js
 * @description Automates the injection of strict compiler flags into the tslab kernel.
 * This script locates the active environment's global node_modules and modifies
 * 'tslab/dist/converter.js' to enable strict type checking.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration constants
const TARGET_PACKAGE = 'tslab';
const RELATIVE_FILE_PATH = path.join('dist', 'converter.js');
const INJECTION_ANCHOR = 'const host = ts.createWatchCompilerHost(Array.from(rootFiles), {';

const STRICT_FLAGS = `
        // --- PATCH START (Auto-Script) ---
        strictNullChecks: true,
        strict: true,
        noImplicitAny: true,
        // --- PATCH END ---`;

/**
 * Main execution function.
 */
function main() {
    console.log('[INFO] Starting tslab patch process...');

    // 1. Locate global node_modules for the current environment
    let npmRoot;
    try {
        // 'npm root -g' returns the absolute path to global modules for the active environment
        npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
        console.log(`[INFO] Detected npm root: ${npmRoot}`);
    } catch (error) {
        console.error('[ERROR] Failed to execute "npm root -g". Ensure Node.js is installed in the current environment.');
        process.exit(1);
    }

    // 2. Construct the full path to the target file
    const targetFilePath = path.join(npmRoot, TARGET_PACKAGE, RELATIVE_FILE_PATH);

    if (!fs.existsSync(targetFilePath)) {
        console.error(`[ERROR] Target file not found: ${targetFilePath}`);
        console.error(`[ERROR] Ensure '${TARGET_PACKAGE}' is installed in this environment.`);
        process.exit(1);
    }

    // 3. Read file content
    let fileContent;
    try {
        fileContent = fs.readFileSync(targetFilePath, 'utf8');
    } catch (error) {
        console.error(`[ERROR] Unable to read file: ${error.message}`);
        process.exit(1);
    }

    // 4. Check for idempotency (avoid double patching)
    if (fileContent.includes('strictNullChecks: true')) {
        console.log('[INFO] File is already patched. No changes required.');
        process.exit(0);
    }

    // 5. Verify the injection point exists
    // This ensures we don't corrupt the file if the tslab version has changed significantly.
    if (!fileContent.includes(INJECTION_ANCHOR)) {
        console.error('[ERROR] Injection anchor not found in source code.');
        console.error('[ERROR] The tslab version might be incompatible with this patch script.');
        process.exit(1);
    }

    // 6. Apply the patch
    // Insert the strict flags immediately after the configuration object starts
    const newContent = fileContent.replace(
        INJECTION_ANCHOR,
        INJECTION_ANCHOR + STRICT_FLAGS
    );

    // 7. Write the modified content back to disk
    try {
        fs.writeFileSync(targetFilePath, newContent, 'utf8');
        console.log('[SUCCESS] Patch applied successfully.');
        console.log('[ACTION REQUIRED] Please restart your Jupyter Kernel for changes to take effect.');
    } catch (error) {
        console.error(`[ERROR] Failed to write to file: ${error.message}`);
        console.error('[ERROR] You may need administrative/root privileges.');
        process.exit(1);
    }
}

// Execute the script
main();
