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

test('CLI --help prints onboarding banner and usage', async () => {
    const { code, stdout, stderr } = await runNode(['index.js', '--help']);
    assert.equal(code, 0, `Expected exit code 0, got ${code}. stderr: ${stderr}`);
    assert.match(stdout, /Welcome to GitGenie!/i, 'Should include onboarding banner');
    assert.match(stdout, /Usage:/, 'Should include Usage section');
});

test('CLI -h works as alias for --help', async () => {
    const { code, stdout } = await runNode(['index.js', '-h']);
    assert.equal(code, 0);
    assert.match(stdout, /GitGenie/i);
});
