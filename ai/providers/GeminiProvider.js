import { GoogleGenerativeAI } from '@google/generative-ai';
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

export class GeminiProvider extends BaseAIProvider {
    getName() {
        return 'gemini';
    }

    getModel() {
        return this.config.model || 'gemini-2.0-flash';
    }

    async validateApiKey(apiKey) {
        if (!apiKey) return false;
        try {
            const client = new GoogleGenerativeAI(apiKey);
            const model = client.getGenerativeModel({ model: this.getModel() });
            await model.generateContent('Reply with only: ok');
            return true;
        } catch {
            return false;
        }
    }

    async prompt(apiKey, promptText) {
        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({ model: this.getModel() });
        const result = await model.generateContent(promptText);
        return result?.response?.text?.() || '';
    }

    async generateCommitMessage({ apiKey, diff, desc, type, scope }) {
        const fallback = deterministicCommitMessage({ type, scope, desc });
        const text = await this.prompt(apiKey, getCommitPrompt(diff, desc, type, scope));
        return cleanTextResponse(text, fallback);
    }

    async generatePRTitle({ apiKey, diff, desc, type, scope }) {
        const fallback = deterministicPRTitle({ type, scope, desc });
        const text = await this.prompt(apiKey, getPRTitlePrompt(diff, desc));
        return cleanTextResponse(text, fallback);
    }

    async generateBranchName({ apiKey, diff, desc, type }) {
        const fallback = deterministicBranchName({ type, desc });
        const text = await this.prompt(apiKey, getBranchNamePrompt(diff, desc, type));
        return normalizeBranchName(cleanTextResponse(text, fallback), fallback);
    }

    async groupFilesWithAI({ apiKey, files }) {
        const raw = await this.prompt(apiKey, getGroupingPrompt(files));
        const parsed = safeJsonParse(raw);
        if (!parsed?.groups || !Array.isArray(parsed.groups)) {
            return [{ name: 'all-changes', files }];
        }
        return parsed.groups;
    }

    async generateCommitMessageForGroup({ apiKey, groupName, groupDiff, type }) {
        const fallback = deterministicCommitMessage({ type, desc: `update ${groupName}` });
        const text = await this.prompt(apiKey, getGroupCommitPrompt(groupName, groupDiff, type));
        return cleanTextResponse(text, fallback);
    }
}
