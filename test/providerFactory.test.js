import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultProviderFactory } from '../ai/providerFactory.js';

test('ProviderFactory includes all supported providers', () => {
    const factory = createDefaultProviderFactory();
    const supported = factory.getSupportedProviders();

    assert.deepEqual(supported, ['gemini', 'groq', 'lmstudio', 'mistral', 'ollama']);
});

test('ProviderFactory lookup is case-insensitive', () => {
    const factory = createDefaultProviderFactory();
    const provider = factory.createProvider('GeMiNi', {});

    assert.equal(provider.getName(), 'gemini');
});

test('ProviderFactory throws helpful error for unknown provider', () => {
    const factory = createDefaultProviderFactory();

    assert.throws(
        () => factory.createProvider('unknown-provider', {}),
        /Unknown AI provider "unknown-provider"\. Supported providers: gemini, groq, lmstudio, mistral, ollama/
    );
});

test('ProviderFactory marks local providers correctly', () => {
    const factory = createDefaultProviderFactory();

    assert.equal(factory.isLocalProvider('ollama'), true);
    assert.equal(factory.isLocalProvider('lmstudio'), true);
    assert.equal(factory.isLocalProvider('gemini'), false);
});
