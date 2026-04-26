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
        this.model = config.model;
        this.authHeader = config.authHeader || 'Authorization';
        this.authPrefix = config.authPrefix || 'Bearer ';
        this.validatePath = config.validatePath || '/chat/completions';
    }

    getName() {
        return this.name;
    }

    async validateApiKey(apiKey) {
        if (!apiKey) return false;
        try {
            await this.chat(apiKey, [{ role: 'user', content: 'Reply with only: ok' }], {
                max_tokens: 5,
                temperature: 0,
            });
            return true;
        } catch {
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
        const url = `${this.baseUrl}${this.validatePath}`;
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
