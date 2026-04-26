export class BaseAIProvider {
    constructor(config = {}) {
        this.config = config;
    }

    getName() {
        throw new Error('BaseAIProvider#getName must be implemented by provider classes.');
    }

    async validateApiKey(_apiKey) {
        throw new Error(`${this.getName()}#validateApiKey is not implemented.`);
    }

    async generateCommitMessage(_input) {
        throw new Error(`${this.getName()}#generateCommitMessage is not implemented.`);
    }

    async generatePRTitle(_input) {
        throw new Error(`${this.getName()}#generatePRTitle is not implemented.`);
    }

    async generateBranchName(_input) {
        throw new Error(`${this.getName()}#generateBranchName is not implemented.`);
    }

    async groupFilesWithAI(_input) {
        throw new Error(`${this.getName()}#groupFilesWithAI is not implemented.`);
    }

    async generateCommitMessageForGroup(_input) {
        throw new Error(`${this.getName()}#generateCommitMessageForGroup is not implemented.`);
    }
}
