import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDefaultProviderFactory } from '../ai/providerFactory.js';
import {
    getConfigFile,
    readConfig,
    readLocalProviderConfig,
    saveLocalProviderConfig,
    setActiveProvider,
    writeConfig,
} from '../ai/configStore.js';
import { getActiveProviderInstance } from '../ai/getActiveProviderInstance.js';

function withTempConfigDir(fn) {
    const prevDir = process.env.GITGENIE_CONFIG_DIR;
    const prevMistral = process.env.MISTRAL_API_KEY;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgenie-test-'));
    process.env.GITGENIE_CONFIG_DIR = tempDir;

    return Promise.resolve()
        .then(() => fn(tempDir))
        .finally(() => {
            if (prevDir === undefined) {
                delete process.env.GITGENIE_CONFIG_DIR;
            } else {
                process.env.GITGENIE_CONFIG_DIR = prevDir;
            }

            if (prevMistral === undefined) {
                delete process.env.MISTRAL_API_KEY;
            } else {
                process.env.MISTRAL_API_KEY = prevMistral;
            }

            fs.rmSync(tempDir, { recursive: true, force: true });
        });
}

test('config migration from legacy single-provider format', async () => {
    await withTempConfigDir(async () => {
        const file = getConfigFile();
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ GEMINI_API_KEY: 'legacy-encrypted-value' }, null, 2));

        const config = await readConfig();

        assert.equal(config.activeProvider, 'gemini');
        assert.equal(config.version, 2);
        assert.equal(config.providers.gemini.apiKeyEncrypted, 'legacy-encrypted-value');
    });
});

test('active provider switching persists in config', async () => {
    await withTempConfigDir(async () => {
        await setActiveProvider('groq');
        const config = await readConfig();
        assert.equal(config.activeProvider, 'groq');
    });
});

test('local provider config persists url and model', async () => {
    await withTempConfigDir(async () => {
        await saveLocalProviderConfig('ollama', {
            baseUrl: 'http://127.0.0.1:11434',
            model: 'llama3.2',
        });

        const local = await readLocalProviderConfig('ollama');
        assert.equal(local.baseUrl, 'http://127.0.0.1:11434');
        assert.equal(local.model, 'llama3.2');
    });
});

test('getActiveProviderInstance initializes cloud provider with env key', async () => {
    await withTempConfigDir(async () => {
        process.env.MISTRAL_API_KEY = 'dummy-test-key';
        await setActiveProvider('mistral');

        const provider = await getActiveProviderInstance({ silent: true });
        assert.ok(provider, 'expected provider instance');
        assert.equal(provider.getName(), 'mistral');
    });
});

test('getActiveProviderInstance returns null when cloud provider is missing config', async () => {
    await withTempConfigDir(async () => {
        delete process.env.MISTRAL_API_KEY;
        await setActiveProvider('mistral');

        const provider = await getActiveProviderInstance({ silent: true });
        assert.equal(provider, null);
    });
});

test('getActiveProviderInstance returns null when local provider is unreachable', async () => {
    await withTempConfigDir(async () => {
        await writeConfig({
            version: 2,
            activeProvider: 'ollama',
            providers: {
                gemini: {},
                mistral: {},
                groq: {},
                ollama: { baseUrl: 'http://127.0.0.1:1', model: 'llama3.2' },
                lmstudio: { baseUrl: 'http://localhost:1234/v1', model: '' },
            },
        });

        const provider = await getActiveProviderInstance({ silent: true });
        assert.equal(provider, null);
    });
});

test('factory creates local and cloud providers from configs', async () => {
    const factory = createDefaultProviderFactory();
    const local = factory.createProvider('ollama', { baseUrl: 'http://localhost:11434', model: 'llama3.2' });
    const cloud = factory.createProvider('groq', { apiKey: 'x' });

    assert.equal(local.getName(), 'ollama');
    assert.equal(cloud.getName(), 'groq');
});
