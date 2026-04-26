import axios from 'axios';
import { BaseAIProvider } from './BaseAIProvider.js';
import {
    cleanTextResponse,
    deterministicBranchName,
    deterministicCommitMessage,
    deterministicPRTitle,
    normalizeBranchName,
    safeJsonParse,
} from './utils.js';
import {
    getBranchNamePrompt,
    getCommitPrompt,
    getGroupCommitPrompt,
    getGroupingPrompt,
    getPRTitlePrompt,
} from './prompts.js';

export class OpenAICompatibleCloudProvider extends BaseAIProvider {
    constructor(config = {}) {
        super(config);
        this.name = config.name;
        this.baseUrl = config.baseUrl;
        this.defaultModel = config.defaultModel || 'gpt-4o-mini';
        const configuredModel = typeof config.model === 'string' ? config.model.trim() : '';
        this.model = configuredModel || this.defaultModel;
        this.authHeader = config.authHeader || 'Authorization';
        this.authPrefix = config.authPrefix || 'Bearer ';
        this.validatePath = config.validatePath || '/chat/completions';
    }

    getName() {
        return this.name;
    }

    async validateApiKey(apiKey) {
        if (!apiKey) {
            console.warn(`[${this.getName()}] API key is not set.`);
            return false;
        }
        try {
            console.log(`[${this.getName()}] Validating API key with model: ${this.model}`);
            await this.chat(apiKey, [{ role: 'user', content: 'Reply with only: ok' }], {
                max_tokens: 5,
                temperature: 0,
            });
            console.log(`[${this.getName()}] API key is valid.`);
            return true;
        } catch (err) {
            console.error(`[${this.getName()}] Validation error:`,
                err.response?.data || err.message
            );
            return false;
        }
    }

    buildHeaders(apiKey) {
        return {
            'Content-Type': 'application/json',
            [this.authHeader]: `${this.authPrefix}${apiKey}`,
        };
    }

    async chat(apiKey, messages, extra = {}) {
        if (!this.model) {
            throw new Error(`[${this.getName()}] model is missing. Configure a model for this provider.`);
        }

        console.log(`[${this.getName()}] Using model: ${this.model}`);

        const url = `${this.baseUrl}${this.validatePath}`;
        try {
            const response = await axios.post(
                url,
                {
                    model: this.model,
                    messages,
                    temperature: 0.2,
                    ...extra,
                },
                {
                    headers: this.buildHeaders(apiKey),
                    timeout: 20000,
                }
            );
            return response.data?.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error(`[${this.getName()}] API request failed:`, err.response?.data || err.message);
            throw err;
        }
    }

    async generateCommitMessage({ apiKey, diff, desc, type, scope }) {
        const fallback = deterministicCommitMessage({ type, scope, desc });
        const content = await this.chat(apiKey, [{ role: 'user', content: getCommitPrompt(diff, desc, type, scope) }]);
        return cleanTextResponse(content, fallback);
    }

    async generatePRTitle({ apiKey, diff, desc, type, scope }) {
        const fallback = deterministicPRTitle({ type, scope, desc });
        const content = await this.chat(apiKey, [{ role: 'user', content: getPRTitlePrompt(diff, desc) }]);
        return cleanTextResponse(content, fallback);
    }

    async generateBranchName({ apiKey, diff, desc, type }) {
        const fallback = deterministicBranchName({ type, desc });
        const content = await this.chat(apiKey, [{ role: 'user', content: getBranchNamePrompt(diff, desc, type) }]);
        return normalizeBranchName(cleanTextResponse(content, fallback), fallback);
    }

    async groupFilesWithAI({ apiKey, files }) {
        const content = await this.chat(apiKey, [{ role: 'user', content: getGroupingPrompt(files) }], { temperature: 0 });
        const parsed = safeJsonParse(content);
        if (!parsed?.groups || !Array.isArray(parsed.groups)) {
            return [{ name: 'all-changes', files }];
        }
        return parsed.groups;
    }

    async generateCommitMessageForGroup({ apiKey, groupName, groupDiff, type }) {
        const fallback = deterministicCommitMessage({ type, desc: `update ${groupName}` });
        const content = await this.chat(apiKey, [{ role: 'user', content: getGroupCommitPrompt(groupName, groupDiff, type) }]);
        return cleanTextResponse(content, fallback);
    }
}
