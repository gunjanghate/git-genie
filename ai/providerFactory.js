import { GeminiProvider } from './providers/GeminiProvider.js';
import { LMStudioProvider } from './providers/LMStudioProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { OpenAICompatibleCloudProvider } from './providers/OpenAICompatibleCloudProvider.js';

export class ProviderFactory {
    constructor() {
        this.registry = new Map();
        this.localProviders = new Set();
    }

    registerProvider(name, creator, options = {}) {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) {
            throw new Error('Provider name is required for registration.');
        }
        this.registry.set(normalized, creator);
        if (options.local) {
            this.localProviders.add(normalized);
        }
    }

    getSupportedProviders() {
        return Array.from(this.registry.keys()).sort();
    }

    isLocalProvider(name) {
        return this.localProviders.has(String(name || '').trim().toLowerCase());
    }

    createProvider(name, config = {}) {
        const normalized = String(name || '').trim().toLowerCase();
        const creator = this.registry.get(normalized);
        if (!creator) {
            const supported = this.getSupportedProviders().join(', ');
            throw new Error(`Unknown AI provider "${name}". Supported providers: ${supported}`);
        }
        return creator(config);
    }
}

export function createDefaultProviderFactory() {
    const factory = new ProviderFactory();

    factory.registerProvider('gemini', (config) => new GeminiProvider(config));

    factory.registerProvider('mistral', (config) => new OpenAICompatibleCloudProvider({
        name: 'mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        model: config.model || 'mistral-small-latest',
        ...config,
    }));

    factory.registerProvider('groq', (config) => new OpenAICompatibleCloudProvider({
        name: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: config.model || 'llama-3.1-8b-instant',
        ...config,
    }));

    factory.registerProvider('ollama', (config) => new OllamaProvider(config), { local: true });
    factory.registerProvider('lmstudio', (config) => new LMStudioProvider(config), { local: true });

    return factory;
}
