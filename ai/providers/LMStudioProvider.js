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

export class LMStudioProvider extends BaseAIProvider {
    getName() {
        return 'lmstudio';
    }

    get baseUrl() {
        return (this.config.baseUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
    }

    get model() {
        return this.config.model || '';
    }

    async validateApiKey() {
        return true;
    }

    async healthCheck() {
        await axios.get(`${this.baseUrl}/models`, { timeout: 5000 });
        return true;
    }

    async discoverModels() {
        const response = await axios.get(`${this.baseUrl}/models`, { timeout: 8000 });
        return (response.data?.data || []).map((m) => m.id).filter(Boolean);
    }

    async chat(promptText) {
        if (!this.model) {
            throw new Error('LM Studio model is not configured. Set it with: gg config --provider lmstudio --model <model>');
        }

        const response = await axios.post(
            `${this.baseUrl}/chat/completions`,
            {
                model: this.model,
                messages: [{ role: 'user', content: promptText }],
                temperature: 0.2,
            },
            { timeout: 30000 }
        );

        return response.data?.choices?.[0]?.message?.content || '';
    }

    async generateCommitMessage({ diff, desc, type, scope }) {
        const fallback = deterministicCommitMessage({ type, scope, desc });
        const text = await this.chat(getCommitPrompt(diff, desc, type, scope));
        return cleanTextResponse(text, fallback);
    }

    async generatePRTitle({ diff, desc, type, scope }) {
        const fallback = deterministicPRTitle({ type, scope, desc });
        const text = await this.chat(getPRTitlePrompt(diff, desc));
        return cleanTextResponse(text, fallback);
    }

    async generateBranchName({ diff, desc, type }) {
        const fallback = deterministicBranchName({ type, desc });
        const text = await this.chat(getBranchNamePrompt(diff, desc, type));
        return normalizeBranchName(cleanTextResponse(text, fallback), fallback);
    }

    async groupFilesWithAI({ files }) {
        const raw = await this.chat(getGroupingPrompt(files));
        const parsed = safeJsonParse(raw);
        if (!parsed?.groups || !Array.isArray(parsed.groups)) {
            return [{ name: 'all-changes', files }];
        }
        return parsed.groups;
    }

    async generateCommitMessageForGroup({ groupName, groupDiff, type }) {
        const fallback = deterministicCommitMessage({ type, desc: `update ${groupName}` });
        const text = await this.chat(getGroupCommitPrompt(groupName, groupDiff, type));
        return cleanTextResponse(text, fallback);
    }
}
