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

test('Cloud providers always resolve a non-empty default model', () => {
    const factory = createDefaultProviderFactory();

    const groq = factory.createProvider('groq', {});
    const mistral = factory.createProvider('mistral', {});

    assert.ok(groq.model, 'groq model should be defined');
    assert.ok(mistral.model, 'mistral model should be defined');
    assert.equal(groq.model, 'llama-3.3-70b-versatile');
    assert.equal(mistral.model, 'mistral-small-latest');
});

test('Cloud provider keeps custom model when provided', () => {
    const factory = createDefaultProviderFactory();

    const groq = factory.createProvider('groq', { model: 'llama-3.3-70b-versatile' });
    assert.equal(groq.model, 'llama-3.3-70b-versatile');
});
