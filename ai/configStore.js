import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import keytar from 'keytar';

const SERVICE_NAME = 'GitGenie';
const LEGACY_GEMINI_ACCOUNT = 'gemini_api_key';
const ENCRYPTION_KEY_ACCOUNT = 'encryption_key';
const PROVIDER_KEY_PREFIX = 'provider_api_key_';

const CLOUD_ENV_KEYS = {
    gemini: 'GEMINI_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    groq: 'GROQ_API_KEY',
};

const LOCAL_DEFAULTS = {
    ollama: { baseUrl: 'http://localhost:11434', model: '' },
    lmstudio: { baseUrl: 'http://localhost:1234/v1', model: '' },
};

export function getConfigDir() {
    return process.env.GITGENIE_CONFIG_DIR || path.join(os.homedir(), '.gitgenie');
}

export function getConfigFile() {
    return path.join(getConfigDir(), 'config.json');
}

export function getDefaultConfig() {
    return {
        version: 2,
        activeProvider: 'gemini',
        providers: {
            gemini: {},
            mistral: {},
            groq: {},
            ollama: { ...LOCAL_DEFAULTS.ollama },
            lmstudio: { ...LOCAL_DEFAULTS.lmstudio },
        },
    };
}

async function getEncryptionKey() {
    try {
        let encryptionKey = await keytar.getPassword(SERVICE_NAME, ENCRYPTION_KEY_ACCOUNT);
        if (!encryptionKey) {
            encryptionKey = crypto.randomBytes(32).toString('hex');
            await keytar.setPassword(SERVICE_NAME, ENCRYPTION_KEY_ACCOUNT, encryptionKey);
        }
        return encryptionKey;
    } catch {
        const uniqueData = os.homedir() + os.hostname() + os.userInfo().username;
        return crypto.createHash('sha256').update(uniqueData).digest('hex');
    }
}

async function encrypt(text) {
    const key = await getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

async function decrypt(value) {
    const [ivHex, encrypted] = String(value).split(':');
    if (!ivHex || !encrypted || ivHex.length !== 32) {
        throw new Error('Invalid encrypted data format');
    }
    const key = await getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function mergeDefaults(config = {}) {
    const defaults = getDefaultConfig();
    return {
        ...defaults,
        ...config,
        providers: {
            ...defaults.providers,
            ...(config.providers || {}),
            ollama: { ...defaults.providers.ollama, ...(config.providers?.ollama || {}) },
            lmstudio: { ...defaults.providers.lmstudio, ...(config.providers?.lmstudio || {}) },
        },
    };
}

function ensureConfigDir() {
    const dir = getConfigDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function migrateLegacyConfig(rawConfig) {
    let changed = false;
    let config = rawConfig || {};

    if (!config.version || !config.providers || !config.activeProvider) {
        config = mergeDefaults(config);
        changed = true;
    } else {
        config = mergeDefaults(config);
    }

    if (rawConfig?.GEMINI_API_KEY && !config.providers.gemini.apiKeyEncrypted) {
        config.providers.gemini.apiKeyEncrypted = rawConfig.GEMINI_API_KEY;
        changed = true;
    }

    if (rawConfig?.GEMINI_API_KEY) {
        delete config.GEMINI_API_KEY;
        changed = true;
    }

    if (changed) {
        await writeConfig(config);
    }

    return config;
}

export async function readConfig() {
    const file = getConfigFile();
    if (!fs.existsSync(file)) {
        return getDefaultConfig();
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return await migrateLegacyConfig(parsed);
    } catch {
        return getDefaultConfig();
    }
}

export async function writeConfig(config) {
    ensureConfigDir();
    const file = getConfigFile();
    const merged = mergeDefaults(config);
    fs.writeFileSync(file, JSON.stringify(merged, null, 2));
    return merged;
}

export async function setActiveProvider(providerName) {
    const config = await readConfig();
    config.activeProvider = String(providerName || '').trim().toLowerCase();
    await writeConfig(config);
}

export async function getActiveProviderName() {
    const config = await readConfig();
    return config.activeProvider;
}

export async function saveCloudApiKey(providerName, apiKey) {
    const provider = String(providerName || '').trim().toLowerCase();
    const key = String(apiKey || '').trim();
    if (!key) throw new Error('API key must be a non-empty string.');

    try {
        await keytar.setPassword(SERVICE_NAME, `${PROVIDER_KEY_PREFIX}${provider}`, key);
        return { secureStorage: 'keytar' };
    } catch {
        const config = await readConfig();
        const encrypted = await encrypt(key);
        config.providers[provider] = config.providers[provider] || {};
        config.providers[provider].apiKeyEncrypted = encrypted;
        await writeConfig(config);
        return { secureStorage: 'encrypted-file' };
    }
}

export async function readCloudApiKey(providerName) {
    const provider = String(providerName || '').trim().toLowerCase();

    const envKey = CLOUD_ENV_KEYS[provider];
    if (envKey && process.env[envKey]) {
        return process.env[envKey];
    }

    try {
        const account = `${PROVIDER_KEY_PREFIX}${provider}`;
        const providerKey = await keytar.getPassword(SERVICE_NAME, account);
        if (providerKey) return providerKey;

        if (provider === 'gemini') {
            const legacy = await keytar.getPassword(SERVICE_NAME, LEGACY_GEMINI_ACCOUNT);
            if (legacy) return legacy;
        }
    } catch {
        // continue to encrypted file fallback
    }

    const config = await readConfig();
    const encrypted = config.providers?.[provider]?.apiKeyEncrypted;
    if (!encrypted) return null;

    try {
        return await decrypt(encrypted);
    } catch {
        return null;
    }
}

export async function saveLocalProviderConfig(providerName, localConfig = {}) {
    const provider = String(providerName || '').trim().toLowerCase();
    const config = await readConfig();
    const defaults = LOCAL_DEFAULTS[provider] || {};

    config.providers[provider] = {
        ...defaults,
        ...(config.providers[provider] || {}),
        ...(localConfig || {}),
    };

    await writeConfig(config);
    return config.providers[provider];
}

export async function readLocalProviderConfig(providerName) {
    const provider = String(providerName || '').trim().toLowerCase();
    const config = await readConfig();
    const defaults = LOCAL_DEFAULTS[provider] || {};
    return {
        ...defaults,
        ...(config.providers?.[provider] || {}),
    };
}

export async function getProvidersStatus(factory) {
    const config = await readConfig();
    const supported = factory.getSupportedProviders();

    const statuses = [];
    for (const provider of supported) {
        const isLocal = factory.isLocalProvider(provider);

        if (isLocal) {
            const local = await readLocalProviderConfig(provider);
            statuses.push({
                provider,
                type: 'local',
                configured: Boolean(local.baseUrl && local.model),
                baseUrl: local.baseUrl || '',
                model: local.model || '',
                active: config.activeProvider === provider,
            });
            continue;
        }

        const apiKey = await readCloudApiKey(provider);
        statuses.push({
            provider,
            type: 'cloud',
            configured: Boolean(apiKey),
            active: config.activeProvider === provider,
        });
    }

    return statuses;
}
