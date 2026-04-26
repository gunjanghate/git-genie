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

export class OllamaProvider extends BaseAIProvider {
    getName() {
        return 'ollama';
    }

    get baseUrl() {
        return (this.config.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    }

    get model() {
        return this.config.model || '';
    }

    async validateApiKey() {
        return true;
    }

    async healthCheck() {
        await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
        return true;
    }

    async discoverModels() {
        const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 8000 });
        return (response.data?.models || []).map((m) => m.name).filter(Boolean);
    }

    async prompt(promptText) {
        if (!this.model) {
            throw new Error('Ollama model is not configured. Set it with: gg config --provider ollama --model <model>');
        }

        const response = await axios.post(
            `${this.baseUrl}/api/generate`,
            {
                model: this.model,
                prompt: promptText,
                stream: false,
            },
            { timeout: 30000 }
        );

        return response.data?.response || '';
    }

    async generateCommitMessage({ diff, desc, type, scope }) {
        const fallback = deterministicCommitMessage({ type, scope, desc });
        const text = await this.prompt(getCommitPrompt(diff, desc, type, scope));
        return cleanTextResponse(text, fallback);
    }

    async generatePRTitle({ diff, desc, type, scope }) {
        const fallback = deterministicPRTitle({ type, scope, desc });
        const text = await this.prompt(getPRTitlePrompt(diff, desc));
        return cleanTextResponse(text, fallback);
    }

    async generateBranchName({ diff, desc, type }) {
        const fallback = deterministicBranchName({ type, desc });
        const text = await this.prompt(getBranchNamePrompt(diff, desc, type));
        return normalizeBranchName(cleanTextResponse(text, fallback), fallback);
    }

    async groupFilesWithAI({ files }) {
        const raw = await this.prompt(getGroupingPrompt(files));
        const parsed = safeJsonParse(raw);
        if (!parsed?.groups || !Array.isArray(parsed.groups)) {
            return [{ name: 'all-changes', files }];
        }
        return parsed.groups;
    }

    async generateCommitMessageForGroup({ groupName, groupDiff, type }) {
        const fallback = deterministicCommitMessage({ type, desc: `update ${groupName}` });
        const text = await this.prompt(getGroupCommitPrompt(groupName, groupDiff, type));
        return cleanTextResponse(text, fallback);
    }
}
