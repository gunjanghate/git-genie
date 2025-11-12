import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

function runNode(args, options = {}) {
    return new Promise((resolvePromise) => {
        const child = spawn(process.execPath, args, { cwd: repoRoot, env: { ...process.env }, ...options });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d.toString()));
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
    });
}

test('cl command without arguments should error', async () => {
    const { code, stdout, stderr } = await runNode(['index.js', 'cl']);
    // Commander typically exits with code 1 and prints usage to stderr
    assert.notEqual(code, 0, 'Expected non-zero exit code when required arg missing');
    assert.match(stderr + stdout, /error|missing|Usage/i);
});

test('b command without arguments should error', async () => {
    const { code, stdout, stderr } = await runNode(['index.js', 'b']);
    assert.notEqual(code, 0, 'Expected non-zero exit code when required arg missing');
    assert.match(stderr + stdout, /error|missing|Usage/i);
});
